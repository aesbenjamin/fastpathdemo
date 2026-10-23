import neo4j, { type Driver } from 'neo4j-driver'
import { MAX_DURATION_MS, type NoteEvent } from './notes'

let driver: Driver | null = null

function getDriver(): Driver {
  if (!driver) {
    const uri = import.meta.env.VITE_NEO4J_URI
    if (!uri) throw new Error('i18n:neo4j_not_configured')
    driver = neo4j.driver(
      uri,
      neo4j.auth.basic(import.meta.env.VITE_NEO4J_USER || 'neo4j', import.meta.env.VITE_NEO4J_PASSWORD || ''),
      { disableLosslessIntegers: true },
    )
  }
  return driver
}

const database = import.meta.env.VITE_NEO4J_DATABASE || undefined

const CREATE_PERFORMANCE = `
CREATE (p:Performance {
  id: $id, name: $name, createdAt: datetime(), durationMs: $durationMs,
  noteCount: size($notes), obsTime: $obsTime,
  isBot: false, isGenerated: false, archetype: null
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
`

export async function submitPerformance(name: string, notes: NoteEvent[]): Promise<string> {
  const id = crypto.randomUUID()
  await getDriver().executeQuery(
    CREATE_PERFORMANCE,
    {
      id,
      name,
      notes: notes.map((n) => ({ t: n.t, code: neo4j.int(n.code) })),
      durationMs: notes.at(-1)?.t ?? 0,
      obsTime: MAX_DURATION_MS + 1,
    },
    { database },
  )
  return id
}

export type MyResult = {
  profileTitle: string | null
  profileText: string | null
  profileTitle_en: string | null
  profileText_en: string | null
  originality: number | null
  tribeName: string | null
  tribeDescription: string | null
  tribeName_en: string | null
  tribeDescription_en: string | null
  tribeId: string | null
  soulmate: string | null
  soulmateIsBot: boolean | null
  score: number | null
  notesPerSecond: number | null
}

export async function fetchMyResult(id: string): Promise<MyResult | null> {
  const { records } = await getDriver().executeQuery(
    `
    MATCH (p:Performance {id: $id})
    OPTIONAL MATCH (p)-[:IN_TRIBE {mode: 'full'}]->(t:Tribe)
    OPTIONAL MATCH (p)-[s:SIMILAR_TO {mode: 'full', rank: 1}]->(m:Performance)
    RETURN p.profileTitle AS profileTitle, p.profileText AS profileText,
           p.profileTitle_en AS profileTitle_en, p.profileText_en AS profileText_en, p.originality AS originality,
           p.notesPerSecond AS notesPerSecond, t.name AS tribeName, t.description AS tribeDescription,
           t.name_en AS tribeName_en, t.description_en AS tribeDescription_en, t.id AS tribeId,
           m.name AS soulmate, m.isBot AS soulmateIsBot, s.score AS score
    `,
    { id },
    { database, routing: neo4j.routing.READ },
  )
  if (!records.length) return null
  return records[0].toObject() as MyResult
}
