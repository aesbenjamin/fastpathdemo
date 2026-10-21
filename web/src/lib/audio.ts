import * as Tone from 'tone'
import { IS_LIGHT } from './device'
import { NOTES, type NoteEvent } from './notes'

export type Voice = 'main' | 'duet' | 'ai'

type Rig = {
  voices: Partial<Record<Voice, Tone.PolySynth>>
  bus: Tone.ToneAudioNode
  analyser: Tone.Analyser
}

let rig: Rig | null = null

// A larger audio buffer on phones trades ~30 ms of latency for far fewer crackles when the CPU is busy.
if (IS_LIGHT) Tone.setContext(new Tone.Context({ latencyHint: 'balanced' }))

function build(): Rig {
  const analyser = new Tone.Analyser('waveform', IS_LIGHT ? 256 : 512)
  const limiter = new Tone.Limiter(-2).toDestination()
  // Freeverb is algorithmic (constant cost); the convolution Reverb was the single heaviest node on phones.
  const reverb = IS_LIGHT
    ? new Tone.Freeverb({ roomSize: 0.78, dampening: 2600, wet: 0.26 }).connect(limiter)
    : new Tone.Reverb({ decay: 3.2, wet: 0.32 }).connect(limiter)
  reverb.connect(analyser)
  const bus: Tone.ToneAudioNode = IS_LIGHT
    ? reverb
    : new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.22, wet: 0.14 }).connect(reverb)
  return { voices: {}, bus, analyser }
}

function voice(name: Voice): Tone.PolySynth {
  if (!rig) rig = build()
  const existing = rig.voices[name]
  if (existing) return existing
  let synth: Tone.PolySynth
  if (name === 'main') {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: IS_LIGHT ? { type: 'triangle' } : { type: 'fattriangle', count: 3, spread: 18 },
      envelope: { attack: 0.004, decay: 0.35, sustain: 0.18, release: IS_LIGHT ? 0.8 : 1.4 },
      volume: IS_LIGHT ? -6 : -9,
    })
    synth.maxPolyphony = IS_LIGHT ? 12 : 32
    synth.connect(IS_LIGHT ? rig.bus : new Tone.Panner(-0.25).connect(rig.bus))
  } else if (name === 'duet') {
    synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 9,
      envelope: { attack: 0.002, decay: 0.6, sustain: 0.05, release: 1.6 },
      modulationEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.4 },
      volume: -12,
    })
    synth.connect(new Tone.Panner(0.35).connect(rig.bus))
  } else {
    synth = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 1.5,
      envelope: { attack: 0.02, decay: 0.4, sustain: 0.3, release: 2.2 },
      volume: -10,
    })
    synth.connect(IS_LIGHT ? rig.bus : new Tone.Chorus(3, 2.5, 0.5).start().connect(rig.bus))
  }
  rig.voices[name] = synth
  return synth
}

export async function unlockAudio() {
  await Tone.start()
  voice('main')
}

export function analyser(): Tone.Analyser | null {
  return rig?.analyser ?? null
}

export function playNote(code: number, name: Voice = 'main') {
  if (Tone.getContext().state !== 'running') void Tone.start()
  voice(name).triggerAttackRelease(NOTES[code].name, '8n', Tone.now())
}

export type Playback = { stop: () => void; durationMs: number }

/** Schedules the melody on the audio clock and mirrors it with UI callbacks. */
export function playSequence(
  notes: NoteEvent[],
  opts: { voice?: Voice; onNote?: (index: number) => void; onEnd?: () => void; delayMs?: number } = {},
): Playback {
  if (Tone.getContext().state !== 'running') void Tone.start()
  const synth = voice(opts.voice ?? 'main')
  const delay = (opts.delayMs ?? 60) / 1000
  const start = Tone.now() + delay
  const timers: number[] = []
  notes.forEach((n, i) => {
    synth.triggerAttackRelease(NOTES[n.code].name, '8n', start + n.t / 1000)
    timers.push(window.setTimeout(() => opts.onNote?.(i), delay * 1000 + n.t))
  })
  const durationMs = (notes.at(-1)?.t ?? 0) + 600
  timers.push(window.setTimeout(() => opts.onEnd?.(), delay * 1000 + durationMs))
  return {
    durationMs,
    stop: () => {
      timers.forEach(clearTimeout)
      synth.releaseAll()
    },
  }
}
