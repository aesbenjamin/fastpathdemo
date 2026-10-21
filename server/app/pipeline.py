from __future__ import annotations

import json
import logging
import threading
import time
import traceback

import numpy as np

from . import analytics, db, fastpath_local, llm
from .config import DEFAULT_THRESHOLDS, MODE_LABELS, MODES, settings, verdict
from .facts import melody_facts, tribe_facts
from .fastpath_aga import aga

log = logging.getLogger(__name__)

STEPS = [
    ("read", "Lendo as melodias do Neo4j"),
    ("project", "Projetando o grafo no Aura Graph Analytics"),
    ("fastpath_full", "FastPath: notas + tempo"),
    ("fastpath_notes", "FastPath: só notas"),
    ("knn", "KNN: vizinhos mais próximos"),
    ("rerank", "Rerank euclidiano, tribos e mapa"),
    ("llm", "IA generativa: tribos e perfis"),
    ("write", "Gravando os resultados no grafo"),
]

_job_lock = threading.Lock()
job: dict = {"status": "idle", "step": None, "steps": [{"id": s, "label": l} for s, l in STEPS]}

# In-memory copy of the last run, used to place composed melodies without recomputing the galaxy.
_cache: dict = {}


def _set_step(step: str) -> None:
    job["step"] = step
    job.setdefault("done", [])
    if step not in job["done"]:
        job["done"].append(step)


def _compute_embeddings(performances: list[dict]):
    """Returns (embeddings, knn candidates or None, backend used, warning)."""
    if settings.backend == "aga":
        try:
            emb, knn = aga.run(performances, settings.knn_candidates, _set_step)
            if emb:
                return emb, knn, "aga", None
            raise RuntimeError("A sessão AGA não retornou embeddings")
        except Exception as exc:
            log.exception("AGA falhou")
            if not settings.fallback_local:
                raise
            warning = f"Aura Graph Analytics indisponível ({exc.__class__.__name__}): usando FastPath local simulado"
    else:
        warning = None

    emb: dict[str, dict[str, np.ndarray]] = {}
    for mode in MODES:
        _set_step(f"fastpath_{mode}")
        for pid, vec in fastpath_local.embed_all(performances, settings.fastpath(mode)).items():
            emb.setdefault(pid, {})[mode] = vec
    _set_step("knn")
    return emb, None, "local", warning


def run_pipeline() -> None:
    started = time.time()
    _set_step("read")
    db.ensure_schema()
    performances = db.fetch_performances()
    if len(performances) < 3:
        raise RuntimeError("São necessárias pelo menos 3 melodias para rodar o FastPath")

    embeddings, knn, backend, warning = _compute_embeddings(performances)
    job.update(backend=backend, warning=warning)

    _set_step("rerank")
    perfs = [p for p in performances if p["id"] in embeddings]
    ids = [p["id"] for p in perfs]
    by_id = {p["id"]: p for p in perfs}
    facts = {p["id"]: melody_facts(p["notes"]) for p in perfs}

    results: dict[str, dict] = {}
    for mode in MODES:
        matrix = np.vstack([embeddings[i][mode] for i in ids])
        candidates = (knn or {}).get(mode) or analytics.cosine_candidates(ids, matrix, settings.knn_candidates)
        similar = analytics.rerank(ids, matrix, candidates, settings.knn_top_k, settings.cosine_weight, mode)
        labels, centroids = analytics.cluster(matrix)
        coords = analytics.layout(matrix)
        if mode != "full":
            coords = analytics.align(results["full"]["coords"], coords)
        results[mode] = {"matrix": matrix, "similar": similar, "labels": labels, "centroids": centroids, "coords": coords}

    originality = analytics.originality(ids, results["full"]["similar"])

    _set_step("llm")
    tribes: list[dict] = []
    for mode in MODES:
        labels = results[mode]["labels"]
        mode_tribes = []
        for index in sorted(set(labels.tolist())):
            members = [ids[i] for i in range(len(ids)) if labels[i] == index]
            mode_tribes.append(
                {"id": f"{mode}-{index}", "mode": mode, "index": index, "memberIds": members,
                 "facts": tribe_facts([facts[m] for m in members])}
            )
        names = llm.name_tribes(mode_tribes)
        for t in mode_tribes:
            t.update(names[t["id"]])
        tribes.extend(mode_tribes)
    tribe_name = {t["id"]: t["name"] for t in tribes}

    first_neighbor = {r["source"]: r["target"] for r in results["full"]["similar"] if r["rank"] == 1}
    people = []
    for i, pid in enumerate(ids):
        p = by_id[pid]
        if p.get("isBot") or p.get("isGenerated"):
            continue
        mate = by_id.get(first_neighbor.get(pid, ""))
        people.append({
            "id": pid, "name": p["name"], "facts": facts[pid], "originality": originality[pid],
            "tribeName": tribe_name[f"full-{results['full']['labels'][i]}"],
            "soulmate": None if mate is None else (mate["name"] if not mate.get("isBot") else f"o eco robô {mate['name']}"),
        })
    profiles = llm.profiles(people) if people else {}

    _set_step("write")
    now = int(time.time() * 1000)
    rows = []
    for i, pid in enumerate(ids):
        props = {
            "emb_full": embeddings[pid]["full"].tolist(),
            "emb_notes": embeddings[pid]["notes"].tolist(),
            "originality": originality[pid],
            "notesPerSecond": facts[pid]["notesPerSecond"],
            "factsJson": json.dumps(facts[pid], ensure_ascii=False),
            "resultsAt": now,
        }
        for mode in MODES:
            props[f"x_{mode}"] = float(results[mode]["coords"][i, 0])
            props[f"y_{mode}"] = float(results[mode]["coords"][i, 1])
            props[f"tribe_{mode}"] = f"{mode}-{int(results[mode]['labels'][i])}"
        if pid in profiles:
            props["profileTitle"] = profiles[pid]["title"]
            props["profileText"] = profiles[pid]["text"]
        rows.append({"id": pid, "props": props})

    db_tribes = [
        {"id": t["id"], "mode": t["mode"], "index": t["index"], "name": t["name"], "description": t["description"],
         "size": len(t["memberIds"]), "memberIds": t["memberIds"], "factsJson": json.dumps(t["facts"], ensure_ascii=False)}
        for t in tribes
    ]
    similar = [r for mode in MODES for r in results[mode]["similar"]]
    db.write_results(rows, db_tribes, similar)

    _cache.clear()
    _cache.update({"ids": ids, "results": results, "backend": backend})
    job.update(elapsedSeconds=round(time.time() - started, 1), people=len(people), total=len(ids))


def start_job() -> dict:
    with _job_lock:
        if job["status"] == "running":
            return job
        job.clear()
        job.update(status="running", step=None, done=[], startedAt=int(time.time() * 1000),
                   steps=[{"id": s, "label": l} for s, l in STEPS], llm=llm.enabled())

    def target():
        try:
            run_pipeline()
            job["status"] = "done"
        except Exception as exc:
            log.error(traceback.format_exc())
            job.update(status="error", error=str(exc))

    threading.Thread(target=target, daemon=True).start()
    return job


# ---------- state for the stage ----------

def state() -> dict:
    performances = db.fetch_performances()
    extra = {r["id"]: r for r in db.run(
        "MATCH (p:Performance) RETURN p.id AS id, p.factsJson AS facts, p.generatedText AS generatedText, p.emb_full AS emb"
    )}
    for p in performances:
        p.pop("nodeId", None)
        e = extra.get(p["id"], {})
        p["facts"] = json.loads(e["facts"]) if e.get("facts") else melody_facts(p["notes"])
        p["generatedText"] = e.get("generatedText")
        p["emb_full"] = [round(v, 4) for v in e["emb"]] if e.get("emb") else None
    tribes = db.fetch_tribes()
    for t in tribes:
        t["facts"] = json.loads(t.pop("factsJson", None) or "{}")
    return {
        "performances": performances,
        "tribes": tribes,
        "similar": db.fetch_similar(),
        "job": job,
        "hasResults": bool(tribes),
    }


# ---------- explanation ----------

def score_thresholds(mode: str) -> tuple[dict, dict]:
    """Cut-offs calibrated on this run's KNN output, so 'parecidas' means 'at the level of real neighbours'.

    similar = median score among all top-k neighbour pairs; very = median score of everyone's best neighbour;
    weak = similar minus a band. Env vars SCORE_* pin any of them to a fixed value.
    """
    scores = db.run("MATCH (:Performance)-[s:SIMILAR_TO {mode: $mode}]->(:Performance) RETURN s.rank AS rank, s.score AS score", mode=mode)
    reference: dict = {}
    th = dict(DEFAULT_THRESHOLDS)
    if scores:
        all_scores = np.array([r["score"] for r in scores])
        best = np.array([r["score"] for r in scores if r["rank"] == 1] or all_scores)
        th["similar"] = float(np.median(all_scores))
        th["very"] = max(float(np.median(best)), th["similar"] + 0.05)
        th["weak"] = th["similar"] - settings.score_weak_band
        reference = {"knnMedian": round(th["similar"], 2), "bestNeighbourMedian": round(float(np.median(best)), 2), "pairs": len(scores)}
    for key, pinned in (("very", settings.score_very_similar), ("similar", settings.score_similar), ("weak", settings.score_weak)):
        if pinned is not None:
            th[key] = pinned
    return th, reference


def explain(a_id: str, b_id: str, mode: str) -> dict:
    performances = {p["id"]: p for p in db.fetch_performances()}
    a, b = performances[a_id], performances[b_id]
    rel = db.run(
        """
        MATCH (:Performance {id: $a})-[s:SIMILAR_TO {mode: $mode}]-(:Performance {id: $b})
        RETURN s.cosine AS cosine, s.euclidean AS euclidean, s.score AS score, s.explanation AS explanation
        ORDER BY s.score DESC LIMIT 1
        """,
        a=a_id, b=b_id, mode=mode,
    )
    th, reference = score_thresholds(mode)
    if rel:
        scores = {k: rel[0][k] for k in ("cosine", "euclidean", "score")}
        v = verdict(scores["score"], th, reference)
        # cached texts were written for similar pairs; regenerate if the calibrated verdict disagrees
        if rel[0]["explanation"] and v["similar"]:
            return {"text": rel[0]["explanation"], "scores": scores, "verdict": v, "cached": True}
    else:
        emb = db.fetch_embeddings()
        va, vb = np.array(emb[a_id][mode]), np.array(emb[b_id][mode])
        scale = float(np.median([np.linalg.norm(np.array(v[mode])) for v in emb.values()])) or 1.0
        cosine = float(va @ vb / ((np.linalg.norm(va) * np.linalg.norm(vb)) or 1.0))
        euclidean = 1.0 / (1.0 + float(np.linalg.norm(va / scale - vb / scale)))
        scores = {"cosine": round(cosine, 4), "euclidean": round(euclidean, 4),
                  "score": round(settings.cosine_weight * cosine + (1 - settings.cosine_weight) * euclidean, 4)}
    v = verdict(scores["score"], th, reference)
    text = llm.explain(
        {"name": a["name"], "facts": melody_facts(a["notes"])},
        {"name": b["name"], "facts": melody_facts(b["notes"])},
        scores,
        MODE_LABELS[mode],
        v,
    )
    if rel:
        db.save_explanation(a_id, b_id, mode, text)
    return {"text": text, "scores": scores, "verdict": v, "cached": False}


# ---------- composition ----------

def _load_cache() -> None:
    if _cache:
        return
    performances = db.fetch_performances()
    emb = db.fetch_embeddings()
    perfs = [p for p in performances if p["id"] in emb and p.get(f"x_full") is not None]
    if not perfs:
        raise RuntimeError("Rode o FastPath antes de compor")
    ids = [p["id"] for p in perfs]
    results = {}
    for mode in MODES:
        matrix = np.vstack([np.array(emb[i][mode]) for i in ids])
        tribe_ids = [p[f"tribe_{mode}"] for p in perfs]
        indexes = sorted({int(t.split("-")[1]) for t in tribe_ids})
        unit = analytics.normalize(matrix)
        labels = np.array([int(t.split("-")[1]) for t in tribe_ids])
        centroids = np.zeros((max(indexes) + 1, matrix.shape[1]))
        for k in indexes:
            centroids[k] = unit[labels == k].mean(axis=0)
        results[mode] = {
            "matrix": matrix, "labels": labels, "centroids": analytics.normalize(centroids),
            "coords": np.array([[p[f"x_{mode}"], p[f"y_{mode}"]] for p in perfs]),
        }
    _cache.update({"ids": ids, "results": results})


def compose(tribe_id: str) -> dict:
    _load_cache()
    tribe_rows = db.run("MATCH (t:Tribe {id: $id}) RETURN t {.*} AS t", id=tribe_id)
    if not tribe_rows:
        raise RuntimeError("Tribo não encontrada")
    tribe = tribe_rows[0]["t"]
    tribe["facts"] = json.loads(tribe.get("factsJson") or "{}")
    mode = tribe["mode"]

    members = db.run(
        """
        MATCH (p:Performance)-[:IN_TRIBE {mode: $mode}]->(:Tribe {id: $id})
        RETURN p.id AS id ORDER BY p.isBot, rand() LIMIT 3
        """,
        mode=mode, id=tribe_id,
    )
    performances = {p["id"]: p for p in db.fetch_performances()}
    from .notes import CODE_TO_NAME

    examples = [
        [{"note": CODE_TO_NAME[n["code"]], "t": round(n["t"])} for n in performances[m["id"]]["notes"]]
        for m in members if m["id"] in performances
    ]
    composition = llm.compose(tribe, examples)
    perf_id = db.create_performance(composition["title"], composition["notes"], is_generated=True, archetype="ia")
    db.run("MATCH (p:Performance {id: $id}) SET p.generatedText = $text, p.composedFor = $tribe",
           id=perf_id, text=composition["text"], tribe=tribe_id)

    new_perf = {"id": perf_id, "notes": composition["notes"]}
    if _cache.get("backend") == "aga" or (settings.backend == "aga" and aga.status == "ready"):
        try:
            all_perfs = db.fetch_performances()
            emb, _ = aga.run(all_perfs, 2, lambda _s: None)
            new_vecs = emb[perf_id]
        except Exception:
            log.exception("AGA falhou ao embutir a composição; usando local")
            new_vecs = {m: fastpath_local.embed_all([new_perf], settings.fastpath(m))[perf_id] for m in MODES}
    else:
        new_vecs = {m: fastpath_local.embed_all([new_perf], settings.fastpath(m))[perf_id] for m in MODES}

    ids = _cache["ids"]
    props: dict = {
        "emb_full": new_vecs["full"].tolist(), "emb_notes": new_vecs["notes"].tolist(),
        "factsJson": json.dumps(melody_facts(composition["notes"]), ensure_ascii=False),
        "notesPerSecond": melody_facts(composition["notes"])["notesPerSecond"],
        "resultsAt": int(time.time() * 1000),
    }
    sims = []
    landed = {}
    for m in MODES:
        r = _cache["results"][m]
        xy, tribe_index, neighbors = analytics.place(new_vecs[m], ids, r["matrix"], r["coords"], r["centroids"])
        props[f"x_{m}"], props[f"y_{m}"] = float(xy[0]), float(xy[1])
        props[f"tribe_{m}"] = f"{m}-{tribe_index}"
        landed[m] = f"{m}-{tribe_index}"
        matrix = np.vstack([r["matrix"], new_vecs[m]])
        candidates = [(perf_id, nid, s) for nid, s in neighbors]
        sims.extend(analytics.rerank(ids + [perf_id], matrix, candidates, 5, settings.cosine_weight, m))

    db.run("MATCH (p:Performance {id: $id}) SET p += $props", id=perf_id, props=props)
    db.run(
        """
        MATCH (p:Performance {id: $id})
        UNWIND $tribes AS t
        MATCH (tr:Tribe {id: t.tribe})
        CREATE (p)-[:IN_TRIBE {mode: t.mode}]->(tr)
        """,
        id=perf_id, tribes=[{"mode": m, "tribe": landed[m]} for m in MODES],
    )
    db.run(
        """
        UNWIND $sims AS s
        MATCH (a:Performance {id: s.source}), (b:Performance {id: s.target})
        CREATE (a)-[:SIMILAR_TO {mode: s.mode, rank: s.rank, cosine: s.cosine, euclidean: s.euclidean, score: s.score}]->(b)
        """,
        sims=sims,
    )
    return {
        "performanceId": perf_id,
        "title": composition["title"],
        "text": composition["text"],
        "generatedBy": composition["generatedBy"],
        "notes": composition["notes"],
        "targetTribe": tribe_id,
        "landedTribe": landed[mode],
        "landedInTarget": landed[mode] == tribe_id,
        "x": props[f"x_{mode}"],
        "y": props[f"y_{mode}"],
        "neighbors": [s for s in sims if s["mode"] == mode],
    }
