import { motion } from 'framer-motion'

/** A vector rendered as a bar code of signed values: the embedding made visible. */
export function EmbeddingStrip({ vector, height = 90, animate = true }: { vector?: number[] | null; height?: number; animate?: boolean }) {
  const values = vector?.length ? vector : Array.from({ length: 64 }, (_, i) => Math.sin(i * 1.7) * 0.6)
  const max = Math.max(...values.map(Math.abs)) || 1
  return (
    <div className="flex w-full items-center gap-[2px]" style={{ height }}>
      {values.map((v, i) => {
        const n = v / max
        const color = n >= 0 ? '#2EC4FF' : '#FF4FD8'
        return (
          <div key={i} className="relative flex h-full flex-1 items-center">
            <motion.div
              className="absolute left-0 right-0 rounded-full"
              style={{ background: color, boxShadow: `0 0 8px ${color}88`, top: n >= 0 ? undefined : '50%', bottom: n >= 0 ? '50%' : undefined, opacity: vector ? 1 : 0.35 }}
              initial={animate ? { height: 0 } : false}
              animate={{ height: `${Math.abs(n) * 50}%` }}
              transition={{ duration: 0.8, delay: animate ? i * 0.008 : 0, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </div>
        )
      })}
    </div>
  )
}
