import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { GraphView } from '../../../components/GraphView'
import { PersonPicker } from '../../../components/PersonPicker'
import { PianoRoll } from '../../../components/PianoRoll'
import { Button, Chip, Gauge, PlayIcon, Spinner, Typewriter } from '../../../components/ui'
import { api } from '../../../lib/api'
import { useI18n } from '../../../lib/i18n'
import { tribeColor } from '../../../lib/notes'
import type { Mode, Performance, StageState, Verdict } from '../../../lib/types'
import { usePlayback } from '../../../lib/usePlayback'
import { ModeToggle } from '../ModeToggle'
import { Empty } from './GalaxyAct'

type Explain = { text: string; scores: { cosine: number; euclidean: number; score: number }; verdict: Verdict }

const VERDICT_COLOR: Record<Verdict['level'], string> = { very: '#3DFFB0', similar: '#FFD23F', weak: '#FF9A3D', different: '#FF4F6A' }

export function Duel({
  state,
  mode,
  setMode,
  pair,
  setPair,
}: {
  state: StageState | null
  mode: Mode
  setMode: (m: Mode) => void
  pair: [string, string] | null
  setPair: (p: [string, string]) => void
}) {
  const { t, lang, name } = useI18n()
  const perfs = state?.performances ?? []
  const byId = useMemo(() => new Map(perfs.map((p) => [p.id, p])), [perfs])
  const [explain, setExplain] = useState<Explain | null>(null)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'roll' | 'graph'>('roll')
  const pa = usePlayback('main')
  const pb = usePlayback('duet')

  const defaultPair = useMemo<[string, string] | null>(() => {
    const isHuman = (id: string) => {
      const p = byId.get(id)
      return !!p && !p.isBot && !p.isGenerated
    }
    const humans = (state?.similar ?? []).filter((s) => s.mode === 'full' && isHuman(s.source) && isHuman(s.target))
    const best = humans.sort((a, b) => b.score - a.score)[0] ?? state?.similar.find((s) => s.rank === 1)
    return best ? [best.source, best.target] : null
  }, [state, byId])

  const [aId, bId] = pair ?? defaultPair ?? [null, null]
  const a = aId ? byId.get(aId) : undefined
  const b = bId ? byId.get(bId) : undefined

  useEffect(() => {
    if (!a || !b) return
    let alive = true
    setExplain(null)
    setLoading(true)
    api
      .explain(a.id, b.id, mode, lang)
      .then((r) => alive && setExplain(r))
      .catch(() => alive && setExplain(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [a?.id, b?.id, mode, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state?.hasResults || !a || !b) return <Empty />

  const playBoth = () => {
    pa.play(a.notes)
    pb.play(b.notes)
  }
  const stopAll = () => {
    pa.stop()
    pb.stop()
  }
  const ordered = [...perfs].sort((x, y) => Number(x.isBot) - Number(y.isBot) || name(x).localeCompare(name(y)))
  const span = Math.max(a.notes.at(-1)?.t ?? 0, b.notes.at(-1)?.t ?? 0)

  return (
    <div className="grid h-full grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-6 px-10 pb-8">
      <div className="glass flex min-h-0 flex-col gap-5 rounded-[32px] p-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ModeToggle mode={mode} setMode={setMode} />
            <div className="flex rounded-full bg-black/40 p-1 ring-1 ring-white/10">
              {(['roll', 'graph'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wider ${view === v ? 'bg-white text-ink' : 'text-white/60'}`}>
                  {v === 'roll' ? t('duel.roll') : t('duel.graph')}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="soft" size="sm" onClick={() => (pa.playing ? pa.stop() : pa.play(a.notes))}>
              <PlayIcon playing={pa.playing} /> A
            </Button>
            <Button variant="soft" size="sm" onClick={() => (pb.playing ? pb.stop() : pb.play(b.notes))}>
              <PlayIcon playing={pb.playing} /> B
            </Button>
            <Button size="sm" onClick={() => (pa.playing || pb.playing ? stopAll() : playBoth())}>
              <PlayIcon playing={pa.playing || pb.playing} /> {t('duel.together')}
            </Button>
          </div>
        </div>

        {view === 'roll' ? (
          <div className="flex flex-1 flex-col justify-center gap-4">
            <Side label="A" p={a} other={b} mode={mode} perfs={ordered} onChange={(id) => setPair([id, b.id])} />
            <div className="h-36 rounded-2xl bg-black/30 p-2">
              <PianoRoll notes={a.notes} durationMs={span} playhead={pa.playhead} activeIndex={pa.activeIndex} height={128} accent="#2EC4FF" />
            </div>
            <div className="h-36 rounded-2xl bg-black/30 p-2">
              <PianoRoll notes={b.notes} durationMs={span} playhead={pb.playhead} activeIndex={pb.activeIndex} height={128} accent="#FF4FD8" ghost={a.notes} />
            </div>
            <Side label="B" p={b} other={a} mode={mode} perfs={ordered} onChange={(id) => setPair([a.id, id])} />
          </div>
        ) : (
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black/30">
            <GraphView people={[{ p: a, color: '#2EC4FF' }, { p: b, color: '#FF4FD8' }]} score={explain?.scores.score} />
            <p className="absolute bottom-3 left-4 font-mono text-[11px] uppercase tracking-wider text-white/40">{t('duel.nvl')}</p>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-col gap-5">
        <div className="glass flex flex-col gap-5 rounded-[32px] px-6 py-6">
          <div className="flex justify-around">
            <Gauge value={explain?.scores.cosine ?? 0} label={t('duel.cosine')} color="#2EC4FF" />
            <Gauge value={explain?.scores.euclidean ?? 0} label={t('duel.euclidean')} color="#FF4FD8" />
            <Gauge value={explain?.scores.score ?? 0} label={t('duel.score')} color={explain ? VERDICT_COLOR[explain.verdict.level] : '#FFD23F'} />
          </div>
          {explain && <VerdictBar score={explain.scores.score} verdict={explain.verdict} />}
        </div>
        <motion.div layout className="glass flex flex-1 flex-col gap-4 rounded-[32px] p-7">
          <div className="flex items-center gap-2">
            <Chip color="#FFD23F">{t('duel.genai')}</Chip>
            <span className="font-mono text-[11px] uppercase tracking-wider text-white/40">
              {explain ? (explain.verdict.similar ? t('duel.whySimilar') : t('duel.whyNot')) : t('duel.verdictOf')}
            </span>
          </div>
          {loading ? (
            <div className="flex items-center gap-3 text-white/50">
              <Spinner color="#FFD23F" /> {t('duel.reading')}
            </div>
          ) : explain ? (
            <p className="font-display text-[26px] leading-snug text-white/90">
              <Typewriter text={explain.text} />
            </p>
          ) : (
            <p className="text-white/40">{t('duel.noExplain')}</p>
          )}
          <p className="mt-auto text-sm text-white/40">{t('duel.footnote')}</p>
        </motion.div>
      </div>
    </div>
  )
}

function VerdictBar({ score, verdict }: { score: number; verdict: Verdict }) {
  const { t } = useI18n()
  const color = VERDICT_COLOR[verdict.level]
  const { weak, similar, very } = verdict.thresholds
  const pct = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`
  const bands: { from: number; to: number; level: Verdict['level'] }[] = [
    { from: 0, to: weak, level: 'different' },
    { from: weak, to: similar, level: 'weak' },
    { from: similar, to: very, level: 'similar' },
    { from: very, to: 1, level: 'very' },
  ]
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 font-mono text-[11px] uppercase tracking-[0.25em] text-white/40">
          <p>{t('duel.verdictHeader')}</p>
          {verdict.reference.knnMedian != null && (
            <p className="mt-0.5 normal-case tracking-normal text-white/30">
              {t('duel.reference', { a: Math.round(verdict.reference.knnMedian * 100), b: Math.round((verdict.reference.bestNeighbourMedian ?? 0) * 100) })}
            </p>
          )}
        </div>
        <motion.span
          key={verdict.level}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 font-display text-base font-bold uppercase tracking-wide text-ink"
          style={{ background: color, boxShadow: `0 0 24px ${color}80` }}
        >
          {t(`verdict.${verdict.level}`)}
        </motion.span>
      </div>
      <div className="relative h-3 w-full">
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          {bands.map((b) => (
            <div key={b.level} style={{ width: pct(b.to - b.from), background: VERDICT_COLOR[b.level], opacity: b.level === verdict.level ? 0.9 : 0.22 }} />
          ))}
        </div>
        <motion.div
          className="absolute -top-1 h-5 w-1.5 -translate-x-1/2 rounded-full bg-white"
          style={{ boxShadow: '0 0 10px #fff' }}
          initial={{ left: 0 }}
          animate={{ left: pct(score) }}
          transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </div>
      <div className="relative h-7 font-mono text-[10px] uppercase tracking-wider text-white/40">
        {bands.map((b) => (
          <span key={b.level} className="absolute -translate-x-1/2" style={{ left: pct((b.from + b.to) / 2), color: b.level === verdict.level ? color : undefined }}>
            {t(`band.${b.level}`)}
          </span>
        ))}
        {[weak, similar, very].map((cut) => (
          <span key={cut} className="absolute -translate-x-1/2 text-white/25" style={{ left: pct(cut), top: 14 }}>
            {Math.round(cut * 100)}
          </span>
        ))}
      </div>
    </div>
  )
}

function Side({ label, p, other, mode, perfs, onChange }: { label: string; p: Performance; other: Performance; mode: Mode; perfs: Performance[]; onChange: (id: string) => void }) {
  const { t, name, note } = useI18n()
  const color = label === 'A' ? '#2EC4FF' : '#FF4FD8'
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex items-center gap-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-full font-display text-lg font-bold text-ink" style={{ background: color, boxShadow: `0 0 20px ${color}` }}>
        {label}
      </span>
      {editing ? (
        <PersonPicker
          performances={perfs}
          mode={mode}
          excludeId={other.id}
          autoFocus
          size="lg"
          placeholder={t('duel.swap', { label })}
          className="w-80"
          onPick={(x) => {
            onChange(x.id)
            setEditing(false)
          }}
        />
      ) : (
        <button onClick={() => setEditing(true)} className="group flex items-center gap-2 text-left" title={t('duel.clickToSwap')}>
          <span className="font-display text-3xl font-bold">{name(p)}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30 group-hover:text-white/70"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </button>
      )}
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: tribeColor(p[`tribe_${mode}`]) }} />
      <span className="font-mono text-xs uppercase tracking-wider text-white/45">
        {t('common.notes', { n: p.noteCount })} · {p.facts.notesPerSecond} n/s · {p.facts.favoriteNotes.slice(0, 2).map(note).join(', ')}
      </span>
    </div>
  )
}
