import type { AskResult, Composition, Health, Job, Lobby, Mode, StageState, Verdict } from './types'

const params = new URLSearchParams(window.location.search)
export const API_URL = (params.get('api') || import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body: unknown = {}) => call<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const api = {
  health: () => call<Health>('/api/health'),
  lobby: () => call<Lobby>('/api/lobby'),
  state: () => call<StageState>('/api/state'),
  job: () => call<Job>('/api/job'),
  run: () => post<Job>('/api/run'),
  warmup: () => post<{ session: string }>('/api/session/warmup'),
  deleteSession: () => call<{ deleted: boolean }>('/api/session', { method: 'DELETE' }),
  explain: (a: string, b: string, mode: Mode) =>
    post<{ text: string; scores: { cosine: number; euclidean: number; score: number }; verdict: Verdict }>('/api/explain', { a, b, mode }),
  compose: (tribeId: string) => post<Composition>('/api/compose', { tribeId }),
  ask: (question: string) => post<AskResult>('/api/ask', { question }),
  suggestions: () => call<string[]>('/api/ask/suggestions'),
  seed: (perArchetype = 6) => post<{ bots: number }>('/api/seed', { perArchetype }),
  reset: (keepBots = true) => post<{ removed: number }>('/api/reset', { keepBots }),
}
