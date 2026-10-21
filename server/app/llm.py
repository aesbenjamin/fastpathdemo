"""Generative AI layer. The LLM only ever narrates facts computed by the graph + FastPath."""

from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor

from .config import MAX_DURATION_MS, settings
from .notes import NAME_TO_CODE, NOTES

log = logging.getLogger(__name__)

STYLE = (
    "Você é o narrador de uma demo ao vivo sobre o algoritmo FastPath (Neo4j Graph Data Science), "
    "que transforma sequências de eventos no tempo em embeddings. O público tocou melodias curtas num "
    "piano de 8 teclas (Dó a Dó agudo). Escreva em português do Brasil, tom divertido, caloroso e curto. "
    "Use SOMENTE os fatos fornecidos; nunca invente músicas conhecidas, gêneros ou habilidades. "
    "Não use emojis."
)

_client = None


def enabled() -> bool:
    return bool(settings.openai_api_key)


def _openai():
    global _client
    if _client is None:
        from openai import OpenAI

        _client = OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
    return _client


def chat_json(task: str, payload: dict, temperature: float = 0.8) -> dict | None:
    if not enabled():
        return None
    try:
        response = _openai().chat.completions.create(
            model=settings.openai_model,
            temperature=temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": STYLE},
                {"role": "user", "content": f"{task}\n\nDados (JSON):\n{json.dumps(payload, ensure_ascii=False)}"},
            ],
        )
        return json.loads(response.choices[0].message.content or "{}")
    except Exception as exc:  # the stage must keep working without the LLM
        log.warning("LLM falhou: %s", exc)
        return None


# ---------- tribes ----------

_TAG_NAMES = {
    "rápido": ("Velocistas do Teclado", "Muitas notas em pouco tempo: dedos que não param."),
    "contemplativo": ("Os Contemplativos", "Poucas notas, muito espaço entre elas. Cada tecla tem seu momento."),
    "sobe a escada": ("Escaladores", "Melodias que sobem, nota após nota."),
    "desce a escada": ("Ladeira Abaixo", "Sequências que descem pelo teclado."),
    "ping-pong": ("Ping-Pong", "Duas notas indo e voltando, como uma bolinha."),
    "silêncio e explosão": ("Silêncio e Explosão", "Começam com calma e terminam numa rajada."),
    "metrônomo": ("Metrônomos Humanos", "Ritmo constante, quase uma máquina."),
    "agudo": ("Lá no Alto", "Preferem as teclas mais agudas."),
    "grave": ("Graves Profundos", "Vivem no lado grave do teclado."),
}


def name_tribes(tribes: list[dict]) -> dict[str, dict]:
    result = chat_json(
        "Dê um nome criativo (2 a 4 palavras) e uma descrição de uma frase para cada tribo musical, "
        "baseado nas estatísticas. Nomes devem ser distintos entre si. "
        'Responda: {"tribes": [{"id": "...", "name": "...", "description": "..."}]}',
        {"tribes": [{"id": t["id"], **t["facts"]} for t in tribes]},
    )
    named = {t["id"]: t for t in (result or {}).get("tribes", []) if t.get("id")}
    if all(named.get(t["id"], {}).get("name") for t in tribes):
        return {t["id"]: {"name": named[t["id"]]["name"], "description": named[t["id"]].get("description", "")} for t in tribes}

    # Fallback: name each tribe after the tag that is most over-represented in it, greedily and uniquely.
    total = sum(t["facts"]["size"] for t in tribes)
    overall: dict[str, float] = {}
    for t in tribes:
        for tag, share in t["facts"].get("tagShare", {}).items():
            overall[tag] = overall.get(tag, 0.0) + share * t["facts"]["size"] / total
    candidates = sorted(
        ((share - overall.get(tag, 0.0), t["id"], tag) for t in tribes for tag, share in t["facts"].get("tagShare", {}).items() if tag in _TAG_NAMES),
        reverse=True,
    )
    out: dict[str, dict] = {}
    used: set[str] = set()
    for _, tribe_id, tag in candidates:
        if tribe_id in out or tag in used:
            continue
        name, desc = _TAG_NAMES[tag]
        out[tribe_id] = {"name": name, "description": desc}
        used.add(tag)
    for t in tribes:
        out.setdefault(t["id"], {"name": f"Tribo {t['index'] + 1}", "description": "Um jeito próprio de tocar."})
    return out


# ---------- participant profiles ----------

def _fallback_profile(p: dict) -> dict:
    f = p["facts"]
    tag = f["tags"][0] if f["tags"] else "original"
    title = {
        "rápido": "Dedos de Relâmpago",
        "contemplativo": "Alma Contemplativa",
        "sobe a escada": "Escalador de Notas",
        "desce a escada": "Cachoeira Sonora",
        "ping-pong": "Mestre do Ping-Pong",
        "silêncio e explosão": "Calmaria Antes da Tempestade",
        "metrônomo": "Metrônomo Humano",
        "agudo": "Voz das Alturas",
        "grave": "Coração Grave",
    }.get(tag, "Espírito Livre")
    text = (
        f"Você tocou {f['noteCount']} notas em {f['durationSeconds']}s, com carinho especial por "
        f"{', '.join(f['favoriteNotes'][:2])}. O FastPath te colocou na tribo {p['tribeName']}"
        + (f" e sua alma gêmea musical é {p['soulmate']}." if p.get("soulmate") else ".")
    )
    return {"title": title, "text": text}


def profiles(people: list[dict]) -> dict[str, dict]:
    def batch(chunk: list[dict]) -> dict[str, dict]:
        result = chat_json(
            "Para cada pessoa, crie um card de perfil musical: um título curto e marcante (2 a 4 palavras) "
            "e um texto de no máximo 2 frases que cite 1 ou 2 fatos concretos da melodia dela, a tribo e a "
            "alma gêmea musical (quando houver). "
            'Responda: {"profiles": [{"id": "...", "title": "...", "text": "..."}]}',
            {"people": [{k: p[k] for k in ("id", "name", "facts", "tribeName", "soulmate", "originality")} for p in chunk]},
        )
        got = {r["id"]: r for r in (result or {}).get("profiles", []) if r.get("id")}
        return {p["id"]: got.get(p["id"]) or _fallback_profile(p) for p in chunk}

    chunks = [people[i : i + 8] for i in range(0, len(people), 8)]
    out: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        for part in pool.map(batch, chunks):
            out.update(part)
    return out


# ---------- explanation ----------

def explain(a: dict, b: dict, scores: dict, mode_label: str) -> str:
    result = chat_json(
        "Explique para uma plateia leiga, em 2 a 3 frases, por que o FastPath considerou estas duas melodias "
        f"parecidas (modo: {mode_label}). Cosseno alto = mesmo padrão de notas no mesmo momento; "
        "euclidiana alta = intensidade parecida (quantidade/densidade de notas). Cite números concretos. "
        'Responda: {"text": "..."}',
        {"a": a, "b": b, "scores": scores},
        temperature=0.6,
    )
    if result and result.get("text"):
        return result["text"]
    fa, fb = a["facts"], b["facts"]
    common = sorted(set(fa["favoriteNotes"]) & set(fb["favoriteNotes"]))
    return (
        f"{a['name']} e {b['name']} têm cosseno {scores.get('cosine', 0):.2f}: "
        + (f"os dois apostaram em {', '.join(common)} " if common else "padrões parecidos ")
        + f"em momentos próximos. Ritmos de {fa['notesPerSecond']} e {fb['notesPerSecond']} notas por segundo "
        f"deixam a intensidade parecida (euclidiana {scores.get('euclidean', 0):.2f})."
    )


# ---------- composition ----------

_FALLBACK_SHAPES = {
    "rápido": [(i * 140, c) for i, c in enumerate([2, 4, 3, 5, 4, 6, 5, 7, 6, 4, 5, 3, 4, 2, 3, 1, 2, 0] * 2)],
    "contemplativo": [(i * 1500, c) for i, c in enumerate([0, 2, 1, 4, 2, 0, 3, 1])],
    "sobe a escada": [(i * 320, c) for i, c in enumerate(list(range(8)) * 3)],
    "ping-pong": [(i * 260, c) for i, c in enumerate([4, 7] * 14)],
    "silêncio e explosão": [(0, 0), (900, 2)] + [(8000 + i * 120, c) for i, c in enumerate([7, 5, 6, 4, 7, 6, 5, 7] * 3)],
}


def compose(tribe: dict, examples: list[list[dict]]) -> dict:
    names = [n["name"] for n in NOTES]
    result = chat_json(
        "Componha uma melodia NOVA no estilo desta tribo, imitando o ritmo e as notas típicas dos exemplos "
        f"(sem copiá-los). Use apenas as notas {names}. 't' é o tempo em ms desde a primeira nota (começa em 0, "
        f"crescente, máximo {MAX_DURATION_MS - 500}). Entre 6 e 60 notas. Dê também um título curto e uma frase "
        "explicando a intenção. "
        'Responda: {"title": "...", "text": "...", "notes": [{"note": "C4", "t": 0}]}',
        {"tribe": {k: tribe[k] for k in ("name", "description", "facts")}, "examples": examples},
        temperature=0.9,
    )
    notes = []
    for n in (result or {}).get("notes", []):
        code = NAME_TO_CODE.get(str(n.get("note", "")).upper())
        try:
            t = float(n.get("t"))
        except (TypeError, ValueError):
            continue
        if code is not None and 0 <= t < MAX_DURATION_MS:
            notes.append({"t": t, "code": code})
    notes.sort(key=lambda n: n["t"])
    if len(notes) >= 3:
        start = notes[0]["t"]
        return {
            "title": result.get("title") or f"Hino da tribo {tribe['name']}",
            "text": result.get("text") or "",
            "notes": [{"t": n["t"] - start, "code": n["code"]} for n in notes],
            "generatedBy": "llm",
        }
    return {
        "title": f"Hino da tribo {tribe['name']}",
        "text": "Composição de reserva (LLM indisponível): uma variação de uma melodia da própria tribo.",
        "notes": _variation(examples) if examples else [
            {"t": float(t), "code": c}
            for t, c in _FALLBACK_SHAPES[next((t for t in tribe["facts"]["commonTags"] if t in _FALLBACK_SHAPES), "sobe a escada")]
        ],
        "generatedBy": "template",
    }


def _variation(examples: list[list[dict]]) -> list[dict]:
    import random

    rng = random.Random(len(examples[0]))
    out = []
    for n in examples[0]:
        code = NAME_TO_CODE[n["note"]]
        if rng.random() < 0.2:
            code = min(7, max(0, code + rng.choice([-1, 1])))
        out.append({"t": min(float(n["t"]) * rng.uniform(0.92, 1.08), MAX_DURATION_MS - 500), "code": code})
    out.sort(key=lambda n: n["t"])
    start = out[0]["t"]
    return [{"t": n["t"] - start, "code": n["code"]} for n in out]
