import { motion } from 'framer-motion'
import type { Mode } from '../../lib/types'

const OPTIONS: { id: Mode; label: string }[] = [
  { id: 'full', label: 'notas + tempo' },
  { id: 'notes', label: 'só notas' },
]

export function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="relative flex rounded-full bg-black/40 p-1 ring-1 ring-white/10">
      {OPTIONS.map((o) => (
        <button key={o.id} onClick={() => setMode(o.id)} className="relative z-10 px-4 py-1.5 font-mono text-xs uppercase tracking-wider">
          {mode === o.id && (
            <motion.span layoutId="mode-pill" className="absolute inset-0 -z-10 rounded-full" style={{ background: 'linear-gradient(100deg,#2EC4FF,#9B5CFF)' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
          )}
          <span className={mode === o.id ? 'text-ink font-semibold' : 'text-white/60'}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}
