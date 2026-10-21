import { useEffect, useRef, useState } from 'react'
import { IS_LIGHT } from '../lib/device'
import { NOTES } from '../lib/notes'

type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }

/** Eight glowing pads. Fires on pointerdown for zero-latency, multi-touch playing. */
export function Keyboard({ onPress, disabled }: { onPress: (code: number) => void; disabled?: boolean }) {
  const [active, setActive] = useState<Record<number, number>>({})
  const canvas = useRef<HTMLCanvasElement>(null)
  const sparks = useRef<Spark[]>([])
  const wrap = useRef<HTMLDivElement>(null)

  const raf = useRef(0)

  useEffect(() => {
    const el = canvas.current!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      el.width = el.clientWidth * dpr
      el.height = el.clientHeight * dpr
    }
    resize()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf.current)
      raf.current = 0
      window.removeEventListener('resize', resize)
    }
  }, [])

  // The spark loop only runs while there are sparks alive, so an idle keyboard costs nothing.
  const tick = () => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    ctx.clearRect(0, 0, el.width, el.height)
    sparks.current = sparks.current.filter((s) => s.life > 0)
    for (const s of sparks.current) {
      s.x += s.vx
      s.y += s.vy
      s.vy += 0.06
      s.life -= 0.018
      ctx.globalAlpha = Math.max(s.life, 0)
      ctx.fillStyle = s.color
      if (!IS_LIGHT) {
        ctx.shadowColor = s.color
        ctx.shadowBlur = 12 * dpr
      }
      ctx.beginPath()
      ctx.arc(s.x * dpr, s.y * dpr, Math.max(0, s.size * dpr * s.life), 0, Math.PI * 2)
      ctx.fill()
    }
    raf.current = sparks.current.length ? requestAnimationFrame(tick) : 0
  }

  const burst = (clientX: number, clientY: number, color: string) => {
    const rect = wrap.current!.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const count = IS_LIGHT ? 7 : 16
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const v = Math.random() * 3.2 + 1
      sparks.current.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2.4, life: 1, color, size: Math.random() * 3 + (IS_LIGHT ? 2.5 : 1.5) })
    }
    if (!raf.current) raf.current = requestAnimationFrame(tick)
  }

  const press = (code: number, e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    onPress(code)
    burst(e.clientX, e.clientY, NOTES[code].color)
    navigator.vibrate?.(8)
    setActive((a) => ({ ...a, [code]: (a[code] ?? 0) + 1 }))
    window.setTimeout(() => setActive((a) => ({ ...a, [code]: Math.max((a[code] ?? 1) - 1, 0) })), 180)
  }

  return (
    <div ref={wrap} className="relative w-full flex-1 select-none">
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-2 gap-2.5 sm:grid-cols-8 sm:grid-rows-1">
        {NOTES.map((n) => {
          const on = (active[n.code] ?? 0) > 0
          return (
            <button
              key={n.code}
              onPointerDown={(e) => press(n.code, e)}
              onContextMenu={(e) => e.preventDefault()}
              disabled={disabled}
              className="relative flex flex-col items-center justify-end overflow-hidden rounded-3xl pb-4 transition-transform duration-75 disabled:opacity-40"
              style={{
                transform: on ? 'scale(0.95)' : 'scale(1)',
                background: `linear-gradient(180deg, ${n.color}${on ? 'ee' : '33'} 0%, ${n.color}${on ? '99' : '12'} 100%)`,
                boxShadow: on
                  ? `0 0 40px ${n.color}aa, inset 0 0 30px ${n.color}, inset 0 1px 0 rgba(255,255,255,.6)`
                  : `0 0 0 1px ${n.color}44, inset 0 1px 0 rgba(255,255,255,.12)`,
              }}
            >
              <span
                className="absolute inset-x-3 top-3 h-1/3 rounded-2xl opacity-60"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.22), transparent)' }}
              />
              <span className="font-display text-xl font-semibold drop-shadow" style={{ color: on ? '#05040b' : n.color }}>
                {n.short}
              </span>
              <span className="font-mono text-[10px] opacity-60" style={{ color: on ? '#05040b' : '#fff' }}>
                {n.name}
              </span>
            </button>
          )
        })}
      </div>
      <canvas ref={canvas} className="pointer-events-none absolute -inset-0 h-full w-full overflow-visible" />
    </div>
  )
}
