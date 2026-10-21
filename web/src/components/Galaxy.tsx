import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { tribeColor } from '../lib/notes'
import type { Mode, Performance, Similar, Tribe } from '../lib/types'

type Props = {
  performances: Performance[]
  tribes: Tribe[]
  similar?: Similar[]
  mode: Mode
  selectedId?: string | null
  onSelect?: (p: Performance) => void
  showBots?: boolean
  landingId?: string | null
  compact?: boolean
}

const W = 1000
const H = 640
const PAD = 70

const px = (v: number) => PAD + ((v + 1) / 2) * (W - 2 * PAD)
const py = (v: number) => PAD + ((v + 1) / 2) * (H - 2 * PAD)

function starPath(r: number) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    return `${Math.cos(a) * rr},${Math.sin(a) * rr}`
  })
  return `M${pts.join('L')}Z`
}

/** Every melody is a point; distance = FastPath similarity; color = tribe. */
export function Galaxy({ performances, tribes, similar = [], mode, selectedId, onSelect, showBots = true, landingId, compact }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const points = useMemo(
    () =>
      performances
        .filter((p) => p[`x_${mode}`] != null && (showBots || !p.isBot || p.id === selectedId))
        .map((p) => ({ p, x: px(p[`x_${mode}`] as number), y: py(p[`y_${mode}`] as number), tribe: p[`tribe_${mode}`] ?? null })),
    [performances, mode, showBots, selectedId],
  )
  const byId = useMemo(() => new Map(points.map((pt) => [pt.p.id, pt])), [points])

  const nebulae = useMemo(() => {
    const list = tribes
      .filter((t) => t.mode === mode)
      .map((t) => {
        const members = points.filter((pt) => pt.tribe === t.id)
        if (!members.length) return null
        const cx = members.reduce((s, m) => s + m.x, 0) / members.length
        const cy = members.reduce((s, m) => s + m.y, 0) / members.length
        const r = Math.max(60, Math.sqrt(members.reduce((s, m) => s + (m.x - cx) ** 2 + (m.y - cy) ** 2, 0) / members.length) * 1.7)
        const top = Math.min(...members.map((m) => m.y))
        return { t, cx, cy, r, lx: cx, ly: top - 24 }
      })
      .filter(Boolean) as { t: Tribe; cx: number; cy: number; r: number; lx: number; ly: number }[]
    const placed = [...list].sort((a, b) => b.ly - a.ly)
    for (let i = 0; i < placed.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = placed[i]
        const b = placed[j]
        const minDx = (a.t.name.length + b.t.name.length) * 4.6
        if (Math.abs(a.lx - b.lx) < minDx && Math.abs(a.ly - b.ly) < 26) a.ly = b.ly - 26
      }
    }
    for (const n of list) {
      n.ly = Math.max(22, n.ly)
      n.lx = Math.min(W - n.t.name.length * 5, Math.max(n.t.name.length * 5, n.lx))
    }
    return list
  }, [tribes, points, mode])

  const focus = hover ?? selectedId ?? null
  const links = focus ? similar.filter((s) => s.mode === mode && s.source === focus && byId.has(s.target)) : []
  const hovered = hover ? byId.get(hover) : null

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="gx-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="gx-nebula" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="28" />
          </filter>
        </defs>

        {nebulae.map(({ t, cx, cy, r, lx, ly }) => (
          <motion.g key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, delay: 0.6 }}>
            <motion.circle animate={{ cx, cy, r }} transition={{ type: 'spring', stiffness: 40, damping: 16 }} fill={tribeColor(t.id)} opacity={0.16} filter="url(#gx-nebula)" />
            {!compact && (
              <motion.text
                animate={{ x: lx, y: ly }}
                transition={{ type: 'spring', stiffness: 40, damping: 16 }}
                textAnchor="middle"
                className="font-display"
                fontSize={17}
                fontWeight={700}
                fill={tribeColor(t.id)}
                style={{ paintOrder: 'stroke', stroke: '#05040b', strokeWidth: 5 }}
              >
                {t.name}
              </motion.text>
            )}
          </motion.g>
        ))}

        {links.map((l) => {
          const a = byId.get(l.source)!
          const b = byId.get(l.target)!
          return (
            <motion.line
              key={`${l.source}-${l.target}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#fff"
              strokeOpacity={0.25 + 0.5 * l.score}
              strokeWidth={1 + 3 * l.score}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5 }}
            />
          )
        })}

        {points.map(({ p, x, y, tribe }, i) => {
          const color = tribeColor(tribe)
          const human = !p.isBot && !p.isGenerated
          const r = p.isGenerated ? 13 : human ? 8 : 4.5
          const isSel = p.id === selectedId
          const isLanding = p.id === landingId
          return (
            <motion.g
              key={p.id}
              initial={isLanding ? { x, y: -60, scale: 2.5, opacity: 0 } : { x: W / 2, y: H / 2, scale: 0, opacity: 0 }}
              animate={{ x, y, scale: 1, opacity: 1 }}
              transition={
                isLanding
                  ? { duration: 2.2, ease: [0.2, 0.8, 0.2, 1] }
                  : { type: 'spring', stiffness: 50, damping: 14, delay: Math.min(i * 0.012, 1.2) }
              }
              onMouseEnter={() => setHover(p.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(p)}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
            >
              {(isSel || isLanding) && (
                <circle r={r + 10} fill="none" stroke={color} strokeWidth={2} opacity={0.8}>
                  <animate attributeName="r" values={`${r + 6};${r + 16};${r + 6}`} dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.2;0.9" dur="1.8s" repeatCount="indefinite" />
                </circle>
              )}
              {p.isGenerated ? (
                <path d={starPath(r)} fill={color} stroke="#fff" strokeWidth={1.5} filter="url(#gx-glow)" />
              ) : (
                <circle r={r} fill={color} fillOpacity={human ? 1 : 0.45} stroke={human ? '#fff' : 'none'} strokeWidth={1.5} filter={human ? 'url(#gx-glow)' : undefined} />
              )}
              {human && !compact && (
                <text y={r + 15} textAnchor="middle" fontSize={12} fill="#fff" opacity={0.85} className="font-sans" style={{ paintOrder: 'stroke', stroke: '#05040b', strokeWidth: 4 }}>
                  {p.name.slice(0, 14)}
                </text>
              )}
            </motion.g>
          )
        })}
      </svg>

      <AnimatePresence>
        {hovered && (
          <motion.div
            key={hovered.p.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass pointer-events-none absolute z-20 max-w-64 rounded-2xl px-4 py-3"
            style={{ left: `${(hovered.x / W) * 100}%`, top: `${(hovered.y / H) * 100}%`, transform: 'translate(-50%, calc(-100% - 18px))' }}
          >
            <p className="font-display font-semibold">{hovered.p.name}</p>
            {hovered.p.profileTitle && <p className="text-sm text-white/70">{hovered.p.profileTitle}</p>}
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-mute">
              {hovered.p.noteCount} notas · {hovered.p.facts?.notesPerSecond ?? '-'} n/s
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
