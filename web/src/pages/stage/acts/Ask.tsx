import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Chip, Spinner, Typewriter } from '../../../components/ui'
import { api } from '../../../lib/api'
import type { AskResult } from '../../../lib/types'

export function Ask() {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AskResult | null>(null)
  const [showCypher, setShowCypher] = useState(false)

  useEffect(() => {
    api.suggestions().then(setSuggestions).catch(() => undefined)
  }, [])

  const ask = async (q: string) => {
    if (!q.trim()) return
    setQuestion(q)
    setBusy(true)
    setResult(null)
    try {
      setResult(await api.ask(q))
    } finally {
      setBusy(false)
    }
  }

  const columns = result?.rows[0] ? Object.keys(result.rows[0]) : []

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-7 px-10 pb-10">
      <div>
        <p className="font-mono text-sm uppercase tracking-[0.35em] text-mute">pergunte ao grafo</p>
        <h2 className="mt-2 font-display text-6xl font-bold tracking-tight">
          Linguagem natural <span className="text-white/30">→</span> <span className="text-gradient">Cypher</span>
        </h2>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(question)
        }}
        className="glass flex items-center gap-4 rounded-[28px] px-7 py-5"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9B5CFF" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex.: quem é a alma gêmea musical da Ana?"
          className="flex-1 bg-transparent font-display text-3xl outline-none placeholder:text-white/25"
        />
        {busy && <Spinner color="#9B5CFF" />}
      </form>

      <div className="flex flex-wrap gap-2.5">
        {suggestions.map((s) => (
          <button key={s} onClick={() => ask(s)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[15px] text-white/75 transition hover:border-white/30 hover:text-white">
            {s}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div key={result.question} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6">
            <div className="border-gradient glass flex flex-col gap-5 rounded-[32px] p-8">
              <div className="flex items-center gap-2">
                <Chip color="#FFD23F">resposta</Chip>
                <Chip color="#9B5CFF">{result.queryId}</Chip>
              </div>
              <p className="font-display text-[34px] leading-snug">
                <Typewriter text={result.answer} />
              </p>
            </div>
            <div className="glass flex min-h-0 flex-col gap-4 overflow-hidden rounded-[32px] p-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-mute">{result.rows.length} linhas do grafo</p>
                <button onClick={() => setShowCypher((v) => !v)} className="font-mono text-xs uppercase tracking-wider text-cyan">
                  {showCypher ? 'ver dados' : 'ver Cypher'}
                </button>
              </div>
              {showCypher ? (
                <pre className="min-h-0 flex-1 overflow-auto rounded-2xl bg-black/40 p-4 font-mono text-[13px] leading-relaxed text-white/75">{result.cypher}</pre>
              ) : (
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        {columns.map((c) => (
                          <th key={c} className="pb-2 pr-4 font-mono text-[11px] uppercase tracking-wider text-white/40">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, 8).map((r, i) => (
                        <tr key={i} className="border-t border-white/5">
                          {columns.map((c) => (
                            <td key={c} className="py-2 pr-4 text-white/80">{format(r[c])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function format(v: unknown): string {
  if (v == null) return '-'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
  if (Array.isArray(v)) return v.map(format).join(', ')
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).map(format).join(' · ')
  return String(v)
}
