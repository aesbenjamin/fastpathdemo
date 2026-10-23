import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PianoRoll } from '../../../components/PianoRoll'
import { Button, Chip, PlayIcon, Spinner, Typewriter } from '../../../components/ui'
import { api } from '../../../lib/api'
import { useI18n, type I18n } from '../../../lib/i18n'
import { tribeColor } from '../../../lib/notes'
import type { AskResult, Mode, Performance, StageState } from '../../../lib/types'
import { usePlayback } from '../../../lib/usePlayback'

export function Ask({ state, mode, onDuel }: { state: StageState | null; mode: Mode; onDuel: (a: string, b: string) => void }) {
  const i18n = useI18n()
  const { t, lang, name, loc, maybe } = i18n
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AskResult | null>(null)
  const [showCypher, setShowCypher] = useState(false)
  const [selected, setSelected] = useState<Performance | null>(null)
  const playback = usePlayback()
  const asked = useRef<string | null>(null)

  useEffect(() => {
    api.suggestions(lang).then(setSuggestions).catch(() => undefined)
  }, [lang])

  // Name -> melody, by stored and displayed name. People win over robots when names collide.
  const byName = useMemo(() => {
    const m = new Map<string, Performance>()
    const perfs = [...(state?.performances ?? [])].sort((a, b) => Number(!!a.isBot || !!a.isGenerated) - Number(!!b.isBot || !!b.isGenerated))
    for (const p of perfs) {
      if (!m.has(p.name)) m.set(p.name, p)
      const shown = name(p)
      if (!m.has(shown)) m.set(shown, p)
    }
    return m
  }, [state, name])

  const people = useMemo(() => {
    const found: Performance[] = []
    const seen = new Set<string>()
    const visit = (v: unknown) => {
      if (typeof v === 'string') {
        const p = byName.get(v)
        if (p && !seen.has(p.id)) { seen.add(p.id); found.push(p) }
      } else if (Array.isArray(v)) v.forEach(visit)
      else if (v && typeof v === 'object') Object.values(v).forEach(visit)
    }
    result?.rows.forEach(visit)
    return found
  }, [result, byName])

  const ask = async (q: string) => {
    if (!q.trim()) return
    asked.current = q
    setQuestion(q)
    setBusy(true)
    setResult(null)
    setSelected(null)
    playback.stop()
    try {
      setResult(await api.ask(q, lang))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (asked.current) ask(asked.current)
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (p: Performance) => {
    setSelected(p)
    playback.play(p.notes)
  }

  const columns = result?.rows[0] ? Object.keys(result.rows[0]) : []
  const other = selected ? people.find((p) => p.id !== selected.id) : undefined

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-7 px-10 pb-10">
      <div>
        <p className="font-mono text-sm uppercase tracking-[0.35em] text-mute">{t('ask.kicker')}</p>
        <h2 className="mt-2 font-display text-6xl font-bold tracking-tight">
          {t('ask.titleA')} <span className="text-white/30">→</span> <span className="text-gradient">Cypher</span>
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
          placeholder={t('ask.placeholder')}
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
          <motion.div key={`${result.question}-${lang}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6">
            <div className="border-gradient glass flex min-h-0 flex-col gap-5 overflow-y-auto rounded-[32px] p-8 scrollbar-none">
              <div className="flex items-center gap-2">
                <Chip color="#FFD23F">{t('ask.answer')}</Chip>
                <Chip color="#9B5CFF">{maybe(`query.${result.queryId}`, result.queryId)}</Chip>
              </div>
              <p className="font-display text-[34px] leading-snug">
                <Typewriter text={result.answer} />
              </p>

              {people.length > 0 && (
                <div className="mt-auto space-y-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-mute">{t('ask.people')}</p>
                  <div className="flex flex-wrap gap-2">
                    {people.map((p) => {
                      const on = selected?.id === p.id
                      return (
                        <button
                          key={p.id}
                          onClick={() => (on && playback.playing ? playback.stop() : pick(p))}
                          className={`flex items-center gap-2 rounded-full px-4 py-2 font-display text-[15px] font-semibold ring-1 transition ${on ? 'bg-white text-ink ring-white' : 'bg-white/5 ring-white/15 hover:bg-white/10'}`}
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: tribeColor(p[`tribe_${mode}`]) }} />
                          <PlayIcon playing={on && playback.playing} />
                          {name(p)}
                          {(p.isBot || p.isGenerated) && <span className="font-mono text-[10px] uppercase opacity-60">{p.isGenerated ? t('common.ai') : t('common.echo')}</span>}
                        </button>
                      )
                    })}
                  </div>
                  <AnimatePresence mode="wait">
                    {selected && (
                      <motion.div key={selected.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                        <div className="h-28 rounded-2xl bg-black/30 p-2">
                          <PianoRoll notes={selected.notes} playhead={playback.playhead} activeIndex={playback.activeIndex} height={100} compact />
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs uppercase tracking-wider text-white/45">
                            {t('common.notes', { n: selected.noteCount })} · {selected.facts.notesPerSecond} n/s{selected.profileTitle ? ` · ${loc(selected, 'profileTitle')}` : ''}
                          </span>
                          {other && (
                            <Button size="sm" variant="soft" className="ml-auto" onClick={() => onDuel(selected.id, other.id)}>
                              {t('ask.duel', { a: name(selected), b: name(other) })}
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
            <div className="glass flex min-h-0 flex-col gap-4 overflow-hidden rounded-[32px] p-6">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-mute">{t('ask.rows', { n: result.rows.length })}</p>
                <button onClick={() => setShowCypher((v) => !v)} className="font-mono text-xs uppercase tracking-wider text-cyan">
                  {showCypher ? t('ask.viewData') : t('ask.viewCypher')}
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
                          <th key={c} className="pb-2 pr-4 font-mono text-[11px] uppercase tracking-wider text-white/40">{maybe(`col.${c}`, c)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, 8).map((r, i) => (
                        <tr key={i} className="border-t border-white/5">
                          {columns.map((c) => (
                            <td key={c} className="py-2 pr-4 text-white/80">
                              <Cell value={c === 'note' ? i18n.note(String(r[c])) : r[c]} byName={byName} selectedId={selected?.id} onPick={pick} i18n={i18n} />
                            </td>
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

type CellProps = { value: unknown; byName: Map<string, Performance>; selectedId?: string; onPick: (p: Performance) => void; i18n: I18n }

function Cell({ value, byName, selectedId, onPick, i18n }: CellProps) {
  if (typeof value === 'string' && byName.has(value)) {
    const p = byName.get(value)!
    return (
      <button onClick={() => onPick(p)} className={`rounded-md px-1.5 py-0.5 font-medium underline decoration-dotted underline-offset-4 hover:bg-white/10 ${selectedId === p.id ? 'bg-white/15 text-white' : 'text-cyan'}`}>
        {i18n.name(p)}
      </button>
    )
  }
  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-x-1 gap-y-0.5">
        {value.map((v, i) => (
          <span key={i}>
            <Cell value={v} byName={byName} selectedId={selectedId} onPick={onPick} i18n={i18n} />
            {i < value.length - 1 && <span className="text-white/30">,</span>}
          </span>
        ))}
      </span>
    )
  }
  if (value && typeof value === 'object') {
    const vals = Object.values(value as Record<string, unknown>)
    return (
      <span className="flex flex-wrap gap-x-1">
        {vals.map((v, i) => (
          <span key={i}>
            <Cell value={v} byName={byName} selectedId={selectedId} onPick={onPick} i18n={i18n} />
            {i < vals.length - 1 && <span className="text-white/30"> · </span>}
          </span>
        ))}
      </span>
    )
  }
  return <>{format(value, i18n)}</>
}

function format(v: unknown, i18n: I18n): string {
  if (v == null) return '-'
  if (typeof v === 'boolean') return i18n.t(v ? 'value.yes' : 'value.no')
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
  return String(v)
}
