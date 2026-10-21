import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { Health, Job, Lobby, StageState } from '../../lib/types'

export function useStageData() {
  const [health, setHealth] = useState<Health | null>(null)
  const [online, setOnline] = useState(true)
  const [state, setState] = useState<StageState | null>(null)
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const lastStatus = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const s = await api.state()
      setState(s)
      setJob(s.job)
    } catch {
      setOnline(false)
    }
  }, [])

  useEffect(() => {
    const tick = () =>
      api
        .health()
        .then((h) => {
          setHealth(h)
          setOnline(true)
        })
        .catch(() => setOnline(false))
    tick()
    refresh()
    const id = window.setInterval(tick, 5000)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    const tick = () => api.lobby().then(setLobby).catch(() => undefined)
    tick()
    const id = window.setInterval(tick, 2000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (job?.status !== 'running') return
    const id = window.setInterval(async () => {
      const j = await api.job().catch(() => null)
      if (j) setJob({ ...j })
    }, 700)
    return () => window.clearInterval(id)
  }, [job?.status])

  useEffect(() => {
    if (lastStatus.current === 'running' && job?.status === 'done') refresh()
    lastStatus.current = job?.status ?? null
  }, [job?.status, refresh])

  const run = useCallback(async () => {
    const j = await api.run()
    setJob({ ...j })
  }, [])

  return { health, online, state, lobby, job, refresh, run }
}

export type StageData = ReturnType<typeof useStageData>
