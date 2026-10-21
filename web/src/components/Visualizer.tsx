import { useEffect, useRef } from 'react'
import { analyser } from '../lib/audio'
import { IS_LIGHT } from '../lib/device'

/** Live waveform of everything coming out of the synth. */
export function Visualizer({ height = 56, color = '#2EC4FF' }: { height?: number; color?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = canvas.current!
    const ctx = el.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let raf = 0
    let grad: CanvasGradient
    // Resizing the bitmap every frame reallocates it; do it only when the element actually changes size.
    const resize = () => {
      el.width = el.clientWidth * dpr
      el.height = el.clientHeight * dpr
      grad = ctx.createLinearGradient(0, 0, el.width, 0)
      grad.addColorStop(0, '#2EC4FF')
      grad.addColorStop(0.5, color)
      grad.addColorStop(1, '#FF4FD8')
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (document.hidden) return
      const data = analyser()?.getValue() as Float32Array | undefined
      ctx.clearRect(0, 0, el.width, el.height)
      ctx.strokeStyle = grad
      ctx.lineWidth = 2 * dpr
      if (!IS_LIGHT) {
        ctx.shadowColor = color
        ctx.shadowBlur = 14 * dpr
      }
      ctx.beginPath()
      const n = data?.length ?? 2
      for (let i = 0; i < n; i++) {
        const v = data ? data[i] : 0
        const xx = (i / (n - 1)) * el.width
        const yy = el.height / 2 + v * el.height * 0.9
        if (i === 0) ctx.moveTo(xx, yy)
        else ctx.lineTo(xx, yy)
      }
      ctx.stroke()
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [color])
  return <canvas ref={canvas} className="w-full" style={{ height }} />
}
