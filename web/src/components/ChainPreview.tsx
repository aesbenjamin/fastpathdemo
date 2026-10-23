import { motion } from 'framer-motion'
import { useI18n } from '../lib/i18n'
import { NOTES, type NoteEvent } from '../lib/notes'

/** Stylised (:Performance)-[:FIRST_EVENT]->(:NoteEvent)-[:NEXT_EVENT]->... path. */
export function ChainPreview({ name, notes, max = 9, animate = true }: { name: string; notes: NoteEvent[]; max?: number; animate?: boolean }) {
  const { t, noteShort } = useI18n()
  const shown = notes.slice(0, max)
  const rest = notes.length - shown.length
  return (
    <div className="flex flex-wrap items-center gap-y-3">
      <motion.div
        initial={animate ? { scale: 0, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        className="flex h-14 min-w-14 items-center justify-center rounded-full px-3 font-display text-sm font-semibold text-ink"
        style={{ background: 'linear-gradient(135deg,#2EC4FF,#FF4FD8)', boxShadow: '0 0 24px rgba(155,92,255,.7)' }}
      >
        {name.slice(0, 10)}
      </motion.div>
      {shown.map((n, i) => (
        <motion.div
          key={i}
          className="flex items-center"
          initial={animate ? { opacity: 0, x: -12 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: animate ? 0.15 + i * 0.12 : 0 }}
        >
          <div className="relative mx-1 flex w-9 flex-col items-center">
            <span className="mb-0.5 font-mono text-[8px] uppercase tracking-wider text-white/40">{i === 0 ? 'first' : 'next'}</span>
            <span className="h-px w-full bg-gradient-to-r from-white/10 to-white/50" />
          </div>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full font-display text-[11px] font-bold text-ink"
            style={{ background: NOTES[n.code].color, boxShadow: `0 0 16px ${NOTES[n.code].color}` }}
          >
            {noteShort(n.code)}
          </div>
        </motion.div>
      ))}
      {rest > 0 && <span className="ml-3 font-mono text-xs text-white/50">{t('common.moreEvents', { n: rest })}</span>}
    </div>
  )
}
