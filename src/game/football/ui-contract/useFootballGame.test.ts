import { describe, expect, it } from 'vitest'
import { createTestScrimmageState } from '../footballState'
import { advanceResult, createPlayAnimationCore, snap } from '../playAnimation'
import { commitLivePlayResult } from './useFootballGame'

describe('useFootballGame live result commit', () => {
  it('commits a live sack as a sack, not an incomplete pass', () => {
    const engine = createTestScrimmageState()
    const core0 = createPlayAnimationCore(engine)
    const s0 = snap(core0, engine, 'quick_slants', 'cover_0_blitz')
    expect(s0).not.toBeNull()

    const core = {
      ...s0!.core,
      phase: 'tackleOrScore' as const,
      pendingResolution: {
        ...s0!.core.pendingResolution!,
        outcome: 'sack' as const,
        yardsGained: -6,
        commentary: 'Scripted sack.',
      },
      ball: {
        ...s0!.core.ball,
        mode: 'dead' as const,
        carrierId: null,
        x: s0!.core.yardLineAtSnap - 6,
      },
    }

    const committed = commitLivePlayResult(engine, core)
    expect(committed).not.toBeNull()
    expect(committed!.resultCore.pendingResolution?.outcome).toBe('sack')
    expect(committed!.applied.yardLine).toBe(engine.yardLine - 6)
    expect(committed!.applied.down).toBe(2)
    expect(committed!.applied.yardsToGo).toBe(16)

    const resultCore = advanceResult(committed!.resultCore, committed!.applied)
    expect(resultCore?.phase).toBe('result')
  })

  it('commitLivePlayResult uses the live controlled tackle spot', () => {
    const engine = {
      ...createTestScrimmageState(),
      possession: 'away' as const,
      userControlledTeam: 'home' as const,
    }
    const core0 = createPlayAnimationCore(engine)
    const s0 = snap(core0, engine, 'inside_zone', 'cover_2_zone')
    expect(s0).not.toBeNull()
    const tackledAt = s0!.core.yardLineAtSnap + 1
    const core = {
      ...s0!.core,
      phase: 'tackleOrScore' as const,
      ball: {
        ...s0!.core.ball,
        mode: 'dead' as const,
        x: tackledAt,
      },
    }

    const committed = commitLivePlayResult(engine, core)
    expect(committed).not.toBeNull()
    expect(committed!.resultCore.pendingResolution?.yardsGained).toBe(1)
  })

  it('commitLivePlayResult preserves the visible interception spot', () => {
    const engine = createTestScrimmageState()
    const core0 = createPlayAnimationCore(engine)
    const s0 = snap(core0, engine, 'quick_slants', 'cover_2_zone')
    expect(s0).not.toBeNull()
    const defender = s0!.core.players.find((p) => p.unit === 'defense')
    expect(defender).toBeDefined()
    const turnoverX = 42
    const core = {
      ...s0!.core,
      phase: 'tackleOrScore' as const,
      ball: {
        ...s0!.core.ball,
        mode: 'carried' as const,
        carrierId: defender!.id,
        x: turnoverX,
      },
      players: s0!.core.players.map((p) =>
        p.id === defender!.id ? { ...p, x: turnoverX, unit: 'defense' as const } : p,
      ),
    }

    const committed = commitLivePlayResult(engine, core)
    expect(committed).not.toBeNull()
    expect(committed!.resultCore.pendingResolution?.outcome).toBe('interception')
    expect(committed!.resultCore.pendingResolution?.turnoverYardLine).toBe(turnoverX)
    expect(committed!.applied.possession).toBe('away')
    expect(committed!.applied.yardLine).toBe(100 - turnoverX)
  })
})
