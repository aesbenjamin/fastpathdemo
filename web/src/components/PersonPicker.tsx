import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { tribeColor } from '../lib/notes'
import type { Mode, Performance } from '../lib/types'

type Props = {
  performances: Performance[]
  mode: Mode
  onPick: (p: Performance) => void
  /** Keep the input open and empty after picking (search box behaviour). */
  inline?: boolean
  placeholder?: string
  excludeId?: string | null
  autoFocus?: boolean
  size?: 'md' | 'lg'
  className?: string
}

/** Search-as-you-type over all melodies: people first, then robots and AI compositions. */
export function PersonPicker({ performances, mode, onPick, inline, placeholder, excludeId, autoFocus, size = 'md', className = '' }: Props) {
  const { t, name } = useI18n()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(!!inline && !!autoFocus)
  const [cursor, setCursor] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  const list = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const needle = norm(q.trim())
    return performances
      .filter((p) => p.id !== excludeId && (!needle || norm(p.name).includes(needle) || norm(name(p)).includes(needle)))
      .sort((a, b) => Number(!!a.isBot || !!a.isGenerated) - Number(!!b.isBot || !!b.isGenerated) || name(a).localeCompare(name(b)))
      .slice(0, 12)
  }, [performances, q, excludeId, name])

  useEffect(() => setCursor(0), [q])

  const pick = (p: Performance) => {
    onPick(p)
    setQ('')
    if (!inline) setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, list.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && list[cursor]) { e.preventDefault(); pick(list[cursor]) }
    if (e.key === 'Escape') { setOpen(false); input.current?.blur() }
  }

  const text = size === 'lg' ? 'text-xl' : 'text-[15px]'
  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2 rounded-2xl bg-black/35 px-4 py-2.5 ring-1 ring-white/10 focus-within:ring-white/30">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input
          ref={input}
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
          placeholder={placeholder ?? t('common.searchPerson')}
          className={`w-full bg-transparent font-display outline-none placeholder:text-white/30 ${text}`}
        />
      </div>
      <AnimatePresence>
        {open && list.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl bg-[#14122a] p-1.5 shadow-2xl ring-1 ring-white/10 scrollbar-none"
          >
            {list.map((p, i) => (
              <li key={p.id}>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                  onMouseEnter={() => setCursor(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${i === cursor ? 'bg-white/10' : ''}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: tribeColor(p[`tribe_${mode}`]) }} />
                  <span className="flex-1 truncate font-medium">{name(p)}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-white/35">
                    {p.isGenerated ? t('common.ai') : p.isBot ? t('common.echo') : t('common.notes', { n: p.noteCount })}
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
