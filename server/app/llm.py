"""Generative AI layer. The LLM only ever narrates facts computed by the graph + FastPath."""

from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor

from .config import MAX_DURATION_MS, VERDICT_LABELS, settings
from .i18n import note
from .notes import NAME_TO_CODE, NOTES

log = logging.getLogger(__name__)

STYLE = (
    "Você é o narrador de uma demo ao vivo sobre o algoritmo FastPath (Neo4j Graph Data Science), "
    "que transforma sequências de eventos no tempo em embeddings. O público tocou melodias curtas num "
    "piano de 8 teclas (Dó a Dó agudo). Tom divertido, caloroso e curto. "
    "Use SOMENTE os fatos fornecidos; nunca invente músicas conhecidas, gêneros ou habilidades. "
    "Não use emojis."
)

LANG_RULE = {
    "pt": "Escreva em português do Brasil.",
    "en": "Write in natural English (the facts may come in Portuguese; translate them).",
    "both": (
        "Escreva os campos sem sufixo em português do Brasil e os campos terminados em _en em inglês natural, "
        "com o mesmo conteúdo e tom (adapte, não traduza palavra por palavra)."
    ),
}

_client = None


def enabled() -> bool:
    return bool(settings.openai_api_key)


def _openai():
    global _client
    if _client is None:
        from openai import OpenAI

        _client = OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
    return _client


def chat_json(task: str, payload: dict, temperature: float = 0.8, lang: str = "both") -> dict | None:
    if not enabled():
        return None
    try:
        response = _openai().chat.completions.create(
            model=settings.openai_model,
            temperature=temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": f"{STYLE} {LANG_RULE[lang]}"},
                {"role": "user", "content": f"{task}\n\nDados (JSON):\n{json.dumps(payload, ensure_ascii=False)}"},
            ],
        )
        return json.loads(response.choices[0].message.content or "{}")
    except Exception as exc:  # the stage must keep working without the LLM
        log.warning("LLM falhou: %s", exc)
        return None


def _both(item: dict, *fields: str) -> dict:
    """Keeps pt/en pairs, falling back to the Portuguese text when the English one is missing."""
    out = {}
    for f in fields:
        out[f] = item.get(f) or ""
        out[f"{f}_en"] = item.get(f"{f}_en") or out[f]
    return out


# ---------- tribes ----------

_TAG_NAMES = {
    "rápido": ("Velocistas do Teclado", "Muitas notas em pouco tempo: dedos que não param.",
               "Keyboard Sprinters", "Lots of notes in little time: fingers that never stop."),
    "contemplativo": ("Os Contemplativos", "Poucas notas, muito espaço entre elas. Cada tecla tem seu momento.",
                      "The Contemplatives", "Few notes, plenty of space between them. Every key gets its moment."),
    "sobe a escada": ("Escaladores", "Melodias que sobem, nota após nota.",
                      "Climbers", "Melodies that go up, note after note."),
    "desce a escada": ("Ladeira Abaixo", "Sequências que descem pelo teclado.",
                       "Downhill", "Sequences that run down the keyboard."),
    "ping-pong": ("Ping-Pong", "Duas notas indo e voltando, como uma bolinha.",
                  "Ping-Pong", "Two notes going back and forth, like a ball."),
    "silêncio e explosão": ("Silêncio e Explosão", "Começam com calma e terminam numa rajada.",
                            "Silence and Burst", "They start calm and end in a burst."),
    "metrônomo": ("Metrônomos Humanos", "Ritmo constante, quase uma máquina.",
                  "Human Metronomes", "Steady rhythm, almost a machine."),
    "agudo": ("Lá no Alto", "Preferem as teclas mais agudas.",
              "Up High", "They prefer the highest keys."),
    "grave": ("Graves Profundos", "Vivem no lado grave do teclado.",
              "Deep Lows", "They live on the low side of the keyboard."),
}


def name_tribes(tribes: list[dict]) -> dict[str, dict]:
    result = chat_json(
        "Dê um nome criativo (2 a 3 palavras) e uma descrição de uma frase curta para cada tribo musical, "
        "baseado nas estatísticas. Nomes devem ser distintos entre si. "
        "Compare as tribos entre si: 'rápida' só vale para quem tem notesPerSecond acima da média do conjunto, "
        "'lenta' ou 'contemplativa' para quem está abaixo. Destaque o que diferencia cada tribo das outras, "
        "e não repita a mesma característica em todas. "
        'Responda: {"tribes": [{"id": "...", "name": "...", "description": "...", "name_en": "...", "description_en": "..."}]}',
        {"tribes": [{"id": t["id"], **t["facts"]} for t in tribes]},
    )
    named = {t["id"]: t for t in (result or {}).get("tribes", []) if t.get("id")}
    if all(named.get(t["id"], {}).get("name") for t in tribes):
        return {t["id"]: _both(named[t["id"]], "name", "description") for t in tribes}

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
        name, desc, name_en, desc_en = _TAG_NAMES[tag]
        out[tribe_id] = {"name": name, "description": desc, "name_en": name_en, "description_en": desc_en}
        used.add(tag)
    for t in tribes:
        out.setdefault(t["id"], {
            "name": f"Tribo {t['index'] + 1}", "description": "Um jeito próprio de tocar.",
            "name_en": f"Tribe {t['index'] + 1}", "description_en": "A way of playing all its own.",
        })
    return out


# ---------- participant profiles ----------

_FALLBACK_TITLES = {
    "rápido": ("Dedos de Relâmpago", "Lightning Fingers"),
    "contemplativo": ("Alma Contemplativa", "Contemplative Soul"),
    "sobe a escada": ("Escalador de Notas", "Note Climber"),
    "desce a escada": ("Cachoeira Sonora", "Sound Waterfall"),
    "ping-pong": ("Mestre do Ping-Pong", "Ping-Pong Master"),
    "silêncio e explosão": ("Calmaria Antes da Tempestade", "Calm Before the Storm"),
    "metrônomo": ("Metrônomo Humano", "Human Metronome"),
    "agudo": ("Voz das Alturas", "Voice from Above"),
    "grave": ("Coração Grave", "Deep Heart"),
}


def _fallback_profile(p: dict) -> dict:
    f = p["facts"]
    tag = f["tags"][0] if f["tags"] else "original"
    title, title_en = _FALLBACK_TITLES.get(tag, ("Espírito Livre", "Free Spirit"))
    text = (
        f"Você tocou {f['noteCount']} notas em {f['durationSeconds']}s, com carinho especial por "
        f"{', '.join(f['favoriteNotes'][:2])}. O FastPath te colocou na tribo {p['tribeName']}"
        + (f" e sua alma gêmea musical é {p['soulmate']}." if p.get("soulmate") else ".")
    )
    text_en = (
        f"You played {f['noteCount']} notes in {f['durationSeconds']}s, with a soft spot for "
        f"{', '.join(note(n, 'en') for n in f['favoriteNotes'][:2])}. FastPath placed you in the {p['tribeName_en']} tribe"
        + (f" and your musical soulmate is {p['soulmate_en']}." if p.get("soulmate_en") else ".")
    )
    return {"title": title, "text": text, "title_en": title_en, "text_en": text_en}


def profiles(people: list[dict]) -> dict[str, dict]:
    keys = ("id", "name", "facts", "tribeName", "tribeName_en", "soulmate", "soulmate_en", "originality")

    def batch(chunk: list[dict]) -> dict[str, dict]:
        result = chat_json(
            "Para cada pessoa, crie um card de perfil musical: um título curto e marcante (2 a 4 palavras) "
            "e um texto de no máximo 2 frases que cite 1 ou 2 fatos concretos da melodia dela, a tribo e a "
            "alma gêmea musical (quando houver). Nos campos _en use tribeName_en e soulmate_en. "
            'Responda: {"profiles": [{"id": "...", "title": "...", "text": "...", "title_en": "...", "text_en": "..."}]}',
            {"people": [{k: p.get(k) for k in keys} for p in chunk]},
        )
        got = {r["id"]: r for r in (result or {}).get("profiles", []) if r.get("id")}
        return {p["id"]: _both(got[p["id"]], "title", "text") if got.get(p["id"], {}).get("title") else _fallback_profile(p) for p in chunk}

    chunks = [people[i : i + 8] for i in range(0, len(people), 8)]
    out: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        for part in pool.map(batch, chunks):
            out.update(part)
    return out


# ---------- explanation ----------

_TONE = {
    "very": "Pode celebrar: estão no nível dos melhores vizinhos que o FastPath encontrou.",
    "similar": "Tom sóbrio e criterioso: são parecidas no nível de um vizinho típico do KNN, nada excepcional. "
               "Diga o que coincide E o que ainda difere; não use adjetivos como 'interessante' ou 'forte'.",
    "weak": "Deixe claro que NÃO são realmente parecidas: a semelhança é fraca, abaixo do que o FastPath considera "
            "vizinhança. Foque no que as afasta; no máximo cite um ponto em comum.",
    "different": "Diga que são diferentes e explique o que as afasta. Nunca diga que são parecidas.",
}


def explain(a: dict, b: dict, scores: dict, mode_label: str, verdict: dict, lang: str = "pt") -> str:
    """`a` and `b` carry names and facts already rendered in `lang`."""
    label = verdict["label"]
    labels = VERDICT_LABELS[lang]
    th = verdict["thresholds"]
    ref = verdict.get("reference") or {}
    reference = (
        f"Referência desta rodada: o score típico entre vizinhos encontrados pelo KNN é {ref['knnMedian']:.2f} e o do melhor "
        f"vizinho de cada pessoa é {ref['bestNeighbourMedian']:.2f}. "
        if ref.get("knnMedian") is not None else ""
    )
    result = chat_json(
        "Explique para uma plateia leiga, em 2 a 3 frases, o resultado do FastPath para estas duas melodias "
        f"(modo: {mode_label}). Seja criterioso: parecido de verdade é raro. O veredito já está decidido pelos cortes de "
        f"score e você DEVE concordar com ele: as melodias são '{label}' (score {scores.get('score', 0):.2f}; cortes: "
        f"{labels['very']} >= {th['very']}, {labels['similar']} >= {th['similar']}, {labels['weak']} >= {th['weak']}, abaixo disso "
        f"{labels['different']}). {reference}{_TONE[verdict['level']]} "
        "Cosseno alto = mesmo padrão de notas no mesmo momento; euclidiana alta = intensidade parecida "
        "(quantidade/densidade de notas). Cite números concretos. "
        'Responda: {"text": "..."}',
        {"a": a, "b": b, "scores": scores, "veredito": label},
        temperature=0.5,
        lang=lang,
    )
    if result and result.get("text"):
        return result["text"]
    return _fallback_explain(a, b, scores, verdict, lang)


def _fallback_explain(a: dict, b: dict, scores: dict, verdict: dict, lang: str) -> str:
    label, th = verdict["label"], verdict["thresholds"]
    fa, fb = a["facts"], b["facts"]
    common = sorted(set(fa["favoriteNotes"]) & set(fb["favoriteNotes"]))
    cos, euc, score = scores.get("cosine", 0), scores.get("euclidean", 0), scores.get("score", 0)
    if lang == "en":
        if verdict["similar"]:
            return (
                f"{a['name']} and {b['name']} are {label} (score {score:.2f}, cut-off {th['similar']}). Cosine {cos:.2f}: "
                + (f"both leaned on {', '.join(common)} " if common else "similar patterns ")
                + f"at close moments. Paces of {fa['notesPerSecond']} and {fb['notesPerSecond']} notes per second "
                f"make the intensity alike (euclidean {euc:.2f})."
            )
        return (
            f"{a['name']} and {b['name']} are {label} (score {score:.2f}, below the {th['similar']} cut-off the KNN uses as neighbourhood). "
            f"Cosine {cos:.2f} shows the notes rarely line up at the same moment"
            + (f", even with {', '.join(common)} in common" if common else "")
            + f"; and {fa['notesPerSecond']} versus {fb['notesPerSecond']} notes per second give different intensities (euclidean {euc:.2f})."
        )
    if verdict["similar"]:
        return (
            f"{a['name']} e {b['name']} são {label} (score {score:.2f}, corte {th['similar']}). Cosseno {cos:.2f}: "
            + (f"os dois apostaram em {', '.join(common)} " if common else "padrões parecidos ")
            + f"em momentos próximos. Ritmos de {fa['notesPerSecond']} e {fb['notesPerSecond']} notas por segundo "
            f"deixam a intensidade parecida (euclidiana {euc:.2f})."
        )
    return (
        f"{a['name']} e {b['name']} são {label} (score {score:.2f}, abaixo do corte de {th['similar']} que o KNN usa como vizinhança). "
        f"Cosseno {cos:.2f} mostra que as notas raramente coincidem no mesmo momento"
        + (f", mesmo com {', '.join(common)} em comum" if common else "")
        + f"; e {fa['notesPerSecond']} contra {fb['notesPerSecond']} notas por segundo dão intensidades distintas (euclidiana {euc:.2f})."
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
    name_en = tribe.get("name_en") or tribe["name"]
    result = chat_json(
        "Componha uma melodia NOVA no estilo desta tribo, imitando o ritmo e as notas típicas dos exemplos "
        f"(sem copiá-los). Use apenas as notas {names}. 't' é o tempo em ms desde a primeira nota (começa em 0, "
        f"crescente, máximo {MAX_DURATION_MS - 500}). Entre 6 e 60 notas. Dê também um título curto e uma frase "
        "explicando a intenção. "
        'Responda: {"title": "...", "text": "...", "title_en": "...", "text_en": "...", "notes": [{"note": "C4", "t": 0}]}',
        {"tribe": {k: tribe.get(k) for k in ("name", "description", "name_en", "description_en", "facts")}, "examples": examples},
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
        texts = _both({**result, "title": result.get("title") or f"Hino da tribo {tribe['name']}"}, "title", "text")
        if not result.get("title_en"):
            texts["title_en"] = f"{name_en} anthem"
        return {**texts, "notes": [{"t": n["t"] - start, "code": n["code"]} for n in notes], "generatedBy": "llm"}
    return {
        "title": f"Hino da tribo {tribe['name']}",
        "text": "Composição de reserva (LLM indisponível): uma variação de uma melodia da própria tribo.",
        "title_en": f"{name_en} anthem",
        "text_en": "Fallback composition (LLM unavailable): a variation of a melody from the tribe itself.",
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
