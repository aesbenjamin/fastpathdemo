import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { useI18n, type Lang } from '../../../lib/i18n'
import { NOTES } from '../../../lib/notes'
import type { Lobby as LobbyData } from '../../../lib/types'

export function participantUrl(lang?: Lang) {
  const base = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || `${window.location.origin}${window.location.pathname}`
  if (!lang) return base
  const url = new URL(base)
  url.searchParams.set('lang', lang)
  return url.toString()
}

export function Lobby({ lobby }: { lobby: LobbyData | null }) {
  const { t, lang } = useI18n()
  const url = participantUrl(lang)
  const count = lobby?.count ?? 0
  return (
    <div className="grid h-full grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-14 px-16">
      <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col items-center gap-6">
        <div className="relative rounded-[36px] p-[3px]" style={{ background: 'linear-gradient(135deg,#2EC4FF,#9B5CFF,#FF4FD8)' }}>
          <div className="rounded-[34px] bg-white p-7 shadow-[0_0_120px_rgba(155,92,255,.55)]">
            <QRCodeSVG value={url} size={340} bgColor="#ffffff" fgColor="#05040b" level="M" />
          </div>
        </div>
        <p className="font-mono text-sm text-white/60">{participantUrl().replace(/^https?:\/\//, '')}</p>
      </motion.div>

      <div className="space-y-10">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.35em] text-mute">{t('lobby.scan')}</p>
          <h1 className="mt-4 font-display text-7xl font-bold leading-[0.95] tracking-tight">
            {t('lobby.title1')}
            <br />
            <span className="text-gradient">{t('lobby.title2')}</span>
          </h1>
        </div>

        <div className="flex items-end gap-12">
          <Counter value={count} label={t('lobby.people')} />
          <Counter value={lobby?.totalNotes ?? 0} label={t('lobby.events')} small />
          <Counter value={lobby?.bots ?? 0} label={t('lobby.bots')} small />
        </div>

        <div className="flex min-h-40 flex-wrap content-start gap-2.5">
          <AnimatePresence initial={false}>
            {(lobby?.recent ?? []).map((p, i) => {
              const color = NOTES[(p.name.length + i) % NOTES.length].color
              return (
                <motion.span
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: -40, scale: 0.6 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="rounded-full px-4 py-2 font-display text-lg font-semibold"
                  style={{ color, background: `${color}18`, boxShadow: `inset 0 0 0 1px ${color}55, 0 0 24px ${color}22` }}
                >
                  {p.name}
                  <span className="ml-2 font-mono text-xs text-white/40">{p.noteCount}</span>
                </motion.span>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function Counter({ value, label, small }: { value: number; label: string; small?: boolean }) {
  return (
    <div>
      <motion.p
        key={value}
        initial={{ y: -12, opacity: 0.4 }}
        animate={{ y: 0, opacity: 1 }}
        className={`font-display font-bold tabular-nums ${small ? 'text-5xl text-white/80' : 'text-[112px] leading-none text-gradient'}`}
      >
        {value}
      </motion.p>
      <p className="mt-2 font-mono text-xs uppercase tracking-[0.25em] text-mute">{label}</p>
    </div>
  )
}
