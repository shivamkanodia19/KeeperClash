/**
 * Field geometry in offense-oriented coordinates:
 * - x: yards toward opponent goal from offense's own goal line (same as engine yardLine space at LOS).
 * - y: lateral offset (yards), positive = offense right.
 */

export type Vec2 = { x: number; y: number }

/** Polyline in field space (absolute yards). */
export type FieldPolyline = {
  id: string
  /** Vertices in order; UI draws line strips. */
  points: Vec2[]
  /** 'route' | 'runPath' | 'blocking' | 'zoneEdge' | 'man' | 'blitz' | 'los' | 'fd' */
  kind: string
  label?: string
}

export type ZoneHull = {
  id: string
  /** Vertices of a shallow polygon (flat zone). */
  corners: Vec2[]
  label: string
  depth: 'deep' | 'underneath'
}

export type ManCoverageEdge = {
  defenderSlot: string
  /** LOS anchor for defender. */
  from: Vec2
  /** Initial receiver alignment hint. */
  to: Vec2
}

export type BlitzArrow = {
  from: Vec2
  to: Vec2
  rusherSlot: string
}

export type RunFitIndicator = {
  position: Vec2
  gap: string
  responsibility: string
}

export type PlayResultMarker = {
  /** Normalized time 0–1 on play timeline. */
  t: number
  kind: 'tackle' | 'contact' | 'score' | 'turnover' | 'incomplete'
  position: Vec2
  label?: string
}

/** One segment of deterministic play animation (normalized time 0–1). */
export type PlayTimelineSegment = {
  t0: number
  t1: number
  /** What moves: player id or 'ball' */
  subjectId: string
  from: Vec2
  to: Vec2
  /** Interpolation: linear | easeOut for ball carrier burst */
  easing: 'linear' | 'easeOut'
}

export type CameraRecommendation = {
  /** Field x (yards) to center in view. */
  viewportCenterX: number
  viewportCenterY: number
  /** 1 = default zoom; >1 zoom in. */
  zoom: number
  /** Min/max field x visible (offense perspective). */
  visibleXMin: number
  visibleXMax: number
  visibleYMin: number
  visibleYMax: number
  /** 'los_wide' | 'ball_follow' */
  focusMode: 'los_wide' | 'ball_follow'
}
