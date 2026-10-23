import { motion } from 'framer-motion'
import { useI18n, type Lang } from '../lib/i18n'

const OPTIONS: { id: Lang; label: string }[] = [
  { id: 'pt', label: 'PT' },
  { id: 'en', label: 'EN' },
]

export function LangToggle({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { lang, setLang, t } = useI18n()
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'
  return (
    <div role="group" aria-label={t('lang.label')} className="relative flex rounded-full bg-black/40 p-0.5 ring-1 ring-white/10 backdrop-blur">
      {OPTIONS.map((o) => (
        <button key={o.id} onClick={() => setLang(o.id)} aria-pressed={lang === o.id} className={`relative z-10 font-mono font-semibold tracking-wider ${pad}`}>
          {lang === o.id && (
            <motion.span layoutId={`lang-pill-${size}`} className="absolute inset-0 -z-10 rounded-full bg-white" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />
          )}
          <span className={lang === o.id ? 'text-ink' : 'text-white/55'}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}
