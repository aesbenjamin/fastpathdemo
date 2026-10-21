import { IS_LIGHT } from '../lib/device'
import { MAX_DURATION_MS, NOTES, type NoteEvent } from '../lib/notes'

type Props = {
  notes: NoteEvent[]
  durationMs?: number
  playhead?: number | null
  activeIndex?: number | null
  height?: number
  compact?: boolean
  accent?: string
  ghost?: NoteEvent[]
}

/** Time on X, pitch on Y. Each note is a glowing pill in its own color. */
export function PianoRoll({ notes, durationMs, playhead, activeIndex, height = 160, compact, accent, ghost }: Props) {
  const span = Math.max(durationMs ?? 0, notes.at(-1)?.t ?? 0, ghost?.at(-1)?.t ?? 0, 3000) + 400
  const width = 1000
  const rowH = height / NOTES.length
  const pill = Math.max(10, Math.min(28, width / Math.max(notes.length, 1) / 1.5))
  const x = (t: number) => (t / span) * width
  const y = (code: number) => (NOTES.length - 1 - code) * rowH

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full" style={{ height }}>
      <defs>
        <filter id="roll-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {NOTES.map((n) => (
        <rect key={n.code} x={0} y={y(n.code)} width={width} height={rowH} fill={n.code % 2 ? 'rgba(255,255,255,0.025)' : 'transparent'} />
      ))}
      {!compact &&
        Array.from({ length: Math.floor(span / 1000) + 1 }, (_, s) => (
          <line key={s} x1={x(s * 1000)} x2={x(s * 1000)} y1={0} y2={height} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
        ))}
      {ghost?.map((n, i) => (
        <rect
          key={`g${i}`}
          x={x(n.t)}
          y={y(n.code) + rowH * 0.2}
          width={pill}
          height={rowH * 0.6}
          rx={rowH * 0.3}
          fill="none"
          stroke={accent ?? '#fff'}
          strokeOpacity={0.35}
          strokeDasharray="4 3"
        />
      ))}
      {notes.map((n, i) => {
        const on = activeIndex === i
        const color = NOTES[n.code].color
        return (
          <rect
            key={i}
            x={x(n.t)}
            y={y(n.code) + rowH * 0.18}
            width={pill}
            height={rowH * 0.64}
            rx={rowH * 0.32}
            fill={color}
            opacity={activeIndex == null || on || (activeIndex ?? -1) > i ? 1 : 0.35}
            filter={IS_LIGHT ? undefined : 'url(#roll-glow)'}
            style={{ transition: 'opacity .2s', transform: on ? 'scaleY(1.25)' : undefined, transformOrigin: 'center', transformBox: 'fill-box' }}
          />
        )
      })}
      {playhead != null && (
        <g>
          <line x1={x(playhead)} x2={x(playhead)} y1={0} y2={height} stroke="#fff" strokeWidth={2} opacity={0.9} />
          <line x1={x(playhead)} x2={x(playhead)} y1={0} y2={height} stroke={accent ?? '#2EC4FF'} strokeWidth={8} opacity={0.25} />
        </g>
      )}
      {durationMs === MAX_DURATION_MS && (
        <line x1={x(MAX_DURATION_MS)} x2={x(MAX_DURATION_MS)} y1={0} y2={height} stroke="#FF3D71" strokeDasharray="6 6" opacity={0.6} />
      )}
    </svg>
  )
}
