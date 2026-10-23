import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Aurora } from '../../components/Aurora'
import { LangToggle } from '../../components/LangToggle'
import { Button, Dot, Logo, Neo4jLogo } from '../../components/ui'
import { api, API_URL } from '../../lib/api'
import { unlockAudio } from '../../lib/audio'
import { getLang, setLang, useI18n, type Key } from '../../lib/i18n'
import type { Mode } from '../../lib/types'
import { Applications } from './acts/Applications'
import { Ask } from './acts/Ask'
import { Compose } from './acts/Compose'
import { Duel } from './acts/Duel'
import { GalaxyAct } from './acts/GalaxyAct'
import { Lobby } from './acts/Lobby'
import { Pipeline } from './acts/Pipeline'
import { useStageData } from './useStageData'

const ACTS = [0, 1, 2, 3, 4, 5, 6] as const

export function Stage() {
  const { t } = useI18n()
  const data = useStageData()
  const [act, setAct] = useState(0)
  const [mode, setMode] = useState<Mode>('full')
  const [pair, setPair] = useState<[string, string] | null>(null)
  const [controls, setControls] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'ArrowRight') setAct((a) => Math.min(a + 1, ACTS.length - 1))
      if (e.key === 'ArrowLeft') setAct((a) => Math.max(a - 1, 0))
      if (e.key === 'm') setMode((m) => (m === 'full' ? 'notes' : 'full'))
      if (e.key === 'l') setLang(getLang() === 'pt' ? 'en' : 'pt')
      if (e.key === 'f') document.documentElement.requestFullscreen?.()
      if (/^[1-7]$/.test(e.key)) setAct(Number(e.key) - 1)
    }
    window.addEventListener('keydown', onKey)
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (data.job?.status === 'done' && act === 1) {
      const id = window.setTimeout(() => setAct(2), 1800)
      return () => window.clearTimeout(id)
    }
  }, [data.job?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const sample = useMemo(() => {
    const perfs = data.state?.performances ?? []
    const humans = [...perfs].reverse().filter((p) => !p.isBot && !p.isGenerated)
    return humans.find((p) => p.emb_full) ?? humans[0] ?? perfs[0] ?? null
  }, [data.state])

  const run = async () => {
    await data.run()
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <Aurora />
      <div className="relative z-10 flex h-full flex-col">
        <header className="flex items-center justify-between px-10 py-6">
          <div className="flex items-center gap-5">
            <Neo4jLogo />
            <span className="h-7 w-px bg-white/15" />
            <Logo />
          </div>
          <nav className="flex items-center gap-1 rounded-full bg-black/30 p-1 ring-1 ring-white/10 backdrop-blur">
            {ACTS.map((i) => (
              <button key={i} onClick={() => setAct(i)} className="relative rounded-full px-4 py-2 text-sm">
                {act === i && <motion.span layoutId="act-pill" className="absolute inset-0 rounded-full bg-white/12 ring-1 ring-white/20" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                <span className={`relative font-display ${act === i ? 'text-white' : 'text-white/50 hover:text-white/80'}`}>
                  <span className="mr-1.5 font-mono text-[10px] text-white/35">{i + 1}</span>
                  {t(`act.${i}` as Key)}
                </span>
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <Status label="Neo4j" ok={data.online && !!data.health?.neo4j} />
            <Status label={data.health?.backend === 'local' ? t('status.fastpathLocal') : 'AGA'} ok={data.health?.session === 'ready' || data.health?.backend === 'local'} pending={data.health?.session === 'starting'} />
            <Status label="LLM" ok={!!data.health?.llm} />
            <LangToggle />
            <button onClick={() => setControls((v) => !v)} className="rounded-full p-2 text-white/50 ring-1 ring-white/10 hover:text-white" aria-label={t('stage.controls')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
            </button>
          </div>
        </header>

        {!data.online && (
          <div className="mx-10 mb-4 rounded-2xl bg-[#FF3D71]/15 px-5 py-3 text-sm text-[#FF9AB3] ring-1 ring-[#FF3D71]/40">
            {t('stage.offlineA')} <span className="font-mono">{API_URL}</span>. {t('stage.offlineB')} <span className="font-mono">uvicorn app.main:app</span> {t('stage.offlineC')}
          </div>
        )}

        <main className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={act}
              className="absolute inset-0"
              initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
              transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {act === 0 && <Lobby lobby={data.lobby} />}
              {act === 1 && <Pipeline job={data.job} health={data.health} sample={sample} onRun={run} />}
              {act === 2 && (
                <GalaxyAct
                  state={data.state}
                  mode={mode}
                  setMode={setMode}
                  onDuel={(a, b) => {
                    setPair([a, b])
                    setAct(3)
                  }}
                />
              )}
              {act === 3 && <Duel state={data.state} mode={mode} setMode={setMode} pair={pair} setPair={setPair} />}
              {act === 4 && <Compose state={data.state} refresh={data.refresh} />}
              {act === 5 && (
                <Ask
                  state={data.state}
                  mode={mode}
                  onDuel={(a, b) => {
                    setPair([a, b])
                    setAct(3)
                  }}
                />
              )}
              {act === 6 && <Applications />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {controls && <Controls onClose={() => setControls(false)} refresh={data.refresh} session={data.health?.session} />}
      </AnimatePresence>
    </div>
  )
}

function Status({ label, ok, pending }: { label: string; ok: boolean; pending?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-white/55">
      <Dot color={pending ? '#FFD23F' : ok ? '#3DDC97' : '#FF3D71'} pulse={pending || ok} />
      {label}
    </span>
  )
}

function Controls({ onClose, refresh, session }: { onClose: () => void; refresh: () => Promise<void>; session?: string }) {
  const { t, err } = useI18n()
  const [msg, setMsg] = useState<string | null>(null)
  const act = (label: string, fn: () => Promise<unknown>) => async () => {
    setMsg(`${label}...`)
    try {
      const r = await fn()
      await refresh()
      setMsg(`${label}: ${JSON.stringify(r)}`)
    } catch (e) {
      setMsg(`${label}: ${e instanceof Error ? err(e.message) : t('ctrl.error')}`)
    }
  }
  return (
    <motion.aside
      initial={{ x: 420 }}
      animate={{ x: 0 }}
      exit={{ x: 420 }}
      transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      className="glass fixed right-4 top-4 bottom-4 z-50 flex w-96 flex-col gap-3 rounded-[28px] p-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-bold">{t('ctrl.title')}</h3>
        <button onClick={onClose} className="text-2xl text-white/40 hover:text-white">×</button>
      </div>
      <p className="text-sm text-white/50">{t('ctrl.session')} <span className="font-mono">{session ?? '-'}</span></p>
      <Button variant="soft" onClick={act(t('ctrl.warmup'), api.warmup)}>{t('ctrl.warmup')}</Button>
      <Button variant="soft" onClick={act(t('ctrl.seedShort'), () => api.seed(6))}>{t('ctrl.seed')}</Button>
      <Button variant="soft" onClick={act(t('ctrl.reloadShort'), async () => 'ok')}>{t('ctrl.reload')}</Button>
      <div className="my-2 h-px bg-white/10" />
      <Button variant="ghost" onClick={act(t('ctrl.clearPeopleShort'), () => api.reset(true))}>{t('ctrl.clearPeople')}</Button>
      <Button variant="ghost" onClick={act(t('ctrl.clearAll'), () => api.reset(false))}>{t('ctrl.clearAll')}</Button>
      <Button variant="ghost" onClick={act(t('ctrl.endSession'), api.deleteSession)}>{t('ctrl.endSession')}</Button>
      <div className="mt-auto space-y-1 font-mono text-[11px] text-white/40">
        <p>{t('ctrl.shortcuts')}</p>
        {msg && <p className="break-words text-white/60">{msg}</p>}
      </div>
    </motion.aside>
  )
}
