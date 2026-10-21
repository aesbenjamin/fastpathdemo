"""Natural-language questions answered through a fixed catalog of parameterized Cypher queries."""

from __future__ import annotations

import re
import unicodedata

from . import db, llm

HUMAN = "NOT p.isBot AND NOT coalesce(p.isGenerated, false)"

CATALOG = {
    "mais_original": {
        "description": "Pessoas com melodias mais originais (longe de todo mundo)",
        "params": [],
        "cypher": f"""
            MATCH (p:Performance) WHERE {HUMAN} AND p.originality IS NOT NULL
            RETURN p.name AS pessoa, p.originality AS originalidade, p.profileTitle AS perfil
            ORDER BY originalidade DESC LIMIT 3""",
    },
    "par_mais_parecido": {
        "description": "As duas pessoas com melodias mais parecidas entre si",
        "params": [],
        "cypher": f"""
            MATCH (p:Performance)-[s:SIMILAR_TO {{mode: 'full'}}]->(q:Performance)
            WHERE {HUMAN} AND NOT q.isBot AND NOT coalesce(q.isGenerated, false) AND p.id < q.id
            RETURN p.name AS pessoa1, q.name AS pessoa2, s.cosine AS cosseno, s.euclidean AS euclidiana, s.score AS score
            ORDER BY score DESC LIMIT 3""",
    },
    "alma_gemea": {
        "description": "Quem tocou mais parecido com uma pessoa específica",
        "params": ["nome"],
        "cypher": """
            MATCH (p:Performance) WHERE toLower(p.name) CONTAINS toLower($nome)
            MATCH (p)-[s:SIMILAR_TO {mode: 'full'}]->(q:Performance)
            RETURN p.name AS pessoa, q.name AS parecido_com, q.isBot AS eh_bot, s.cosine AS cosseno, s.score AS score
            ORDER BY s.rank LIMIT 3""",
    },
    "tribo_de": {
        "description": "Em qual tribo uma pessoa caiu e quem mais está nela",
        "params": ["nome"],
        "cypher": """
            MATCH (p:Performance)-[:IN_TRIBE {mode: 'full'}]->(t:Tribe) WHERE toLower(p.name) CONTAINS toLower($nome)
            OPTIONAL MATCH (o:Performance)-[:IN_TRIBE {mode: 'full'}]->(t) WHERE o <> p AND NOT o.isBot
            RETURN p.name AS pessoa, t.name AS tribo, t.description AS descricao, collect(o.name)[0..8] AS colegas""",
    },
    "resumo_tribos": {
        "description": "Visão geral das tribos: nome, tamanho e velocidade média",
        "params": [],
        "cypher": """
            MATCH (t:Tribe {mode: 'full'})<-[:IN_TRIBE {mode: 'full'}]-(p:Performance)
            RETURN t.name AS tribo, t.description AS descricao, count(p) AS membros,
                   sum(CASE WHEN p.isBot THEN 0 ELSE 1 END) AS pessoas, round(avg(p.notesPerSecond), 2) AS notas_por_segundo
            ORDER BY membros DESC""",
    },
    "tribo_mais_rapida": {
        "description": "Qual tribo toca mais rápido (ou mais devagar)",
        "params": [],
        "cypher": """
            MATCH (t:Tribe {mode: 'full'})<-[:IN_TRIBE {mode: 'full'}]-(p:Performance)
            RETURN t.name AS tribo, round(avg(p.notesPerSecond), 2) AS notas_por_segundo, count(p) AS membros
            ORDER BY notas_por_segundo DESC""",
    },
    "ranking_velocidade": {
        "description": "Quem tocou mais rápido e quem tocou mais devagar",
        "params": [],
        "cypher": f"""
            MATCH (p:Performance) WHERE {HUMAN}
            WITH p ORDER BY p.notesPerSecond DESC
            WITH collect(p {{.name, .notesPerSecond, .noteCount}}) AS ps
            RETURN ps[0..3] AS mais_rapidos, reverse(ps)[0..3] AS mais_lentos""",
    },
    "nota_favorita": {
        "description": "A nota mais tocada pelo público",
        "params": [],
        "cypher": f"""
            MATCH (e:NoteEvent)-[:OF_NOTE]->(n:Note)
            MATCH (p:Performance {{id: e.perfId}}) WHERE {HUMAN}
            RETURN n.label AS nota, count(*) AS vezes ORDER BY vezes DESC LIMIT 8""",
    },
    "comparar": {
        "description": "Quão parecidas são as melodias de duas pessoas específicas",
        "params": ["nome1", "nome2"],
        "cypher": """
            MATCH (a:Performance) WHERE toLower(a.name) CONTAINS toLower($nome1) WITH a LIMIT 1
            MATCH (b:Performance) WHERE toLower(b.name) CONTAINS toLower($nome2) AND b <> a WITH a, b LIMIT 1
            RETURN a.name AS pessoa1, b.name AS pessoa2,
                   vector.similarity.cosine(a.emb_full, b.emb_full) AS similaridade_cosseno_normalizada,
                   a.tribe_full = b.tribe_full AS mesma_tribo""",
    },
    "numeros": {
        "description": "Números gerais da demo: pessoas, notas, tribos",
        "params": [],
        "cypher": f"""
            MATCH (p:Performance) WHERE {HUMAN}
            WITH count(p) AS pessoas, sum(p.noteCount) AS notas
            OPTIONAL MATCH (t:Tribe {{mode: 'full'}})
            RETURN pessoas, notas, count(t) AS tribos""",
    },
}

SUGGESTIONS = [
    "Quem foi a pessoa mais original?",
    "Quais duas pessoas tocaram mais parecido?",
    "Qual tribo toca mais rápido?",
    "Me fala sobre as tribos",
    "Qual foi a nota favorita do público?",
    "Quem tocou mais rápido e quem tocou mais devagar?",
]


def _plain(text: str) -> str:
    return unicodedata.normalize("NFKD", text.lower()).encode("ascii", "ignore").decode()


def _route_by_keywords(question: str) -> tuple[str, dict]:
    q = _plain(question)
    names = re.findall(r"(?:de|com|da|do|e)\s+([A-Z][\wÀ-ú]+)", question)
    if "original" in q or "diferent" in q:
        return "mais_original", {}
    if "nota" in q and ("favorit" in q or "mais tocad" in q):
        return "nota_favorita", {}
    if "tribo" in q and ("rapid" in q or "devagar" in q or "lent" in q):
        return "tribo_mais_rapida", {}
    if ("rapid" in q or "devagar" in q or "lent" in q):
        return "ranking_velocidade", {}
    if len(names) >= 2:
        return "comparar", {"nome1": names[0], "nome2": names[1]}
    if names and "tribo" in q:
        return "tribo_de", {"nome": names[0]}
    if names:
        return "alma_gemea", {"nome": names[0]}
    if "tribo" in q:
        return "resumo_tribos", {}
    if "parecid" in q or "similar" in q:
        return "par_mais_parecido", {}
    return "numeros", {}


def ask(question: str) -> dict:
    catalog = {k: {"description": v["description"], "params": v["params"]} for k, v in CATALOG.items()}
    routed = llm.chat_json(
        "Escolha a consulta do catálogo que responde à pergunta e extraia os parâmetros (nomes de pessoas como "
        'aparecem na pergunta). Responda: {"queryId": "...", "params": {...}}',
        {"pergunta": question, "catalogo": catalog},
        temperature=0,
    )
    query_id, params = (routed or {}).get("queryId"), (routed or {}).get("params") or {}
    if query_id not in CATALOG:
        query_id, params = _route_by_keywords(question)
    spec = CATALOG[query_id]
    params = {p: str(params.get(p, "")) for p in spec["params"]}
    rows = db.run(spec["cypher"], **params)

    answer = llm.chat_json(
        "Responda à pergunta da plateia em 1 a 3 frases, usando apenas o resultado da consulta ao grafo. "
        'Se o resultado estiver vazio, diga isso com bom humor. Responda: {"answer": "..."}',
        {"pergunta": question, "resultado": rows},
        temperature=0.7,
    )
    text = (answer or {}).get("answer") or _fallback_answer(query_id, rows)
    return {"question": question, "queryId": query_id, "params": params, "cypher": spec["cypher"].strip(), "rows": rows, "answer": text}


def _fallback_answer(query_id: str, rows: list[dict]) -> str:
    if not rows:
        return "O grafo ainda não tem dados para responder isso. Rode o FastPath primeiro!"
    r = rows[0]
    try:
        if query_id == "mais_original":
            others = ", ".join(x["pessoa"] for x in rows[1:])
            return f"{r['pessoa']} foi a pessoa mais original, com {r['originalidade']}% de originalidade." + (f" Logo atrás: {others}." if others else "")
        if query_id == "par_mais_parecido":
            return f"{r['pessoa1']} e {r['pessoa2']} tocaram quase igual: score {r['score']:.2f} (cosseno {r['cosseno']:.2f})."
        if query_id == "alma_gemea":
            mate = r["parecido_com"] + (" (um eco robô)" if r.get("eh_bot") else "")
            return f"A alma gêmea musical de {r['pessoa']} é {mate}, com cosseno {r['cosseno']:.2f}."
        if query_id == "tribo_de":
            mates = ", ".join(r["colegas"][:4])
            return f"{r['pessoa']} está na tribo {r['tribo']}." + (f" Junto com {mates}." if mates else "")
        if query_id == "resumo_tribos":
            return f"São {len(rows)} tribos. A maior é {r['tribo']}, com {r['membros']} melodias: {r['descricao']}"
        if query_id == "tribo_mais_rapida":
            last = rows[-1]
            return f"{r['tribo']} é a tribo mais rápida, com {r['notas_por_segundo']} notas por segundo. A mais calma é {last['tribo']} ({last['notas_por_segundo']})."
        if query_id == "ranking_velocidade":
            fast, slow = r["mais_rapidos"][0], r["mais_lentos"][0]
            return f"{fast['name']} foi a mais rápida ({fast['notesPerSecond']} notas/s) e {slow['name']} a mais calma ({slow['notesPerSecond']} notas/s)."
        if query_id == "nota_favorita":
            return f"A nota favorita do público foi {r['nota']}, tocada {r['vezes']} vezes."
        if query_id == "comparar":
            same = "e estão na mesma tribo" if r["mesma_tribo"] else "mas estão em tribos diferentes"
            return f"{r['pessoa1']} e {r['pessoa2']} têm similaridade {r['similaridade_cosseno_normalizada']:.2f} {same}."
        if query_id == "numeros":
            return f"Até agora: {r['pessoas']} pessoas, {r['notas']} notas e {r['tribos']} tribos no grafo."
    except (KeyError, IndexError, TypeError):
        pass
    return "Resultado: " + ", ".join(f"{k} = {v}" for k, v in r.items() if v is not None)
