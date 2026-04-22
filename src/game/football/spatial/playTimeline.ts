import type { PlayTimelineSegment, Vec2 } from './geometryTypes'
import type { PlayerFieldPosition } from '../playAnimation/types'

function mid(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * Deterministic segments for film-style playback. Normalized play time 0–1.
 * Each subject has two linear segments (no discontinuities at segment joins).
 */
export function buildPlayTimelineSegments(
  startPlayers: readonly PlayerFieldPosition[],
  endPlayers: readonly PlayerFieldPosition[],
  ballStart: { x: number; y: number },
  ballEnd: { x: number; y: number },
): PlayTimelineSegment[] {
  const segs: PlayTimelineSegment[] = []
  const endById = new Map(endPlayers.map((p) => [p.id, p]))
  for (const s of startPlayers) {
    const e = endById.get(s.id)
    if (!e) continue
    const from = { x: s.x, y: s.y }
    const to = { x: e.x, y: e.y }
    const m = mid(from, to)
    segs.push({
      t0: 0,
      t1: 0.5,
      subjectId: s.id,
      from,
      to: m,
      easing: 'linear',
    })
    segs.push({
      t0: 0.5,
      t1: 1,
      subjectId: s.id,
      from: m,
      to,
      easing: 'linear',
    })
  }
  const bf = { x: ballStart.x, y: ballStart.y }
  const bt = { x: ballEnd.x, y: ballEnd.y }
  const bm = mid(bf, bt)
  segs.push({
    t0: 0,
    t1: 0.45,
    subjectId: 'ball',
    from: bf,
    to: bm,
    easing: 'linear',
  })
  segs.push({
    t0: 0.45,
    t1: 1,
    subjectId: 'ball',
    from: bm,
    to: bt,
    easing: 'easeOut',
  })
  return segs
}
