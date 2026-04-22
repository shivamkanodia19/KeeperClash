import type { CameraRecommendation } from './geometryTypes'
import type { PlayAnimationPhase } from '../playAnimation/types'

export function deriveCameraRecommendation(opts: {
  phase: PlayAnimationPhase
  lineOfScrimmageX: number
  ball: { x: number; y: number }
  /** 0–1 play progress while live. */
  playProgress01: number
}): CameraRecommendation {
  const los = opts.lineOfScrimmageX
  if (opts.phase === 'preSnap') {
    return {
      viewportCenterX: los + 7,
      viewportCenterY: 0,
      zoom: 1.12,
      visibleXMin: Math.max(1, los - 14),
      visibleXMax: Math.min(99, los + 22),
      visibleYMin: -28,
      visibleYMax: 28,
      focusMode: 'los_wide',
    }
  }
  const pull = opts.playProgress01 * 6
  return {
    viewportCenterX: opts.ball.x + pull * 0.12,
    viewportCenterY: opts.ball.y * 0.42,
    zoom: 1.28,
    visibleXMin: Math.max(1, opts.ball.x - 16),
    visibleXMax: Math.min(99, opts.ball.x + 24),
    visibleYMin: -22,
    visibleYMax: 22,
    focusMode: 'ball_follow',
  }
}
