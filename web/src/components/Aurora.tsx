import { useEffect, useRef } from 'react'
import { IS_LIGHT } from '../lib/device'
import { NOTES } from '../lib/notes'

/**
 * Ambient background: slow color blobs plus drifting "note dust" on a canvas.
 * On phones (IS_LIGHT) the canvas and the animated blurs are dropped: they alone
 * halved the frame rate and starved the audio thread.
 */
export function Aurora({ intensity = 1 }: { intensity?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (IS_LIGHT) return
    const el = canvas.current!
    const ctx = el.getContext('2d')!
    let frame = 0
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const particles = Array.from({ length: Math.round(46 * intensity) }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.8 + 0.4,
      v: Math.random() * 0.00025 + 0.00006,
      c: NOTES[Math.floor(Math.random() * NOTES.length)].color,
      p: Math.random() * Math.PI * 2,
    }))
    const resize = () => {
      el.width = el.clientWidth * dpr
      el.height = el.clientHeight * dpr
    }
    resize()
    window.addEventListener('resize', resize)
    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (document.hidden) return
      frame++
      ctx.clearRect(0, 0, el.width, el.height)
      for (const p of particles) {
        p.y -= p.v
        if (p.y < -0.02) {
          p.y = 1.02
          p.x = Math.random()
        }
        const tw = 0.45 + 0.55 * Math.sin(frame * 0.02 + p.p)
        ctx.globalAlpha = 0.55 * tw
        ctx.fillStyle = p.c
        ctx.shadowColor = p.c
        ctx.shadowBlur = 10 * dpr
        ctx.beginPath()
        ctx.arc(p.x * el.width, p.y * el.height, p.r * dpr, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [intensity])

  if (IS_LIGHT) {
    // Two static radial gradients: same mood, zero per-frame cost.
    return (
      <div
        className="pointer-events-none fixed inset-0 noise"
        aria-hidden
        style={{
          background:
            'radial-gradient(60% 45% at 10% 0%, rgba(77,124,255,.32), transparent 70%), radial-gradient(70% 50% at 100% 100%, rgba(255,79,216,.26), transparent 70%)',
        }}
      />
    )
  }

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden noise" aria-hidden>
      <div
        className="absolute -left-[20%] -top-[25%] h-[70vmax] w-[70vmax] rounded-full opacity-40 blur-[110px]"
        style={{ background: 'radial-gradient(circle, #4D7CFF 0%, transparent 65%)', animation: 'drift 18s ease-in-out infinite' }}
      />
      <div
        className="absolute -bottom-[30%] -right-[15%] h-[75vmax] w-[75vmax] rounded-full opacity-35 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #FF4FD8 0%, transparent 62%)', animation: 'drift 22s ease-in-out infinite reverse' }}
      />
      <div
        className="absolute left-[35%] top-[30%] h-[45vmax] w-[45vmax] rounded-full opacity-25 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #2EC4FF 0%, transparent 60%)', animation: 'drift 26s ease-in-out infinite' }}
      />
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
