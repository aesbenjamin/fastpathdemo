import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Galaxy } from '../../../components/Galaxy'
import { PianoRoll } from '../../../components/PianoRoll'
import { Button, Chip, PlayIcon, Typewriter } from '../../../components/ui'
import { api } from '../../../lib/api'
import { useI18n } from '../../../lib/i18n'
import { NOTES, tribeColor } from '../../../lib/notes'
import type { Composition, StageState } from '../../../lib/types'
import { usePlayback } from '../../../lib/usePlayback'
import { Empty } from './GalaxyAct'

export function Compose({ state, refresh }: { state: StageState | null; refresh: () => Promise<void> }) {
  const { t, err, loc, name } = useI18n()
  const tribes = (state?.tribes ?? []).filter((tribe) => tribe.mode === 'full')
  const [tribeId, setTribeId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Composition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const playback = usePlayback('ai')

  if (!state?.hasResults) return <Empty />
  const target = tribes.find((tribe) => tribe.id === (tribeId ?? tribes[0]?.id))

  const compose = async () => {
    if (!target) return
    setBusy(true)
    setResult(null)
    setError(null)
    try {
      const r = await api.compose(target.id)
      await refresh()
      setResult(r)
      window.setTimeout(() => playback.play(r.notes), 1400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'i18n:compose_failed')
    } finally {
      setBusy(false)
    }
  }

  const landed = tribes.find((tribe) => tribe.id === result?.landedTribe)
  const byId = new Map(state.performances.map((p) => [p.id, p]))

  return (
    <div className="grid h-full grid-cols-[420px_minmax(0,1fr)] gap-6 px-10 pb-8">
      <div className="flex min-h-0 flex-col gap-4">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.35em] text-mute">{t('comp.kicker')}</p>
          <h2 className="mt-2 font-display text-5xl font-bold leading-[1] tracking-tight">
            {t('comp.titleA')} <span className="text-gradient">{t('comp.titleB')}</span>
          </h2>
          <p className="mt-3 text-white/55">{t('comp.sub')}</p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto scrollbar-none">
          {tribes.map((tribe) => {
            const on = tribe.id === target?.id
            const color = tribeColor(tribe.id)
            return (
              <button
                key={tribe.id}
                onClick={() => setTribeId(tribe.id)}
                className="rounded-[22px] p-4 text-left transition"
                style={{ background: on ? `linear-gradient(135deg, ${color}30, ${color}08)` : 'rgba(255,255,255,.03)', boxShadow: `inset 0 0 0 ${on ? 2 : 1}px ${color}${on ? 'aa' : '33'}` }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-bold" style={{ color }}>{loc(tribe, 'name')}</span>
                  <span className="font-mono text-xs text-white/40">{tribe.size}</span>
                </div>
                <p className="text-sm text-white/55">{loc(tribe, 'description')}</p>
              </button>
            )
          })}
        </div>
        <Button size="lg" onClick={compose} disabled={busy || !target}>
          {busy ? t('comp.busy') : t('comp.composeFor', { name: loc(target, 'name') })}
        </Button>
        {error && <p className="text-sm text-[#FF3D71]">{err(error)}</p>}
      </div>

      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-5">
        <div className="glass relative overflow-hidden rounded-[32px]">
          <Galaxy performances={state.performances} tribes={state.tribes} mode="full" landingId={result?.performanceId} selectedId={result?.performanceId} compact />
          <AnimatePresence>
            {busy && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-ink/60 backdrop-blur-sm">
                <Equalizer />
                <p className="font-display text-2xl text-white/80">{t('comp.modelComposing')}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {result && landed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.2 }}
              className="absolute bottom-5 left-5 rounded-2xl px-5 py-3"
              style={{ background: `${tribeColor(landed.id)}22`, boxShadow: `inset 0 0 0 1px ${tribeColor(landed.id)}66` }}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/50">{t('comp.landedIn')}</p>
              <p className="font-display text-2xl font-bold" style={{ color: tribeColor(landed.id) }}>
                {loc(landed, 'name')} {result.landedInTarget ? t('comp.hit') : t('comp.miss')}
              </p>
            </motion.div>
          )}
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 rounded-[32px] p-6">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Chip color="#FFD23F">{result.generatedBy === 'llm' ? t('comp.byLlm') : t('comp.fallback')}</Chip>
                <Chip color="#2EC4FF">{t('common.notes', { n: result.notes.length })}</Chip>
              </div>
              <h3 className="font-display text-3xl font-bold">
                <Typewriter key={loc(result, 'title')} text={loc(result, 'title')} speed={35} />
              </h3>
              <p className="text-white/65">{loc(result, 'text')}</p>
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/40">
                {t('comp.neighbors')} {result.neighbors.slice(0, 3).map((n) => name(byId.get(n.target))).filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="h-28 rounded-2xl bg-black/30 p-2">
                <PianoRoll notes={result.notes} playhead={playback.playhead} activeIndex={playback.activeIndex} height={100} compact accent="#FFD23F" />
              </div>
              <Button variant="soft" onClick={() => (playback.playing ? playback.stop() : playback.play(result.notes))}>
                <PlayIcon playing={playback.playing} /> {t('comp.play')}
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function Equalizer() {
  return (
    <div className="flex h-24 items-end gap-2">
      {NOTES.map((n, i) => (
        <motion.span
          key={n.code}
          className="w-4 rounded-full"
          style={{ background: n.color, boxShadow: `0 0 16px ${n.color}` }}
          animate={{ height: ['20%', '100%', '35%', '80%', '20%'] }}
          transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.1, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}
