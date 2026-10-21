import * as Tone from 'tone'
import { NOTES, type NoteEvent } from './notes'

export type Voice = 'main' | 'duet' | 'ai'

type Rig = {
  voices: Record<Voice, Tone.PolySynth>
  analyser: Tone.Analyser
}

let rig: Rig | null = null

function build(): Rig {
  const analyser = new Tone.Analyser('waveform', 512)
  const limiter = new Tone.Limiter(-2).toDestination()
  const reverb = new Tone.Reverb({ decay: 3.2, wet: 0.32 }).connect(limiter)
  const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.22, wet: 0.14 }).connect(reverb)
  reverb.connect(analyser)

  const main = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fattriangle', count: 3, spread: 18 },
    envelope: { attack: 0.004, decay: 0.35, sustain: 0.18, release: 1.4 },
    volume: -9,
  })
  const duet = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01,
    modulationIndex: 9,
    envelope: { attack: 0.002, decay: 0.6, sustain: 0.05, release: 1.6 },
    modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.4 },
    volume: -12,
  })
  const ai = new Tone.PolySynth(Tone.AMSynth, {
    harmonicity: 1.5,
    envelope: { attack: 0.02, decay: 0.4, sustain: 0.3, release: 2.2 },
    volume: -10,
  })
  main.connect(new Tone.Panner(-0.25).connect(delay))
  duet.connect(new Tone.Panner(0.35).connect(delay))
  ai.connect(new Tone.Chorus(3, 2.5, 0.5).start().connect(delay))
  return { voices: { main, duet, ai }, analyser }
}

export async function unlockAudio() {
  await Tone.start()
  if (!rig) rig = build()
}

export function analyser(): Tone.Analyser | null {
  return rig?.analyser ?? null
}

export function playNote(code: number, voice: Voice = 'main') {
  if (!rig) rig = build()
  if (Tone.getContext().state !== 'running') void Tone.start()
  rig.voices[voice].triggerAttackRelease(NOTES[code].name, '8n', Tone.now())
}

export type Playback = { stop: () => void; durationMs: number }

/** Schedules the melody on the audio clock and mirrors it with UI callbacks. */
export function playSequence(
  notes: NoteEvent[],
  opts: { voice?: Voice; onNote?: (index: number) => void; onEnd?: () => void; delayMs?: number } = {},
): Playback {
  if (!rig) rig = build()
  if (Tone.getContext().state !== 'running') void Tone.start()
  const voice = rig.voices[opts.voice ?? 'main']
  const delay = (opts.delayMs ?? 60) / 1000
  const start = Tone.now() + delay
  const timers: number[] = []
  notes.forEach((n, i) => {
    voice.triggerAttackRelease(NOTES[n.code].name, '8n', start + n.t / 1000)
    timers.push(window.setTimeout(() => opts.onNote?.(i), delay * 1000 + n.t))
  })
  const durationMs = (notes.at(-1)?.t ?? 0) + 600
  timers.push(window.setTimeout(() => opts.onEnd?.(), delay * 1000 + durationMs))
  return {
    durationMs,
    stop: () => {
      timers.forEach(clearTimeout)
      voice.releaseAll()
    },
  }
}
