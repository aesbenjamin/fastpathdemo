import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { GraphView } from '../../../components/GraphView'
import { PersonPicker } from '../../../components/PersonPicker'
import { PianoRoll } from '../../../components/PianoRoll'
import { Button, Chip, Gauge, PlayIcon, Spinner, Typewriter } from '../../../components/ui'
import { api } from '../../../lib/api'
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
      .explain(a.id, b.id, mode)
      .then((r) => alive && setExplain(r))
      .catch(() => alive && setExplain(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [a?.id, b?.id, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state?.hasResults || !a || !b) return <Empty />

  const playBoth = () => {
    pa.play(a.notes)
    pb.play(b.notes)
  }
  const stopAll = () => {
    pa.stop()
    pb.stop()
  }
  const ordered = [...perfs].sort((x, y) => Number(x.isBot) - Number(y.isBot) || x.name.localeCompare(y.name))
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
                  {v === 'roll' ? 'piano roll' : 'grafo'}
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
              <PlayIcon playing={pa.playing || pb.playing} /> Juntos
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
            <p className="absolute bottom-3 left-4 font-mono text-[11px] uppercase tracking-wider text-white/40">Neo4j Visualization Library · arraste e dê zoom</p>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-col gap-5">
        <div className="glass flex flex-col gap-5 rounded-[32px] px-6 py-6">
          <div className="flex justify-around">
            <Gauge value={explain?.scores.cosine ?? 0} label="cosseno" color="#2EC4FF" />
            <Gauge value={explain?.scores.euclidean ?? 0} label="euclidiana" color="#FF4FD8" />
            <Gauge value={explain?.scores.score ?? 0} label="score" color={explain ? VERDICT_COLOR[explain.verdict.level] : '#FFD23F'} />
          </div>
          {explain && <VerdictBar score={explain.scores.score} verdict={explain.verdict} />}
        </div>
        <motion.div layout className="glass flex flex-1 flex-col gap-4 rounded-[32px] p-7">
          <div className="flex items-center gap-2">
            <Chip color="#FFD23F">IA generativa</Chip>
            <span className="font-mono text-[11px] uppercase tracking-wider text-white/40">
              {explain ? (explain.verdict.similar ? 'por que são parecidas?' : 'por que não são parecidas?') : 'veredito do FastPath'}
            </span>
          </div>
          {loading ? (
            <div className="flex items-center gap-3 text-white/50">
              <Spinner color="#FFD23F" /> lendo os fatos do grafo...
            </div>
          ) : explain ? (
            <p className="font-display text-[26px] leading-snug text-white/90">
              <Typewriter text={explain.text} />
            </p>
          ) : (
            <p className="text-white/40">Sem explicação disponível.</p>
          )}
          <p className="mt-auto text-sm text-white/40">O modelo recebe apenas os números calculados pelo FastPath e os fatos das melodias.</p>
        </motion.div>
      </div>
    </div>
  )
}

function VerdictBar({ score, verdict }: { score: number; verdict: Verdict }) {
  const color = VERDICT_COLOR[verdict.level]
  const { weak, similar, very } = verdict.thresholds
  const pct = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`
  const bands: { from: number; to: number; level: Verdict['level']; name: string }[] = [
    { from: 0, to: weak, level: 'different', name: 'diferentes' },
    { from: weak, to: similar, level: 'weak', name: 'leve' },
    { from: similar, to: very, level: 'similar', name: 'parecidas' },
    { from: very, to: 1, level: 'very', name: 'muito' },
  ]
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 font-mono text-[11px] uppercase tracking-[0.25em] text-white/40">
          <p>veredito · cortes calibrados pelo KNN</p>
          {verdict.reference.knnMedian != null && (
            <p className="mt-0.5 normal-case tracking-normal text-white/30">
              vizinho típico {Math.round(verdict.reference.knnMedian * 100)} · melhor vizinho {Math.round((verdict.reference.bestNeighbourMedian ?? 0) * 100)}
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
          {verdict.label}
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
            {b.name}
          </span>
        ))}
        {[weak, similar, very].map((t) => (
          <span key={t} className="absolute -translate-x-1/2 text-white/25" style={{ left: pct(t), top: 14 }}>
            {Math.round(t * 100)}
          </span>
        ))}
      </div>
    </div>
  )
}

function Side({ label, p, other, mode, perfs, onChange }: { label: string; p: Performance; other: Performance; mode: Mode; perfs: Performance[]; onChange: (id: string) => void }) {
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
          placeholder={`trocar ${label}: digite um nome`}
          className="w-80"
          onPick={(x) => {
            onChange(x.id)
            setEditing(false)
          }}
        />
      ) : (
        <button onClick={() => setEditing(true)} className="group flex items-center gap-2 text-left" title="clique para trocar">
          <span className="font-display text-3xl font-bold">{p.name}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30 group-hover:text-white/70"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </button>
      )}
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: tribeColor(p[`tribe_${mode}`]) }} />
      <span className="font-mono text-xs uppercase tracking-wider text-white/45">
        {p.noteCount} notas · {p.facts.notesPerSecond} n/s · {p.facts.favoriteNotes.slice(0, 2).join(', ')}
      </span>
    </div>
  )
}
