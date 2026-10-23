import type { Node, Relationship } from '@neo4j-nvl/base'
import { InteractiveNvlWrapper } from '@neo4j-nvl/react'
import { useMemo } from 'react'
import { useI18n } from '../lib/i18n'
import { NOTES } from '../lib/notes'
import type { Performance } from '../lib/types'

/** The actual graph model, rendered with Neo4j Visualization Library. */
export function GraphView({ people, score, maxEvents = 14 }: { people: { p: Performance; color: string }[]; score?: number; maxEvents?: number }) {
  const { name, noteShort } = useI18n()
  const { nodes, rels } = useMemo(() => {
    const nodes: Node[] = []
    const rels: Relationship[] = []
    for (const { p, color } of people) {
      nodes.push({ id: p.id, caption: name(p), color, size: 46, captionSize: 3 })
      p.notes.slice(0, maxEvents).forEach((n, i) => {
        const id = `${p.id}-${i}`
        nodes.push({ id, caption: noteShort(n.code), color: NOTES[n.code].color, size: 22 })
        const from = i === 0 ? p.id : `${p.id}-${i - 1}`
        rels.push({ id: `${id}-r`, from, to: id, caption: i === 0 ? 'FIRST_EVENT' : 'NEXT_EVENT', color: 'rgba(255,255,255,.35)', width: 1.5 })
      })
    }
    if (people.length === 2 && score != null) {
      rels.push({ id: 'sim', from: people[0].p.id, to: people[1].p.id, caption: `SIMILAR_TO ${score.toFixed(2)}`, color: '#FFD23F', width: 4 })
    }
    return { nodes, rels }
  }, [people, score, maxEvents, name, noteShort])

  return (
    <div className="h-full w-full">
      <InteractiveNvlWrapper
        nodes={nodes}
        rels={rels}
        nvlOptions={{ initialZoom: 0.9, renderer: 'canvas', disableTelemetry: true, layout: 'forceDirected', relationshipThreshold: 0.4 }}
        mouseEventCallbacks={{ onZoomAndPan: true, onPan: true, onDrag: true }}
        onInitializationError={(e) => console.error('NVL', e)}
      />
    </div>
  )
}
