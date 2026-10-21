import { lazy, Suspense, useEffect, useState } from 'react'
import { Participant } from './pages/Participant'

const Stage = lazy(() => import('./pages/stage/Stage').then((m) => ({ default: m.Stage })))

const route = () => (window.location.hash.replace(/^#\/?/, '') || '').split('?')[0]

export default function App() {
  const [path, setPath] = useState(route())
  useEffect(() => {
    const onHash = () => setPath(route())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  if (path === 'palco') {
    return (
      <Suspense fallback={<div className="h-dvh bg-ink" />}>
        <Stage />
      </Suspense>
    )
  }
  return <Participant />
}
