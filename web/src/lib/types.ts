import type { NoteEvent } from './notes'

export type Mode = 'full' | 'notes'

export type Facts = {
  noteCount: number
  durationSeconds: number
  notesPerSecond: number
  uniqueNotes: number
  favoriteNotes: string[]
  register: string
  ascendingRatio: number
  rhythmRegularity: number
  longestPauseSeconds: number
  tags: string[]
}

export type Performance = {
  id: string
  name: string
  isBot: boolean
  isGenerated?: boolean
  archetype?: string | null
  durationMs: number
  noteCount: number
  createdAt: string
  profileTitle?: string | null
  profileText?: string | null
  generatedText?: string | null
  originality?: number | null
  x_full?: number | null
  y_full?: number | null
  x_notes?: number | null
  y_notes?: number | null
  tribe_full?: string | null
  tribe_notes?: string | null
  notes: NoteEvent[]
  facts: Facts
  emb_full?: number[] | null
}

export type Tribe = {
  id: string
  mode: Mode
  index: number
  name: string
  description: string
  size: number
  facts: {
    size: number
    avgNotesPerSecond: number
    avgNoteCount: number
    commonTags: string[]
    favoriteNotes: string[]
  }
}

export type Similar = {
  source: string
  target: string
  mode: Mode
  rank: number
  cosine: number
  euclidean: number
  score: number
  explanation?: string | null
}

export type JobStep = { id: string; label: string }

export type Job = {
  status: 'idle' | 'running' | 'done' | 'error'
  step: string | null
  done?: string[]
  steps: JobStep[]
  backend?: 'aga' | 'local'
  warning?: string | null
  error?: string
  elapsedSeconds?: number
  people?: number
  total?: number
  llm?: boolean
}

export type StageState = {
  performances: Performance[]
  tribes: Tribe[]
  similar: Similar[]
  job: Job
  hasResults: boolean
}

export type Health = {
  neo4j: boolean
  backend: string
  agaConfigured: boolean
  session: string
  llm: boolean
  model: string | null
  fastpath?: Record<string, number>
}

export type Lobby = {
  count: number
  bots: number
  totalNotes: number
  recent: { id: string; name: string; noteCount: number; createdAt: string }[]
}

export type Composition = {
  performanceId: string
  title: string
  text: string
  generatedBy: 'llm' | 'template'
  notes: NoteEvent[]
  targetTribe: string
  landedTribe: string
  landedInTarget: boolean
  x: number
  y: number
  neighbors: Similar[]
}

export type Verdict = {
  level: 'very' | 'similar' | 'weak' | 'different'
  label: string
  similar: boolean
  thresholds: { very: number; similar: number; weak: number }
}

export type AskResult = {
  question: string
  queryId: string
  params: Record<string, string | boolean>
  cypher: string
  rows: Record<string, unknown>[]
  answer: string
}
