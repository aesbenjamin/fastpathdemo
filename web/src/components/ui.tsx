import { motion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-5xl sm:text-6xl' : size === 'md' ? 'text-2xl' : 'text-lg'
  const icon = size === 'lg' ? 52 : size === 'md' ? 30 : 22
  return (
    <div className="flex items-center gap-3">
      <svg width={icon} height={icon} viewBox="0 0 64 64" aria-hidden>
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2EC4FF" />
            <stop offset="0.5" stopColor="#9B5CFF" />
            <stop offset="1" stopColor="#FF4FD8" />
          </linearGradient>
        </defs>
        <path d="M8 46 L22 28 L36 38 L56 14" stroke="url(#logo-g)" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="46" r="6" fill="#2EC4FF" />
        <circle cx="22" cy="28" r="6" fill="#4D7CFF" />
        <circle cx="36" cy="38" r="6" fill="#9B5CFF" />
        <circle cx="56" cy="14" r="6" fill="#FF4FD8" />
      </svg>
      <span className={`font-display font-bold tracking-tight ${text}`}>
        Fast<span className="text-gradient">Path</span> <span className="font-medium text-white/70">Music</span>
      </span>
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className = '',
  size = 'md',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'soft'
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = { sm: 'px-3.5 py-2 text-sm', md: 'px-5 py-3 text-base', lg: 'px-7 py-4 text-lg' }
  const styles = {
    primary:
      'text-ink font-semibold bg-[linear-gradient(100deg,#2EC4FF,#9B5CFF_55%,#FF4FD8)] shadow-[0_8px_40px_-8px_rgba(155,92,255,.8)] hover:brightness-110',
    ghost: 'text-white/80 border border-white/12 hover:bg-white/8 hover:text-white',
    soft: 'text-white bg-white/8 hover:bg-white/14 border border-white/8',
  }
  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-display transition disabled:cursor-not-allowed disabled:opacity-35 ${sizes[size]} ${styles[variant]} ${className}`}
    >
      {children}
    </motion.button>
  )
}

export function Chip({ children, color = '#8d8aa8', className = '' }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider ${className}`}
      style={{ color, background: `${color}18`, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      {children}
    </span>
  )
}

export function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && <span className="absolute inset-0 rounded-full" style={{ background: color, animation: 'pulse-ring 1.6s ease-out infinite' }} />}
      <span className="relative h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
    </span>
  )
}

/** Reveals text character by character, like the model is "speaking". */
export function Typewriter({ text, speed = 18, className = '' }: { text: string; speed?: number; className?: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    if (!text) return
    const id = window.setInterval(() => setN((v) => (v >= text.length ? (window.clearInterval(id), v) : v + 1)), speed)
    return () => window.clearInterval(id)
  }, [text, speed])
  return (
    <span className={className}>
      {text.slice(0, n)}
      {n < text.length && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-white/80" />}
    </span>
  )
}

export function Gauge({ value, label, color, size = 120 }: { value: number; label: string; color: string; size?: number }) {
  const r = size / 2 - 10
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.08)" strokeWidth={8} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
        <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" className="fill-white font-display" fontSize={size / 4.2} fontWeight={700}>
          {(v * 100).toFixed(0)}
        </text>
      </svg>
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">{label}</span>
    </div>
  )
}

export function Spinner({ color = '#2EC4FF' }: { color?: string }) {
  return (
    <motion.span
      className="inline-block h-4 w-4 rounded-full border-2 border-white/15"
      style={{ borderTopColor: color }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
    />
  )
}

export function PlayIcon({ playing }: { playing?: boolean }) {
  return playing ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5Z" /></svg>
  )
}
