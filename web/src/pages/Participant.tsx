import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Aurora } from '../components/Aurora'
import { ChainPreview } from '../components/ChainPreview'
import { Keyboard } from '../components/Keyboard'
import { LangToggle } from '../components/LangToggle'
import { PianoRoll } from '../components/PianoRoll'
import { Button, Chip, Logo, Neo4jLogo, PlayIcon, Spinner } from '../components/ui'
import { Visualizer } from '../components/Visualizer'
import { playNote, unlockAudio } from '../lib/audio'
import { botName, useI18n } from '../lib/i18n'
import { fetchMyResult, submitPerformance, type MyResult } from '../lib/neo4j'
import { MAX_DURATION_MS, MIN_NOTES, tribeColor, type NoteEvent } from '../lib/notes'
import { usePlayback } from '../lib/usePlayback'

type Step = 'intro' | 'play' | 'waiting' | 'reveal'

const store = {
  get: (k: string) => localStorage.getItem(`fpm.${k}`),
  set: (k: string, v: string) => localStorage.setItem(`fpm.${k}`, v),
  clear: () => ['perfId', 'notes'].forEach((k) => localStorage.removeItem(`fpm.${k}`)),
}

export function Participant() {
  const [name, setName] = useState(store.get('name') ?? '')
  const [perfId, setPerfId] = useState(store.get('perfId'))
  const [step, setStep] = useState<Step>(perfId ? 'waiting' : 'intro')
  const [notes, setNotes] = useState<NoteEvent[]>(() => JSON.parse(store.get('notes') ?? '[]'))
  const [result, setResult] = useState<MyResult | null>(null)

  const start = async () => {
    await unlockAudio()
    store.set('name', name.trim())
    setStep('play')
  }

  const submitted = (id: string, recorded: NoteEvent[]) => {
    store.set('perfId', id)
    store.set('notes', JSON.stringify(recorded))
    setPerfId(id)
    setNotes(recorded)
    setStep('waiting')
  }

  useEffect(() => {
    if (step !== 'waiting' || !perfId) return
    let alive = true
    const poll = async () => {
      try {
        const r = await fetchMyResult(perfId)
        if (!alive) return
        if (r === null) {
          store.clear()
          setPerfId(null)
          setStep('intro')
        } else if (r.profileTitle) {
          setResult(r)
          setStep('reveal')
        }
      } catch {
        /* keep polling */
      }
    }
    poll()
    const id = window.setInterval(poll, 3000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [step, perfId])

  const again = () => {
    store.clear()
    setPerfId(null)
    setResult(null)
    setNotes([])
    setStep('play')
  }

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      <Aurora intensity={0.7} />
      <div className="relative z-10 flex min-h-dvh flex-col px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-[max(env(safe-area-inset-top),16px)]">
        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <Screen key="intro">
              <Intro name={name} setName={setName} onStart={start} />
            </Screen>
          )}
          {step === 'play' && (
            <Screen key="play">
              <Recorder name={name} onSubmitted={submitted} />
            </Screen>
          )}
          {step === 'waiting' && (
            <Screen key="waiting">
              <Waiting name={name} notes={notes} />
            </Screen>
          )}
          {step === 'reveal' && result && (
            <Screen key="reveal">
              <Reveal name={name} notes={notes} result={result} onAgain={again} />
            </Screen>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -24, filter: 'blur(8px)' }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}

function Brand() {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Neo4jLogo size="sm" />
        <span className="h-5 w-px bg-white/15" />
        <Logo size="sm" />
      </div>
      <LangToggle size="sm" />
    </div>
  )
}

function Intro({ name, setName, onStart }: { name: string; setName: (v: string) => void; onStart: () => void }) {
  const { t } = useI18n()
  const ok = name.trim().length >= 2
  return (
    <div className="flex flex-1 flex-col justify-between gap-10 py-6">
      <Brand />
      <div className="space-y-6">
        <motion.h1
          className="font-display text-[44px] font-bold leading-[1.02] tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {t('p.title1')}
          <br />
          {t('p.title2a')} <span className="text-gradient">{t('p.title2b')}</span>.
          <br />
          {t('p.title3')}
        </motion.h1>
        <p className="max-w-sm text-base leading-relaxed text-white/65">
          {t('p.introA')} <b className="text-white">FastPath</b> {t('p.introB')}
        </p>
      </div>
      <div className="space-y-3">
        <label className="font-mono text-[11px] uppercase tracking-[0.25em] text-mute">{t('p.nameLabel')}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          onKeyDown={(e) => e.key === 'Enter' && ok && onStart()}
          placeholder={t('p.namePlaceholder')}
          className="glass w-full rounded-2xl px-5 py-4 font-display text-xl outline-none placeholder:text-white/25 focus:border-white/30"
          autoComplete="off"
        />
        <Button size="lg" className="w-full" disabled={!ok} onClick={onStart}>
          {t('p.enter')}
        </Button>
      </div>
    </div>
  )
}

function Recorder({ name, onSubmitted }: { name: string; onSubmitted: (id: string, notes: NoteEvent[]) => void }) {
  const { t, err } = useI18n()
  const [notes, setNotes] = useState<NoteEvent[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [finished, setFinished] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t0 = useRef<number | null>(null)
  const timer = useRef(0)
  const playback = usePlayback()

  const stopRecording = () => {
    window.clearInterval(timer.current)
    setFinished(true)
  }

  const press = (code: number) => {
    playNote(code)
    if (finished) return
    const now = performance.now()
    if (t0.current === null) {
      t0.current = now
      timer.current = window.setInterval(() => {
        const e = performance.now() - (t0.current ?? 0)
        setElapsed(Math.min(e, MAX_DURATION_MS))
        if (e >= MAX_DURATION_MS) stopRecording()
      }, 50)
    }
    const t = now - t0.current
    if (t < MAX_DURATION_MS) setNotes((n) => [...n, { t: Math.round(t * 10) / 10, code }])
  }

  const reset = () => {
    playback.stop()
    window.clearInterval(timer.current)
    t0.current = null
    setNotes([])
    setElapsed(0)
    setFinished(false)
    setError(null)
  }

  useEffect(() => () => window.clearInterval(timer.current), [])

  const send = async () => {
    stopRecording()
    playback.stop()
    setSending(true)
    setError(null)
    try {
      const id = await submitPerformance(name, notes)
      onSubmitted(id, notes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'i18n:send_failed')
      setSending(false)
    }
  }

  const recording = t0.current !== null && !finished
  const progress = elapsed / MAX_DURATION_MS
  const canSend = notes.length >= MIN_NOTES && !sending

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-mute">{t('p.playingAs')}</p>
          <p className="font-display text-xl font-semibold">{name}</p>
        </div>
        <TimerRing progress={progress} recording={recording} seconds={Math.ceil((MAX_DURATION_MS - elapsed) / 1000)} />
      </header>

      <div className="glass relative overflow-hidden rounded-3xl p-3">
        <div className="absolute left-4 top-3 z-10 flex items-center gap-2">
          {recording ? <Chip color="#FF3D71">{t('p.recording')}</Chip> : finished ? <Chip color="#3DDC97">{t('p.ready')}</Chip> : <Chip>{t('p.waitingFirst')}</Chip>}
          <Chip color="#2EC4FF">{t('common.events', { n: notes.length })}</Chip>
        </div>
        <div className="h-36 pt-7">
          {notes.length ? (
            <PianoRoll
              notes={notes}
              durationMs={Math.max(elapsed, 4000)}
              playhead={playback.playhead ?? (recording ? elapsed : null)}
              activeIndex={playback.activeIndex}
              height={112}
              compact
            />
          ) : (
            <div className="flex h-full items-center justify-center text-center text-sm text-white/45">
              {t('p.hint1')}
              <br />
              {t('p.hint2')}
            </div>
          )}
        </div>
        <Visualizer height={28} />
      </div>

      <div className="flex min-h-[280px] flex-1 flex-col">
        <Keyboard onPress={press} />
      </div>

      {error && <p className="text-center text-sm text-[#FF3D71]">{err(error)}</p>}
      <div className="grid grid-cols-[auto_auto_1fr] gap-2">
        <Button variant="ghost" onClick={reset} disabled={!notes.length || sending}>
          {t('p.redo')}
        </Button>
        <Button variant="soft" onClick={() => (playback.playing ? playback.stop() : playback.play(notes))} disabled={!notes.length}>
          <PlayIcon playing={playback.playing} />
        </Button>
        <Button onClick={send} disabled={!canSend}>
          {sending ? <Spinner color="#05040b" /> : null}
          {sending ? t('p.saving') : notes.length < MIN_NOTES ? t('p.minNotes', { n: MIN_NOTES }) : t('p.send')}
        </Button>
      </div>
    </div>
  )
}

function TimerRing({ progress, recording, seconds }: { progress: number; recording: boolean; seconds: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-14 w-14">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <circle cx="28" cy="28" r={r} stroke="rgba(255,255,255,.1)" strokeWidth="4" fill="none" />
        <circle
          cx="28"
          cy="28"
          r={r}
          stroke={recording ? '#FF3D71' : '#2EC4FF'}
          strokeWidth="4"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .1s linear', filter: `drop-shadow(0 0 6px ${recording ? '#FF3D71' : '#2EC4FF'})` }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-sm">{seconds}s</span>
    </div>
  )
}

function Waiting({ name, notes }: { name: string; notes: NoteEvent[] }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-1 flex-col gap-6 py-2">
      <div className="flex justify-end">
        <LangToggle size="sm" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        <div className="relative flex h-44 w-44 items-center justify-center">
          {[0, 0.6, 1.2].map((d) => (
            <span
              key={d}
              className="absolute inset-0 rounded-full border border-white/30"
              style={{ animation: `pulse-ring 2.4s ${d}s ease-out infinite` }}
            />
          ))}
          <motion.div
            className="h-28 w-28 rounded-full"
            style={{ background: 'conic-gradient(from 0deg,#2EC4FF,#9B5CFF,#FF4FD8,#FFD23F,#2EC4FF)', filter: 'blur(1px)' }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
          />
          <div className="absolute h-24 w-24 rounded-full bg-ink/80 backdrop-blur" />
          <span className="absolute font-display text-3xl font-bold">{notes.length}</span>
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-3xl font-bold">{t('p.waitTitle')}</h2>
          <p className="mx-auto max-w-xs text-white/60">
            {t('p.waitTextA', { n: notes.length })} <span className="font-mono text-cyan">:NEXT_EVENT</span>. {t('p.waitTextB')}
          </p>
        </div>
        <div className="glass w-full max-w-md rounded-3xl p-4">
          <ChainPreview name={name} notes={notes} max={6} />
        </div>
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-mute">
          <Spinner /> {t('p.waitingFastPath')}
        </div>
      </div>
    </div>
  )
}

function Reveal({ name, notes, result, onAgain }: { name: string; notes: NoteEvent[]; result: MyResult; onAgain: () => void }) {
  const { t, loc, lang } = useI18n()
  const playback = usePlayback()
  const color = tribeColor(result.tribeId)
  return (
    <div className="flex flex-1 flex-col justify-center gap-5 py-4" style={{ perspective: 1200 }}>
      <div className="flex justify-end">
        <LangToggle size="sm" />
      </div>
      <motion.div
        initial={{ rotateY: 180, scale: 0.85, opacity: 0 }}
        animate={{ rotateY: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
        className="border-gradient relative overflow-hidden rounded-[32px] p-6"
        style={{ ['--from' as string]: color, ['--to' as string]: '#FF4FD8', background: `radial-gradient(120% 80% at 0% 0%, ${color}30, transparent 60%), linear-gradient(180deg,#14122a,#0a0916)` }}
      >
        <div className="flex items-center justify-between">
          <Chip color={color}>{t('p.tribe')}</Chip>
          <Neo4jLogo size="sm" className="text-white/70" />
        </div>
        <p className="mt-3 font-display text-lg font-semibold" style={{ color }}>
          {loc(result, 'tribeName')}
        </p>
        <h2 className="mt-5 font-display text-[38px] font-bold leading-[1.02] tracking-tight">{loc(result, 'profileTitle')}</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-white/75">{loc(result, 'profileText')}</p>

        <div className="mt-6 h-24 rounded-2xl bg-black/25 p-2">
          <PianoRoll notes={notes} playhead={playback.playhead} activeIndex={playback.activeIndex} height={80} compact />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Stat label={t('p.statNotes')} value={String(notes.length)} />
          <Stat label={t('common.nps')} value={(result.notesPerSecond ?? 0).toFixed(1)} />
          <Stat label={t('p.statOriginality')} value={`${result.originality ?? 0}%`} />
        </div>

        {result.soulmate && (
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-mute">{t('p.soulmate')}</p>
              <p className="font-display text-lg font-semibold">
                {result.soulmateIsBot ? botName(result.soulmate, lang) : result.soulmate}
                {result.soulmateIsBot && <span className="ml-2 text-xs text-white/40">{t('p.botTag')}</span>}
              </p>
            </div>
            {result.score != null && <span className="font-mono text-2xl font-bold text-gradient">{Math.round(result.score * 100)}</span>}
          </div>
        )}
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-white/30">{name}</p>
      </motion.div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="soft" onClick={() => (playback.playing ? playback.stop() : playback.play(notes))}>
          <PlayIcon playing={playback.playing} /> <span className="whitespace-nowrap">{t('p.listenAgain')}</span>
        </Button>
        <Button variant="ghost" onClick={onAgain}>
          {t('p.playAnother')}
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 px-2 py-3">
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">{label}</p>
    </div>
  )
}
