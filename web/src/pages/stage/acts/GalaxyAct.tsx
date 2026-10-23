import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Galaxy } from '../../../components/Galaxy'
import { PersonPicker } from '../../../components/PersonPicker'
import { PianoRoll } from '../../../components/PianoRoll'
import { Button, Chip, PlayIcon } from '../../../components/ui'
import { useI18n } from '../../../lib/i18n'
import { tribeColor } from '../../../lib/notes'
import type { Mode, Performance, StageState } from '../../../lib/types'
import { usePlayback } from '../../../lib/usePlayback'
import { ModeToggle } from '../ModeToggle'

export function GalaxyAct({
  state,
  mode,
  setMode,
  onDuel,
}: {
  state: StageState | null
  mode: Mode
  setMode: (m: Mode) => void
  onDuel: (a: string, b: string) => void
}) {
  const { t, loc, name, tag } = useI18n()
  const [selected, setSelected] = useState<Performance | null>(null)
  const [showBots, setShowBots] = useState(true)
  const [picking, setPicking] = useState(false)
  const playback = usePlayback()
  const tribes = useMemo(() => (state?.tribes ?? []).filter((tribe) => tribe.mode === mode), [state, mode])
  const byId = useMemo(() => new Map((state?.performances ?? []).map((p) => [p.id, p])), [state])

  if (!state?.hasResults) return <Empty />

  const select = (p: Performance) => {
    if (picking && selected && p.id !== selected.id) {
      setPicking(false)
      onDuel(selected.id, p.id)
      return
    }
    setSelected(p)
    playback.play(p.notes)
  }
  const close = () => {
    setSelected(null)
    setPicking(false)
    playback.stop()
  }
  const neighbors = selected
    ? state.similar.filter((s) => s.mode === mode && s.source === selected.id).sort((a, b) => a.rank - b.rank)
    : []
  const selectedTribe = selected ? tribes.find((tribe) => tribe.id === selected[`tribe_${mode}`]) : null

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_400px] gap-6 px-10 pb-8">
      <div className="glass relative overflow-hidden rounded-[32px]">
        <div className="absolute left-6 top-5 z-10 flex items-center gap-3">
          <ModeToggle mode={mode} setMode={setMode} />
          <button onClick={() => setShowBots((v) => !v)} className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-white/60 hover:text-white">
            {showBots ? t('gal.hideBots') : t('gal.showBots')}
          </button>
          <PersonPicker
            performances={state.performances}
            mode={mode}
            inline
            excludeId={picking ? selected?.id : null}
            placeholder={picking ? t('gal.searchOpponent') : t('common.searchPerson')}
            className="w-64"
            onPick={select}
          />
        </div>
        <AnimatePresence>
          {picking && selected && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute left-1/2 top-20 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#FF4FD8]/15 px-5 py-2.5 ring-1 ring-[#FF4FD8]/50 backdrop-blur"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan font-display text-xs font-bold text-ink">A</span>
              <span className="font-display font-semibold">{name(selected)}</span>
              <span className="text-white/60">{t('gal.versus')}</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF4FD8] font-display text-xs font-bold text-ink">B</span>
              <span className="text-white/80">{t('gal.clickOpponent')}</span>
              <button onClick={() => setPicking(false)} className="ml-2 text-white/50 hover:text-white">×</button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="absolute right-6 top-5 z-10 flex items-center gap-4 font-mono text-[11px] uppercase tracking-wider text-white/50">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-white bg-white/80" /> {t('gal.person')}</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/40" /> {t('gal.bot')}</span>
          <span className="flex items-center gap-1.5"><span className="text-[#FFD23F]">★</span> {t('common.ai')}</span>
        </div>
        <Galaxy
          performances={state.performances}
          tribes={state.tribes}
          similar={state.similar}
          mode={mode}
          selectedId={selected?.id}
          onSelect={select}
          showBots={showBots}
        />
      </div>

      <div className="flex min-h-0 flex-col gap-4">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div key={selected.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="glass flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-[28px] p-6 scrollbar-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Chip color={tribeColor(selected[`tribe_${mode}`])}>{selectedTribe ? loc(selectedTribe, 'name') : t('gal.noTribe')}</Chip>
                  <h3 className="mt-3 font-display text-3xl font-bold">{name(selected)}</h3>
                  {selected.profileTitle && <p className="text-lg text-white/70">{loc(selected, 'profileTitle')}</p>}
                </div>
                <button onClick={close} className="text-2xl text-white/40 hover:text-white">×</button>
              </div>
              {selected.profileText && <p className="text-[15px] leading-relaxed text-white/70">{loc(selected, 'profileText')}</p>}
              {selected.generatedText && <p className="text-[15px] leading-relaxed text-white/70">{loc(selected, 'generatedText')}</p>}
              <div className="h-28 rounded-2xl bg-black/30 p-2">
                <PianoRoll notes={selected.notes} playhead={playback.playhead} activeIndex={playback.activeIndex} height={100} compact />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="soft" onClick={() => (playback.playing ? playback.stop() : playback.play(selected.notes))}>
                  <PlayIcon playing={playback.playing} /> {t('common.play')}
                </Button>
                <Button variant={picking ? 'primary' : 'soft'} onClick={() => setPicking((v) => !v)}>
                  {picking ? t('gal.picking') : t('gal.duelWith')}
                </Button>
              </div>
              <div>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-mute">{t('gal.mostSimilar')}</p>
                <div className="space-y-2">
                  {neighbors.map((n) => {
                    const p = byId.get(n.target)
                    if (!p) return null
                    return (
                      <button key={n.target} onClick={() => onDuel(selected.id, n.target)} className="flex w-full items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-left transition hover:bg-white/10">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: tribeColor(p[`tribe_${mode}`]) }} />
                        <span className="flex-1 truncate font-medium">{name(p)}</span>
                        <span className="font-mono text-xs text-white/40">cos {n.cosine.toFixed(2)}</span>
                        <span className="font-mono text-base font-bold text-gradient">{Math.round(n.score * 100)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="tribes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto scrollbar-none">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-mute">{t('gal.tribesHint', { n: tribes.length })}</p>
              {tribes.map((tribe, i) => (
                <motion.div
                  key={tribe.id}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.12 }}
                  className="rounded-[24px] p-5"
                  style={{ background: `linear-gradient(135deg, ${tribeColor(tribe.id)}1f, transparent)`, boxShadow: `inset 0 0 0 1px ${tribeColor(tribe.id)}40` }}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-xl font-bold" style={{ color: tribeColor(tribe.id) }}>{loc(tribe, 'name')}</h4>
                    <span className="font-mono text-sm text-white/50">{tribe.size}</span>
                  </div>
                  <p className="mt-1 text-sm text-white/65">{loc(tribe, 'description')}</p>
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-white/35">
                    {tribe.facts.avgNotesPerSecond} {t('common.nps')} · {tribe.facts.commonTags.slice(0, 2).map(tag).join(' · ')}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export function Empty() {
  const { t } = useI18n()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="font-display text-4xl font-bold">{t('empty.title')}</p>
      <p className="text-white/50">{t('empty.text')}</p>
    </div>
  )
}
