import { motion } from 'framer-motion'
import { ChainPreview } from '../../../components/ChainPreview'
import { EmbeddingStrip } from '../../../components/EmbeddingStrip'
import { PianoRoll } from '../../../components/PianoRoll'
import { Button, Chip, Dot, Spinner } from '../../../components/ui'
import type { Health, Job, Performance } from '../../../lib/types'

export function Pipeline({ job, health, sample, onRun }: { job: Job | null; health: Health | null; sample: Performance | null; onRun: () => void }) {
  const running = job?.status === 'running'
  const done = new Set(job?.done ?? [])
  const fp = health?.fastpath ?? {}
  return (
    <div className="flex h-full flex-col gap-8 px-14 pb-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.35em] text-mute">o algoritmo</p>
          <h2 className="mt-2 font-display text-6xl font-bold tracking-tight">
            Sequência <span className="text-white/30">→</span> <span className="text-gradient">vetor</span> <span className="text-white/30">→</span> tribo
          </h2>
        </div>
        <div className="flex items-center gap-4">
          {job?.backend && <Chip color={job.backend === 'aga' ? '#3DDC97' : '#FFD23F'}>{job.backend === 'aga' ? 'Aura Graph Analytics' : 'FastPath local (simulado)'}</Chip>}
          <Button size="lg" onClick={onRun} disabled={running}>
            {running ? <Spinner color="#05040b" /> : null}
            {running ? 'FastPath rodando' : job?.status === 'done' ? 'Rodar de novo' : 'Rodar FastPath'}
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-3 gap-6">
        <Panel n={1} title="Eventos no grafo" subtitle="Cada tecla é um nó ligado ao próximo">
          {sample ? <ChainPreview name={sample.name} notes={sample.notes} max={7} /> : <p className="text-white/40">Aguardando melodias...</p>}
          {sample && (
            <div className="rounded-2xl bg-black/25 p-2">
              <PianoRoll notes={sample.notes} height={170} compact />
              <p className="px-1 pt-1 font-mono text-[10px] uppercase tracking-wider text-white/35">a mesma sequência no tempo · {sample.noteCount} eventos</p>
            </div>
          )}
          <pre className="mt-auto overflow-hidden rounded-xl bg-black/40 p-3 font-mono text-[12px] leading-relaxed text-white/70">
            {`(:Performance)-[:FIRST_EVENT]->(:NoteEvent {t, noteCode})
  -[:NEXT_EVENT]->(:NoteEvent)-[:NEXT_EVENT]->...`}
          </pre>
        </Panel>
        <Panel n={2} title="FastPath" subtitle="Notas e tempo viram um embedding">
          <div className="rounded-2xl bg-black/25 px-3 py-4">
            <EmbeddingStrip vector={sample?.emb_full ?? null} key={sample?.id ?? 'none'} height={230} />
            <p className="pt-2 font-mono text-[10px] uppercase tracking-wider text-white/35">
              {sample?.emb_full ? `${sample.emb_full.length} dimensões · embedding de ${sample.name}` : 'o vetor aparece depois de rodar o FastPath'}
            </p>
          </div>
          <pre className="mt-auto overflow-hidden rounded-xl bg-black/40 p-3 font-mono text-[12px] leading-relaxed text-white/70">
            <span className="text-cyan">gds.fast_path</span>.mutate(G,{'\n'}
            {'  '}base_node_label=<span className="text-[#FFD23F]">"Performance"</span>,{'\n'}
            {'  '}event_node_label=<span className="text-[#FFD23F]">"NoteEvent"</span>,{'\n'}
            {'  '}embedding_dimension=<span className="text-magenta">{fp.embedding_dimension ?? 64}</span>, num_time_anchors=<span className="text-magenta">{fp.num_time_anchors ?? 20}</span>,{'\n'}
            {'  '}lookback_horizon=<span className="text-magenta">{fp.lookback_horizon ?? 20001}</span>, smoothing_window=<span className="text-magenta">{fp.smoothing_window ?? 1}</span>)
          </pre>
        </Panel>
        <Panel n={3} title="Similaridade" subtitle="Quem tocou parecido fica perto">
          <VectorDiagram />
          <div className="grid grid-cols-2 gap-3">
            <Metric color="#2EC4FF" name="Cosseno" text="Mesmo padrão: mesmas notas nos mesmos momentos" />
            <Metric color="#FF4FD8" name="Euclidiana" text="Mesma intensidade: quantidade e densidade de notas" />
          </div>
          <div className="mt-auto rounded-xl bg-black/40 p-3 font-mono text-[13px] text-white/70">
            score = <span className="text-cyan">0.6 · cosseno</span> + <span className="text-magenta">0.4 · euclidiana</span>
            <br />
            tribos = KMeans(embeddings) · nomes = <span className="text-[#FFD23F]">LLM</span>
          </div>
        </Panel>
      </div>

      <div className="glass rounded-3xl px-6 py-5">
        <div className="grid grid-cols-8 gap-3">
          {(job?.steps ?? []).map((s) => {
            const isCurrent = running && job?.step === s.id
            const isDone = done.has(s.id) && !isCurrent
            const skipped = job?.backend === 'local' && s.id === 'project'
            const color = isDone ? '#3DDC97' : isCurrent ? '#2EC4FF' : '#3a3852'
            return (
              <motion.div key={s.id} className="flex flex-col gap-2" animate={{ opacity: skipped ? 0.35 : 1 }}>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color, boxShadow: `0 0 12px ${color}` }}
                    initial={{ width: 0 }}
                    animate={{ width: isDone ? '100%' : isCurrent ? '60%' : '0%' }}
                    transition={{ duration: isCurrent ? 2.5 : 0.4 }}
                  />
                </div>
                <div className="flex items-start gap-2">
                  {isCurrent ? <Spinner /> : <Dot color={color} />}
                  <span className={`text-[13px] leading-tight ${isCurrent ? 'text-white' : isDone ? 'text-white/75' : 'text-white/35'}`}>{s.label}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
        {job?.status === 'done' && (
          <p className="mt-4 font-mono text-sm text-[#3DDC97]">
            Pronto em {job.elapsedSeconds}s: {job.total} melodias, {job.people} {job.people === 1 ? 'pessoa' : 'pessoas'}.
          </p>
        )}
        {job?.warning && <p className="mt-2 font-mono text-sm text-[#FFD23F]">{job.warning}</p>}
        {job?.status === 'error' && <p className="mt-4 font-mono text-sm text-[#FF3D71]">{job.error}</p>}
      </div>
    </div>
  )
}

function Panel({ n, title, subtitle, children }: { n: number; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: n * 0.12 }}
      className="glass flex flex-col gap-5 rounded-3xl p-6"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 font-display font-bold">{n}</span>
        <div>
          <h3 className="font-display text-2xl font-semibold">{title}</h3>
          <p className="text-sm text-white/50">{subtitle}</p>
        </div>
      </div>
      {children}
    </motion.div>
  )
}

function VectorDiagram() {
  const o = { x: 40, y: 150 }
  const a = { x: 250, y: 40 }
  const b = { x: 290, y: 95 }
  return (
    <svg viewBox="0 0 340 170" className="h-40 w-full">
      <defs>
        <marker id="arrow-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#2EC4FF" />
        </marker>
        <marker id="arrow-b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#9B5CFF" />
        </marker>
      </defs>
      <motion.line x1={o.x} y1={o.y} x2={a.x} y2={a.y} stroke="#2EC4FF" strokeWidth={3} markerEnd="url(#arrow-a)" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.4 }} />
      <motion.line x1={o.x} y1={o.y} x2={b.x} y2={b.y} stroke="#9B5CFF" strokeWidth={3} markerEnd="url(#arrow-b)" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.6 }} />
      <motion.path d="M 128 130.7 A 90 90 0 0 0 119.7 108.3" stroke="#2EC4FF" strokeWidth={2} fill="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} />
      <motion.text x={134} y={124} fill="#2EC4FF" fontSize={15} className="font-mono" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>θ</motion.text>
      <motion.line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#FF4FD8" strokeWidth={2} strokeDasharray="5 4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7 }} />
      <motion.text x={282} y={62} fill="#FF4FD8" fontSize={14} className="font-mono" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7 }}>d</motion.text>
      <text x={a.x - 30} y={a.y - 10} fill="#fff" fontSize={13} className="font-display">Ana</text>
      <text x={b.x - 8} y={b.y + 22} fill="#fff" fontSize={13} className="font-display">Bruno</text>
    </svg>
  )
}

function Metric({ color, name, text }: { color: string; name: string; text: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: `${color}12`, boxShadow: `inset 0 0 0 1px ${color}33` }}>
      <p className="font-display text-xl font-semibold" style={{ color }}>
        {name}
      </p>
      <p className="mt-1 text-sm text-white/60">{text}</p>
    </div>
  )
}
