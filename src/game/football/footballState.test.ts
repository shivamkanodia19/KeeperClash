import { describe, expect, it } from 'vitest'
import type { Down, FootballGameState, Quarter, TeamId } from './footballTypes'
import {
  applyClock,
  applyRealtimeClock,
  applyResolvedPlay,
  advanceDrive,
  createTestScrimmageState,
} from './footballState'

describe('applyResolvedPlay scrimmage', () => {
  const base = createTestScrimmageState()

  it('1st and 10, gain 4 -> 2nd and 6', () => {
    const next = applyResolvedPlay(
      base,
      { outcome: 'normal', yardsGained: 4, clockUsed: 10, commentary: 'Gain 4' },
      () => 0.5,
    )
    expect(next.possession).toBe('home')
    expect(next.yardLine).toBe(29)
    expect(next.down).toBe(2)
    expect(next.yardsToGo).toBe(6)
    expect(next.clockSeconds).toBe(base.clockSeconds)
    expect(next.clockMode).toBe('pre_snap_running')
  })

  it('2nd and 6 at 29, gain 7 -> 1st and 10', () => {
    const s: FootballGameState = { ...base, yardLine: 29, down: 2 as Down, yardsToGo: 6 }
    const next = applyResolvedPlay(
      s,
      { outcome: 'normal', yardsGained: 7, clockUsed: 10, commentary: 'Gain 7' },
      () => 0.5,
    )
    expect(next.down).toBe(1)
    expect(next.yardLine).toBe(36)
    expect(next.yardsToGo).toBe(10)
  })

  it('4th down incomplete -> turnover on downs, possession flips', () => {
    const s: FootballGameState = { ...base, down: 4 as Down, yardsToGo: 8, yardLine: 40 }
    const next = applyResolvedPlay(
      s,
      { outcome: 'incomplete', yardsGained: 0, clockUsed: 5, commentary: 'Incomplete' },
      () => 0.5,
    )
    expect(next.possession).toBe('away')
    expect(next.down).toBe(1)
    expect(next.yardLine).toBe(60)
  })
})

describe('applyResolvedPlay scoring & special teams', () => {
  const base = createTestScrimmageState()

  it('yard line crossing 100 as touchdown: +7 and kickoff to defense', () => {
    const s: FootballGameState = { ...base, yardLine: 95, down: 1, yardsToGo: 10 }
    const next = applyResolvedPlay(
      s,
      { outcome: 'touchdown', yardsGained: 5, clockUsed: 12, commentary: 'TD' },
      () => 0.5,
    )
    expect(next.homeScore).toBe(7)
    expect(next.possession).toBe('away')
    expect(next.yardLine).toBe(25)
    expect(next.down).toBe(1)
    expect(next.yardsToGo).toBe(10)
  })

  it('touchdown credits away when they possess the ball', () => {
    const s: FootballGameState = {
      ...createTestScrimmageState(),
      possession: 'away' as TeamId,
      yardLine: 95,
      down: 1,
      yardsToGo: 5,
    }
    const next = applyResolvedPlay(
      s,
      { outcome: 'touchdown', yardsGained: 5, clockUsed: 12, commentary: 'TD' },
      () => 0.5,
    )
    expect(next.awayScore).toBe(7)
    expect(next.possession).toBe('home')
  })

  it('field goal made -> +3 and possession flips', () => {
    const next = applyResolvedPlay(
      base,
      { outcome: 'field_goal_made', yardsGained: 0, clockUsed: 8, commentary: 'FG good' },
      () => 0.5,
    )
    expect(next.homeScore).toBe(3)
    expect(next.possession).toBe('away')
    expect(next.yardLine).toBe(25)
  })

  it('punt changes field position and possession', () => {
    const s = { ...base, yardLine: 30 }
    const next = applyResolvedPlay(
      s,
      {
        outcome: 'punt',
        yardsGained: 0,
        clockUsed: 12,
        commentary: 'Punt',
        puntNetYards: 40,
      },
      () => 0.5,
    )
    expect(next.possession).toBe('away')
    expect(next.yardLine).toBe(30)
    expect(next.down).toBe(1)
  })

  it('interception changes possession', () => {
    const next = applyResolvedPlay(
      base,
      { outcome: 'interception', yardsGained: 0, clockUsed: 10, commentary: 'Pick' },
      () => 0.99,
    )
    expect(next.possession).toBe('away')
    expect(next.down).toBe(1)
  })
})

describe('applyClock', () => {
  it('uses configured quarter length when rolling quarters', () => {
    const s: FootballGameState = {
      ...createTestScrimmageState(),
      quarter: 1 as Quarter,
      clockSeconds: 15,
      quarterLengthSeconds: 120,
    }
    const tick = applyClock(s, 20)
    expect(tick.quarter).toBe(2)
    expect(tick.clockSeconds).toBe(115)
    expect(tick.gameOver).toBe(false)
  })

  it('Q4 clock exhausted marks game over', () => {
    const s: FootballGameState = {
      ...createTestScrimmageState(),
      quarter: 4 as Quarter,
      clockSeconds: 8,
    }
    const tick = applyClock(s, 30)
    expect(tick.gameOver).toBe(true)
    expect(tick.clockSeconds).toBe(0)
    expect(tick.quarter).toBe(4)
  })
})

describe('applyRealtimeClock', () => {
  it('ticks game clock from elapsed live dt', () => {
    const s = createTestScrimmageState()
    const tick = applyRealtimeClock(s, 5, 'live')
    expect(tick.clockSeconds).toBe(115)
    expect(tick.playClockSeconds).toBe(25)
    expect(tick.clockRunning).toBe(true)
  })

  it('pre-snap stopped drains play clock only', () => {
    const s = createTestScrimmageState()
    const tick = applyRealtimeClock(s, 4, 'pre_snap_stopped')
    expect(tick.clockSeconds).toBe(120)
    expect(tick.playClockSeconds).toBe(21)
    expect(tick.clockRunning).toBe(false)
  })

  it('pre-snap running drains game clock and play clock', () => {
    const s: FootballGameState = {
      ...createTestScrimmageState(),
      clockRunning: true,
      clockMode: 'pre_snap_running',
    }
    const tick = applyRealtimeClock(s, 6, 'pre_snap_running')
    expect(tick.clockSeconds).toBe(114)
    expect(tick.playClockSeconds).toBe(19)
    expect(tick.clockRunning).toBe(true)
  })

  it('play clock expiration clamps and records event', () => {
    const s: FootballGameState = {
      ...createTestScrimmageState(),
      playClockSeconds: 2,
    }
    const tick = applyRealtimeClock(s, 5, 'pre_snap_stopped')
    expect(tick.playClockSeconds).toBe(0)
    expect(tick.lastClockEvent).toMatch(/Play clock expired/)
  })

  it('Q4 real-time expiration ends the game', () => {
    const s: FootballGameState = {
      ...createTestScrimmageState(),
      quarter: 4 as Quarter,
      clockSeconds: 1,
    }
    const tick = applyRealtimeClock(s, 2, 'live')
    expect(tick.gameOver).toBe(true)
    expect(tick.sessionPhase).toBe('game_over')
    expect(tick.clockSeconds).toBe(0)
  })
})

describe('advanceDrive integration', () => {
  it('throws when advancing a finished game', () => {
    const s = { ...createTestScrimmageState(), gameOver: true }
    expect(() =>
      advanceDrive(s, { userOffensePlayId: 'inside_zone' }, Math.random),
    ).toThrow(/finished/)
  })

  it('can simulate many plays without crashing', () => {
    let s = createTestScrimmageState()
    const offenseIds = ['inside_zone', 'quick_slants', 'outside_zone', 'mesh'] as const
    const defenseIds = ['cover_2_zone', 'cover_3_sky', 'nickel', 'prevent'] as const
    for (let i = 0; i < 500; i++) {
      if (s.gameOver) break
      const rng = Math.random
      if (s.possession === 'home') {
        s = advanceDrive(s, { userOffensePlayId: offenseIds[i % offenseIds.length]! }, rng).next
      } else {
        s = advanceDrive(s, { userDefenseCallId: defenseIds[i % defenseIds.length]! }, rng).next
      }
    }
    expect(s).toBeDefined()
  })
})
