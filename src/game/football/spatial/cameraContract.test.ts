import { describe, expect, it } from 'vitest'
import { deriveCameraRecommendation } from './cameraContract'

describe('deriveCameraRecommendation', () => {
  it('shows the full tactical field pre-snap', () => {
    const cam = deriveCameraRecommendation({
      phase: 'preSnap',
      lineOfScrimmageX: 25,
      ball: { x: 25, y: 0 },
      playProgress01: 0,
    })

    expect(cam.focusMode).toBe('full_field')
    expect(cam.visibleXMin).toBe(0)
    expect(cam.visibleXMax).toBe(100)
    expect(cam.visibleYMin).toBeLessThanOrEqual(-26)
    expect(cam.visibleYMax).toBeGreaterThanOrEqual(26)
  })

  it('zooms around the ball during live play while preserving nearby action', () => {
    const cam = deriveCameraRecommendation({
      phase: 'playInProgress',
      lineOfScrimmageX: 37,
      ball: { x: 42, y: 8 },
      playProgress01: 0.4,
    })

    expect(cam.focusMode).toBe('ball_follow')
    expect(cam.visibleXMin).toBeLessThanOrEqual(30)
    expect(cam.visibleXMax).toBeGreaterThanOrEqual(54)
    expect(cam.visibleXMax - cam.visibleXMin).toBeLessThan(60)
    expect(cam.visibleYMin).toBeLessThanOrEqual(-18)
    expect(cam.visibleYMax).toBeGreaterThanOrEqual(26)
  })
})
