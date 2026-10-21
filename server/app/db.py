from __future__ import annotations

import uuid
from typing import Any

from neo4j import GraphDatabase

from .config import OBSERVATION_TIME, settings
from .notes import NOTES

_driver = None


def driver():
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password))
    return _driver


def run(query: str, **params: Any) -> list[dict]:
    records, _, _ = driver().execute_query(query, params, database_=settings.neo4j_database)
    return [r.data() for r in records]


def ensure_schema() -> None:
    run("CREATE CONSTRAINT performance_id IF NOT EXISTS FOR (p:Performance) REQUIRE p.id IS UNIQUE")
    run("CREATE CONSTRAINT note_code IF NOT EXISTS FOR (n:Note) REQUIRE n.code IS UNIQUE")
    run("CREATE CONSTRAINT tribe_id IF NOT EXISTS FOR (t:Tribe) REQUIRE t.id IS UNIQUE")
    run("CREATE INDEX note_event_perf IF NOT EXISTS FOR (e:NoteEvent) ON (e.perfId)")
    run(
        "UNWIND $notes AS n MERGE (note:Note {code: n.code}) SET note.name = n.name, note.label = n.label",
        notes=NOTES,
    )


CREATE_PERFORMANCE = """
CREATE (p:Performance {
  id: $id, name: $name, createdAt: datetime(), durationMs: $durationMs,
  noteCount: size($notes), obsTime: $obsTime,
  isBot: $isBot, isGenerated: $isGenerated, archetype: $archetype
})
WITH p
UNWIND range(0, size($notes) - 1) AS i
WITH p, i, $notes[i] AS n
MATCH (note:Note {code: n.code})
CREATE (e:NoteEvent {t: n.t, noteCode: n.code, seq: i, perfId: p.id})
CREATE (e)-[:OF_NOTE]->(note)
WITH p, e ORDER BY e.seq
WITH p, collect(e) AS events
CALL (p, events) {
  WITH p, events[0] AS first
  CREATE (p)-[:FIRST_EVENT]->(first)
}
CALL (events) {
  UNWIND range(0, size(events) - 2) AS i
  WITH events[i] AS a, events[i + 1] AS b
  CREATE (a)-[:NEXT_EVENT]->(b)
}
RETURN p.id AS id
"""


def create_performance(
    name: str,
    notes: list[dict],
    *,
    is_bot: bool = False,
    is_generated: bool = False,
    archetype: str | None = None,
    perf_id: str | None = None,
) -> str:
    perf_id = perf_id or str(uuid.uuid4())
    notes = sorted(notes, key=lambda n: n["t"])
    run(
        CREATE_PERFORMANCE,
        id=perf_id,
        name=name,
        notes=[{"t": float(n["t"]), "code": int(n["code"])} for n in notes],
        durationMs=float(notes[-1]["t"]) if notes else 0.0,
        obsTime=float(OBSERVATION_TIME),
        isBot=is_bot,
        isGenerated=is_generated,
        archetype=archetype,
    )
    return perf_id


def fetch_performances() -> list[dict]:
    rows = run(
        """
        MATCH (p:Performance)
        CALL (p) {
          MATCH (e:NoteEvent {perfId: p.id})
          WITH e ORDER BY e.seq
          RETURN collect({t: e.t, code: e.noteCode}) AS notes
        }
        RETURN p {
          .id, .name, .isBot, .isGenerated, .archetype, .durationMs, .noteCount,
          .profileTitle, .profileText, .originality,
          .x_full, .y_full, .x_notes, .y_notes, .tribe_full, .tribe_notes,
          createdAt: toString(p.createdAt), nodeId: id(p)
        } AS p, notes
        ORDER BY p.createdAt
        """
    )
    return [{**r["p"], "notes": r["notes"]} for r in rows if r["notes"]]


def fetch_embeddings() -> dict[str, dict[str, list[float]]]:
    rows = run("MATCH (p:Performance) WHERE p.emb_full IS NOT NULL RETURN p.id AS id, p.emb_full AS full, p.emb_notes AS notes")
    return {r["id"]: {"full": r["full"], "notes": r["notes"]} for r in rows}


def fetch_tribes() -> list[dict]:
    return [r["t"] for r in run("MATCH (t:Tribe) RETURN t {.*} AS t ORDER BY t.mode, t.index")]


def fetch_similar() -> list[dict]:
    return run(
        """
        MATCH (a:Performance)-[s:SIMILAR_TO]->(b:Performance)
        RETURN a.id AS source, b.id AS target, s.mode AS mode, s.rank AS rank,
               s.cosine AS cosine, s.euclidean AS euclidean, s.score AS score, s.explanation AS explanation
        """
    )


def lobby() -> dict:
    rows = run(
        """
        MATCH (p:Performance) WHERE NOT p.isBot AND NOT p.isGenerated
        WITH p ORDER BY p.createdAt DESC
        WITH collect(p {.id, .name, .noteCount, createdAt: toString(p.createdAt)}) AS people
        RETURN size(people) AS count, people[0..24] AS recent
        """
    )
    bots = run("MATCH (p:Performance) WHERE p.isBot RETURN count(p) AS c")[0]["c"]
    notes = run("MATCH (e:NoteEvent) RETURN count(e) AS c")[0]["c"]
    return {**rows[0], "bots": bots, "totalNotes": notes}


def clear_results() -> None:
    run("MATCH ()-[s:SIMILAR_TO]->() DELETE s")
    run("MATCH (t:Tribe) DETACH DELETE t")


def write_results(perf_rows: list[dict], tribes: list[dict], similar: list[dict]) -> None:
    clear_results()
    run(
        """
        UNWIND $rows AS r
        MATCH (p:Performance {id: r.id})
        SET p += r.props
        """,
        rows=perf_rows,
    )
    run(
        """
        UNWIND $tribes AS t
        CREATE (tr:Tribe) SET tr = t
        WITH tr
        MATCH (p:Performance) WHERE p.id IN tr.memberIds
        CREATE (p)-[:IN_TRIBE {mode: tr.mode}]->(tr)
        """,
        tribes=tribes,
    )
    run("MATCH (t:Tribe) REMOVE t.memberIds")
    run(
        """
        UNWIND $sims AS s
        MATCH (a:Performance {id: s.source}), (b:Performance {id: s.target})
        CREATE (a)-[:SIMILAR_TO {mode: s.mode, rank: s.rank, cosine: s.cosine, euclidean: s.euclidean, score: s.score}]->(b)
        """,
        sims=similar,
    )


def save_explanation(source: str, target: str, mode: str, text: str) -> None:
    run(
        """
        MATCH (:Performance {id: $a})-[s:SIMILAR_TO {mode: $mode}]-(:Performance {id: $b})
        SET s.explanation = $text
        """,
        a=source,
        b=target,
        mode=mode,
        text=text,
    )


def delete_performances(where: str) -> int:
    rows = run(
        f"""
        MATCH (p:Performance) WHERE {where}
        WITH collect(p.id) AS ids
        CALL (ids) {{ MATCH (e:NoteEvent) WHERE e.perfId IN ids DETACH DELETE e }}
        CALL (ids) {{ MATCH (p:Performance) WHERE p.id IN ids DETACH DELETE p }}
        RETURN size(ids) AS n
        """
    )
    return rows[0]["n"] if rows else 0
