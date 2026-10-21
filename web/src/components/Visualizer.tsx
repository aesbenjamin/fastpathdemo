import { useEffect, useRef } from 'react'
import { analyser } from '../lib/audio'

/** Live waveform of everything coming out of the synth. */
export function Visualizer({ height = 56, color = '#2EC4FF' }: { height?: number; color?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = canvas.current!
    const ctx = el.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let raf = 0
    const draw = () => {
      el.width = el.clientWidth * dpr
      el.height = el.clientHeight * dpr
      const data = analyser()?.getValue() as Float32Array | undefined
      ctx.clearRect(0, 0, el.width, el.height)
      const grad = ctx.createLinearGradient(0, 0, el.width, 0)
      grad.addColorStop(0, '#2EC4FF')
      grad.addColorStop(0.5, color)
      grad.addColorStop(1, '#FF4FD8')
      ctx.strokeStyle = grad
      ctx.lineWidth = 2 * dpr
      ctx.shadowColor = color
      ctx.shadowBlur = 14 * dpr
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
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [color])
  return <canvas ref={canvas} className="w-full" style={{ height }} />
}
