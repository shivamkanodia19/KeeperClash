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
      zoom: 1.2,
      visibleXMin: Math.max(1, los - 12),
      visibleXMax: Math.min(99, los + 20),
      visibleYMin: -26,
      visibleYMax: 26,
      focusMode: 'los_wide',
    }
  }
  const pull = opts.playProgress01 * 5
  return {
    viewportCenterX: opts.ball.x + pull * 0.12,
    viewportCenterY: opts.ball.y * 0.42,
    zoom: 1.38,
    visibleXMin: Math.max(1, opts.ball.x - 13),
    visibleXMax: Math.min(99, opts.ball.x + 19),
    visibleYMin: -20,
    visibleYMax: 20,
    focusMode: 'ball_follow',
  }
}
