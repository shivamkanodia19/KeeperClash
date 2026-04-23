import type { CameraRecommendation } from './geometryTypes'
import type { PlayAnimationPhase } from '../playAnimation/types'

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export function deriveCameraRecommendation(opts: {
  phase: PlayAnimationPhase
  lineOfScrimmageX: number
  ball: { x: number; y: number }
  /** 0-1 play progress while live. */
  playProgress01: number
}): CameraRecommendation {
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

  if (opts.phase === 'result' || opts.phase === 'tackleOrScore') {
    const cx = clamp(opts.ball.x, 20, 80)
    return {
      viewportCenterX: cx,
      viewportCenterY: clamp(opts.ball.y, -10, 10),
      zoom: 1.22,
      visibleXMin: clamp(cx - 25, 0, 52),
      visibleXMax: clamp(cx + 25, 48, 100),
      visibleYMin: -28,
      visibleYMax: 28,
      focusMode: 'ball_follow',
    }
  }

  const centerX = clamp(opts.ball.x + 8, 18, 82)
  const centerY = clamp(opts.ball.y, -12, 12)
  const halfWidth = 24
  return {
    viewportCenterX: centerX,
    viewportCenterY: centerY,
    zoom: 1.32,
    visibleXMin: clamp(centerX - halfWidth, 0, 100 - halfWidth * 2),
    visibleXMax: clamp(centerX + halfWidth, halfWidth * 2, 100),
    visibleYMin: clamp(centerY - 28, -32, 0),
    visibleYMax: clamp(centerY + 28, 0, 32),
    focusMode: 'ball_follow',
  }
}
