import type { CameraRecommendation } from './geometryTypes'
import type { PlayAnimationPhase } from '../playAnimation/types'

export function deriveCameraRecommendation(opts: {
  phase: PlayAnimationPhase
  lineOfScrimmageX: number
  ball: { x: number; y: number }
  /** 0-1 play progress while live. */
  playProgress01: number
}): CameraRecommendation {
  void opts.lineOfScrimmageX
  void opts.ball

  if (opts.phase === 'preSnap') {
    return {
      viewportCenterX: 50,
      viewportCenterY: 0,
      zoom: 0.72,
      visibleXMin: 0,
      visibleXMax: 100,
      visibleYMin: -32,
      visibleYMax: 32,
      focusMode: 'full_field',
    }
  }

  return {
    viewportCenterX: 50,
    viewportCenterY: 0,
    zoom: 0.76,
    visibleXMin: 0,
    visibleXMax: 100,
    visibleYMin: -32,
    visibleYMax: 32,
    focusMode: opts.playProgress01 < 0.5 ? 'full_field' : 'full_field_live',
  }
}
