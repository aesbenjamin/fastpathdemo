import { useCallback, useEffect, useRef, useState } from 'react'
import { playSequence, type Playback, type Voice } from './audio'
import type { NoteEvent } from './notes'

/** Plays a melody and exposes a smooth playhead (ms) plus the index of the current note. */
export function usePlayback(voice: Voice = 'main') {
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const pb = useRef<Playback | null>(null)
  const raf = useRef(0)

  const stop = useCallback(() => {
    pb.current?.stop()
    pb.current = null
    cancelAnimationFrame(raf.current)
    setPlaying(false)
    setPlayhead(null)
    setActiveIndex(null)
  }, [])

  const play = useCallback(
    (notes: NoteEvent[], onEnd?: () => void) => {
      stop()
      if (!notes.length) return
      const start = performance.now() + 60
      setPlaying(true)
      pb.current = playSequence(notes, {
        voice,
        onNote: setActiveIndex,
        onEnd: () => {
          stop()
          onEnd?.()
        },
      })
      const tick = () => {
        setPlayhead(Math.max(0, performance.now() - start))
        raf.current = requestAnimationFrame(tick)
      }
      tick()
    },
    [stop, voice],
  )

  useEffect(() => stop, [stop])
  return { play, stop, playing, playhead, activeIndex }
}
