"""Natural-language questions answered through a fixed catalog of parameterized Cypher queries."""

from __future__ import annotations

import re
import unicodedata

from . import db, i18n, llm

# By default only people count; $include_bots opens the queries to the echo bots and AI compositions.
HUMAN = "($include_bots OR (NOT p.isBot AND NOT coalesce(p.isGenerated, false)))"
HUMAN_Q = HUMAN.replace("p.", "q.")
HUMAN_O = HUMAN.replace("p.", "o.")
INCLUDE_BOTS = re.compile(
    r"\b(ecos?|rob[oô]s?|bots?|m[aá]quinas?|ias?|todos|todas|todo mundo|geral"
    r"|echo(es)?|robots?|machines?|ai|everyone|everybody|all)\b"
)

CATALOG = {
    "most_original": {
        "description": "Pessoas com melodias mais originais (longe de todo mundo)",
        "params": [],
        "cypher": f"""
            MATCH (p:Performance) WHERE {HUMAN} AND p.originality IS NOT NULL
            RETURN p.name AS person, p.originality AS originality, p.profileTitle AS profile
            ORDER BY originality DESC LIMIT 3""",
    },
    "most_similar_pair": {
        "description": "As duas pessoas com melodias mais parecidas entre si",
        "params": [],
        "cypher": f"""
            MATCH (p:Performance)-[s:SIMILAR_TO {{mode: 'full'}}]->(q:Performance)
            WHERE {HUMAN} AND {HUMAN_Q} AND p.id < q.id
            RETURN p.name AS person1, q.name AS person2, s.cosine AS cosine, s.euclidean AS euclidean, s.score AS score
            ORDER BY score DESC LIMIT 3""",
    },
    "soulmate": {
        "description": "Quem tocou mais parecido com uma pessoa específica",
        "params": ["name"],
        "cypher": """
            MATCH (p:Performance) WHERE toLower(p.name) CONTAINS toLower($name)
            MATCH (p)-[s:SIMILAR_TO {mode: 'full'}]->(q:Performance)
            RETURN p.name AS person, q.name AS similar_to, q.isBot AS is_bot, s.cosine AS cosine, s.score AS score
            ORDER BY s.rank LIMIT 3""",
    },
    "tribe_of": {
        "description": "Em qual tribo uma pessoa caiu e quem mais está nela",
        "params": ["name"],
        "cypher": f"""
            MATCH (p:Performance)-[:IN_TRIBE {{mode: 'full'}}]->(t:Tribe) WHERE toLower(p.name) CONTAINS toLower($name)
            OPTIONAL MATCH (o:Performance)-[:IN_TRIBE {{mode: 'full'}}]->(t) WHERE o <> p AND {HUMAN_O}
            RETURN p.name AS person, t.name AS tribe, t.description AS description, collect(o.name)[0..8] AS peers""",
    },
    "tribes_summary": {
        "description": "Visão geral das tribos: nome, tamanho e velocidade média",
        "params": [],
        "cypher": """
            MATCH (t:Tribe {mode: 'full'})<-[:IN_TRIBE {mode: 'full'}]-(p:Performance)
            RETURN t.name AS tribe, t.description AS description, count(p) AS members,
                   sum(CASE WHEN p.isBot THEN 0 ELSE 1 END) AS people, round(avg(p.notesPerSecond), 2) AS notes_per_second
            ORDER BY members DESC""",
    },
    "fastest_tribe": {
        "description": "Qual tribo toca mais rápido (ou mais devagar)",
        "params": [],
        "cypher": """
            MATCH (t:Tribe {mode: 'full'})<-[:IN_TRIBE {mode: 'full'}]-(p:Performance)
            RETURN t.name AS tribe, round(avg(p.notesPerSecond), 2) AS notes_per_second, count(p) AS members
            ORDER BY notes_per_second DESC""",
    },
    "speed_ranking": {
        "description": "Quem tocou mais rápido e quem tocou mais devagar",
        "params": [],
        "cypher": f"""
            MATCH (p:Performance) WHERE {HUMAN} AND p.notesPerSecond IS NOT NULL
            WITH p ORDER BY p.notesPerSecond DESC
            WITH collect(p {{.name, .notesPerSecond, .noteCount}}) AS ps
            RETURN ps[0..3] AS fastest, reverse(ps)[0..3] AS slowest""",
    },
    "favorite_note": {
        "description": "A nota mais tocada pelo público",
        "params": [],
        "cypher": f"""
            MATCH (e:NoteEvent)-[:OF_NOTE]->(n:Note)
            MATCH (p:Performance {{id: e.perfId}}) WHERE {HUMAN}
            RETURN n.label AS note, count(*) AS times ORDER BY times DESC LIMIT 8""",
    },
    "compare": {
        "description": "Quão parecidas são as melodias de duas pessoas específicas",
        "params": ["name1", "name2"],
        "cypher": """
            MATCH (a:Performance) WHERE toLower(a.name) CONTAINS toLower($name1) WITH a LIMIT 1
            MATCH (b:Performance) WHERE toLower(b.name) CONTAINS toLower($name2) AND b <> a WITH a, b LIMIT 1
            RETURN a.name AS person1, b.name AS person2,
                   vector.similarity.cosine(a.emb_full, b.emb_full) AS normalized_cosine,
                   a.tribe_full = b.tribe_full AS same_tribe""",
    },
    "numbers": {
        "description": "Números gerais da demo: pessoas, notas, tribos",
        "params": [],
        "cypher": f"""
            MATCH (p:Performance) WHERE {HUMAN}
            WITH count(p) AS people, sum(p.noteCount) AS notes
            OPTIONAL MATCH (t:Tribe {{mode: 'full'}})
            RETURN people, notes, count(t) AS tribes""",
    },
}

SUGGESTIONS = {
    "pt": [
        "Quem foi a pessoa mais original?",
        "Quais duas pessoas tocaram mais parecido?",
        "Qual tribo toca mais rápido?",
        "Me fala sobre as tribos",
        "Qual foi a nota favorita do público?",
        "Quem tocou mais rápido e quem tocou mais devagar?",
    ],
    "en": [
        "Who was the most original person?",
        "Which two people played most alike?",
        "Which tribe plays the fastest?",
        "Tell me about the tribes",
        "What was the audience's favorite note?",
        "Who played the fastest and who played the slowest?",
    ],
}


def suggestions(lang: str) -> list[str]:
    return SUGGESTIONS[i18n.norm_lang(lang)]


def _plain(text: str) -> str:
    return unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode()


_NOT_NAMES = {"Who", "What", "Which", "That", "It", "There", "Quem", "Qual"}


def _names(question: str) -> list[str]:
    found = re.findall(r"\b(?:de|com|da|do|e|entre|of|with|and|between|compare)\s+([A-Z][\wÀ-ú]+)", question, flags=re.I)
    found = [n for n in found if n[0].isupper()]
    found += re.findall(r"\b([A-Z][\wÀ-ú]+)'s\b", question)
    return [n for n in dict.fromkeys(found) if n not in _NOT_NAMES]


def _route_by_keywords(question: str) -> tuple[str, dict]:
    q = _plain(question)
    names = _names(question)
    tribe = "tribo" in q or "tribe" in q
    speed = any(w in q for w in ("rapid", "devagar", "lent", "fast", "slow", "quick"))
    if "original" in q or "diferent" in q or "unique" in q:
        return "most_original", {}
    if ("nota" in q or "note" in q) and any(w in q for w in ("favorit", "mais tocad", "most played")):
        return "favorite_note", {}
    if tribe and speed:
        return "fastest_tribe", {}
    if speed:
        return "speed_ranking", {}
    if len(names) >= 2:
        return "compare", {"name1": names[0], "name2": names[1]}
    if names and tribe:
        return "tribe_of", {"name": names[0]}
    if names:
        return "soulmate", {"name": names[0]}
    if tribe:
        return "tribes_summary", {}
    if any(w in q for w in ("parecid", "similar", "alike")):
        return "most_similar_pair", {}
    return "numbers", {}


def _english_rows(rows: list[dict]) -> list[dict]:
    """Swaps Portuguese text stored in the graph (tribe names, descriptions, profiles) for its English version."""
    pairs = db.run(
        """
        MATCH (t:Tribe) RETURN t.name AS pt, t.name_en AS en
        UNION MATCH (t:Tribe) RETURN t.description AS pt, t.description_en AS en
        UNION MATCH (p:Performance) RETURN p.profileTitle AS pt, p.profileTitle_en AS en
        """
    )
    lookup = {r["pt"]: r["en"] for r in pairs if r["pt"] and r["en"]}

    def swap(v, key: str = ""):
        if isinstance(v, str):
            if key == "note":
                return i18n.note(v, "en")
            return lookup.get(v) or i18n.bot_name(v, "en")
        if isinstance(v, list):
            return [swap(x, key) for x in v]
        if isinstance(v, dict):
            return {k: swap(x, k) for k, x in v.items()}
        return v

    return [swap(r) for r in rows]


def ask(question: str, lang: str = "pt") -> dict:
    lang = i18n.norm_lang(lang)
    catalog = {k: {"description": v["description"], "params": v["params"]} for k, v in CATALOG.items()}
    routed = llm.chat_json(
        "Escolha a consulta do catálogo que responde à pergunta (que pode vir em português ou inglês) e extraia os "
        "parâmetros (nomes de pessoas como aparecem na pergunta). Por padrão as consultas olham só os humanos; se a "
        "pergunta pedir para considerar também os ecos/robôs/bots/melodias da IA ou 'todo mundo', inclua "
        '"include_bots": true nos params. Responda: {"queryId": "...", "params": {...}}',
        {"pergunta": question, "catalogo": catalog},
        temperature=0,
        lang="pt",
    )
    query_id, params = (routed or {}).get("queryId"), (routed or {}).get("params") or {}
    include_bots = bool(params.get("include_bots")) or bool(INCLUDE_BOTS.search(_plain(question)))
    if query_id not in CATALOG:
        query_id, params = _route_by_keywords(question)
    spec = CATALOG[query_id]
    params = {p: str(params.get(p, "")) for p in spec["params"]}
    rows = db.run(spec["cypher"], include_bots=include_bots, **params)
    if lang == "en" and rows:
        rows = _english_rows(rows)
    params["include_bots"] = include_bots

    bots_hint = {
        "pt": "Nomes que começam com 'Eco' são robôs; mencione quando um resultado for robô. " if include_bots else "A consulta considerou só humanos. ",
        "en": "Names starting with 'Echo' are bots; mention when a result is a bot. " if include_bots else "The query only considered humans. ",
    }[lang]
    answer = llm.chat_json(
        "Responda à pergunta da plateia em 1 a 3 frases, usando apenas o resultado da consulta ao grafo. "
        + bots_hint
        + 'Se o resultado estiver vazio, diga isso com bom humor. Responda: {"answer": "..."}',
        {"pergunta": question, "resultado": rows, "incluiu_robos": include_bots},
        temperature=0.7,
        lang=lang,
    )
    text = (answer or {}).get("answer") or _fallback_answer(query_id, rows, lang)
    return {"question": question, "queryId": query_id, "params": params, "cypher": spec["cypher"].strip(), "rows": rows, "answer": text}


_FALLBACK = {
    "pt": {
        "empty": "O grafo ainda não tem dados para responder isso. Rode o FastPath primeiro!",
        "most_original": "{person} foi a pessoa mais original, com {originality}% de originalidade.",
        "most_original_more": " Logo atrás: {others}.",
        "most_similar_pair": "{person1} e {person2} tocaram quase igual: score {score:.2f} (cosseno {cosine:.2f}).",
        "soulmate": "A alma gêmea musical de {person} é {mate}, com cosseno {cosine:.2f}.",
        "bot": " (um eco robô)",
        "tribe_of": "{person} está na tribo {tribe}.",
        "tribe_of_more": " Junto com {mates}.",
        "tribes_summary": "São {n} tribos. A maior é {tribe}, com {members} melodias: {description}",
        "fastest_tribe": "{tribe} é a tribo mais rápida, com {nps} notas por segundo. A mais calma é {last} ({last_nps}).",
        "speed_ranking": "{fast} foi a mais rápida ({fast_nps} notas/s) e {slow} a mais calma ({slow_nps} notas/s).",
        "favorite_note": "A nota favorita do público foi {note}, tocada {times} vezes.",
        "compare_same": "e estão na mesma tribo",
        "compare_diff": "mas estão em tribos diferentes",
        "compare": "{person1} e {person2} têm similaridade {sim:.2f} {same}.",
        "numbers": "Até agora: {people} pessoas, {notes} notas e {tribes} tribos no grafo.",
        "raw": "Resultado: ",
    },
    "en": {
        "empty": "The graph has no data to answer that yet. Run FastPath first!",
        "most_original": "{person} was the most original person, with {originality}% originality.",
        "most_original_more": " Right behind: {others}.",
        "most_similar_pair": "{person1} and {person2} played almost the same: score {score:.2f} (cosine {cosine:.2f}).",
        "soulmate": "{person}'s musical soulmate is {mate}, with cosine {cosine:.2f}.",
        "bot": " (an echo bot)",
        "tribe_of": "{person} is in the {tribe} tribe.",
        "tribe_of_more": " Along with {mates}.",
        "tribes_summary": "There are {n} tribes. The biggest is {tribe}, with {members} melodies: {description}",
        "fastest_tribe": "{tribe} is the fastest tribe, with {nps} notes per second. The calmest is {last} ({last_nps}).",
        "speed_ranking": "{fast} was the fastest ({fast_nps} notes/s) and {slow} the calmest ({slow_nps} notes/s).",
        "favorite_note": "The audience's favorite note was {note}, played {times} times.",
        "compare_same": "and are in the same tribe",
        "compare_diff": "but are in different tribes",
        "compare": "{person1} and {person2} have similarity {sim:.2f} {same}.",
        "numbers": "So far: {people} people, {notes} notes and {tribes} tribes in the graph.",
        "raw": "Result: ",
    },
}


def _fallback_answer(query_id: str, rows: list[dict], lang: str = "pt") -> str:
    m = _FALLBACK[lang]
    if not rows:
        return m["empty"]
    r = rows[0]
    try:
        if query_id == "most_original":
            others = ", ".join(x["person"] for x in rows[1:])
            return m["most_original"].format(**r) + (m["most_original_more"].format(others=others) if others else "")
        if query_id == "most_similar_pair":
            return m["most_similar_pair"].format(**r)
        if query_id == "soulmate":
            return m["soulmate"].format(person=r["person"], mate=r["similar_to"] + (m["bot"] if r.get("is_bot") else ""), cosine=r["cosine"])
        if query_id == "tribe_of":
            mates = ", ".join(r["peers"][:4])
            return m["tribe_of"].format(**r) + (m["tribe_of_more"].format(mates=mates) if mates else "")
        if query_id == "tribes_summary":
            return m["tribes_summary"].format(n=len(rows), **r)
        if query_id == "fastest_tribe":
            last = rows[-1]
            return m["fastest_tribe"].format(tribe=r["tribe"], nps=r["notes_per_second"], last=last["tribe"], last_nps=last["notes_per_second"])
        if query_id == "speed_ranking":
            fast, slow = r["fastest"][0], r["slowest"][0]
            return m["speed_ranking"].format(fast=fast["name"], fast_nps=fast["notesPerSecond"], slow=slow["name"], slow_nps=slow["notesPerSecond"])
        if query_id == "favorite_note":
            return m["favorite_note"].format(**r)
        if query_id == "compare":
            same = m["compare_same"] if r["same_tribe"] else m["compare_diff"]
            return m["compare"].format(person1=r["person1"], person2=r["person2"], sim=r["normalized_cosine"], same=same)
        if query_id == "numbers":
            return m["numbers"].format(**r)
    except (KeyError, IndexError, TypeError, ValueError):
        pass
    return m["raw"] + ", ".join(f"{k} = {v}" for k, v in r.items() if v is not None)
