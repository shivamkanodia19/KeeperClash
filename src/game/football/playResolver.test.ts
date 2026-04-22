import { describe, expect, it } from 'vitest'
import { getDefensiveCall } from './defensiveCalls'
import { getOffensivePlay } from './playDefinitions'
import { resolvePlay } from './playResolver'
import { DEFAULT_AWAY_RATINGS, DEFAULT_HOME_RATINGS } from './footballTypes'
import { createSeededRng } from './footballState'

describe('resolvePlay', () => {
  it('defensive calls affect yards for same RNG stream (inside zone)', () => {
    const seed = 42
    const play = getOffensivePlay('inside_zone')!
    const cover2 = getDefensiveCall('cover_2_zone')!
    const runBlitz = getDefensiveCall('run_blitz')!
    const st = { yardLine: 40, down: 1 as const, yardsToGo: 10 }
    const a = resolvePlay(
      DEFAULT_HOME_RATINGS,
      DEFAULT_AWAY_RATINGS,
      play,
      cover2,
      st,
      createSeededRng(seed),
    )
    const b = resolvePlay(
      DEFAULT_HOME_RATINGS,
      DEFAULT_AWAY_RATINGS,
      play,
      runBlitz,
      st,
      createSeededRng(seed),
    )
    expect(a.outcome).toBe('normal')
    expect(b.outcome).toBe('normal')
    expect(b.yardsGained).toBeLessThanOrEqual(a.yardsGained)
  })

  it('field goal from close range can succeed with favorable rng', () => {
    const play = getOffensivePlay('field_goal')!
    const d = getDefensiveCall('cover_2_zone')!
    const st = { yardLine: 85, down: 4 as const, yardsToGo: 1 }
    const res = resolvePlay(
      DEFAULT_HOME_RATINGS,
      DEFAULT_AWAY_RATINGS,
      play,
      d,
      st,
      () => 0,
    )
    expect(res.outcome).toBe('field_goal_made')
  })
})
