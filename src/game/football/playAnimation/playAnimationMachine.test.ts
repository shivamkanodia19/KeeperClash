import { describe, expect, it } from 'vitest'
import { createTestScrimmageState } from '../footballState'
import {
  advancePlaySimulationFrame,
  advanceResult,
  animationSeed,
  createPlayAnimationCore,
  moveBallCarrier,
  setPlayerMoveVector,
  snap,
  switchActivePlayer,
  toPlayAnimationSnapshot,
} from './playAnimationMachine'

describe('playAnimationMachine', () => {
  it('animationSeed is deterministic', () => {
    const e = createTestScrimmageState()
    expect(animationSeed(e, 'inside_zone', 'cover_2_zone')).toBe(
      animationSeed(e, 'inside_zone', 'cover_2_zone'),
    )
    expect(animationSeed(e, 'inside_zone', 'cover_2_zone')).not.toBe(
      animationSeed(e, 'outside_zone', 'cover_2_zone'),
    )
  })

  it('snap then move steps resolve to tackleOrScore then advanceResult updates phase', () => {
    const engine = createTestScrimmageState()
    let core = createPlayAnimationCore(engine)
    const s0 = snap(core, engine, 'inside_zone', 'cover_2_zone')
    expect(s0).not.toBeNull()
    core = s0!.core
    expect(core.phase).toBe('snap')
    expect(core.pendingNext).not.toBeNull()
    expect(core.committedOffensePlayId).toBe('inside_zone')

    let steps = 0
    while (core.phase !== 'tackleOrScore' && steps < 200) {
      const n = moveBallCarrier(core)
      expect(n).not.toBeNull()
      core = n!
      steps++
    }
    expect(core.phase).toBe('tackleOrScore')

    const applied = core.pendingNext!
    const after = advanceResult(core, applied)
    expect(after?.phase).toBe('result')

    const cleared = advanceResult(after!, applied)
    expect(cleared?.phase).toBe('preSnap')
  })

  it('run play active player starts on carrier and move vector changes path', () => {
    const engine = createTestScrimmageState()
    let core = createPlayAnimationCore(engine)
    const s0 = snap(core, engine, 'inside_zone', 'cover_2_zone')
    expect(s0).not.toBeNull()
    core = s0!.core
    expect(core.activePlayerId).toBe(core.ball.carrierId)

    const startY = core.world?.ball.y ?? core.ball.y
    core = setPlayerMoveVector(core, 0, 1)
    const moved = advancePlaySimulationFrame(core, 260)
    expect(moved).not.toBeNull()
    expect(moved!.activePlayerId).toBe(moved!.ball.carrierId)
    expect(moved!.ball.y).toBeGreaterThan(startY)
  })

  it('pass play switchPlayer changes throw target while QB keeps control until catch transfer', () => {
    const engine = createTestScrimmageState()
    let core = createPlayAnimationCore(engine)
    const s0 = snap(core, engine, 'quick_slants', 'cover_2_zone')
    expect(s0).not.toBeNull()
    core = s0!.core
    const qbId = core.ball.carrierId
    expect(qbId).not.toBeNull()
    const originalTarget = core.ball.throwTargetId
    const switched = switchActivePlayer(core)
    expect(switched).not.toBeNull()
    expect(switched!.activePlayerId).toBe(qbId)
    expect(switched!.ball.throwTargetId).not.toBe(originalTarget)
    expect(switched!.ball.throwTargetId).toBe(switched!.world?.primaryTargetId)

    core = switched!
    let steps = 0
    while (
      steps < 240 &&
      core.phase !== 'tackleOrScore' &&
      (core.ball.carrierId === qbId || core.ball.carrierId === null)
    ) {
      const next = advancePlaySimulationFrame(core, 80)
      expect(next).not.toBeNull()
      core = next!
      steps++
    }

    expect(core.ball.carrierId).not.toBe(qbId)
    expect(core.ball.carrierId).not.toBeNull()
    expect(core.activePlayerId).toBe(core.ball.carrierId)
  })

  it('defensive control can select and steer a defender', () => {
    const engine = {
      ...createTestScrimmageState(),
      possession: 'away' as const,
      userControlledTeam: 'home' as const,
    }
    let core = createPlayAnimationCore(engine)
    const s0 = snap(core, engine, 'inside_zone', 'cover_2_zone')
    expect(s0).not.toBeNull()
    core = switchActivePlayer(s0!.core, 'home_cb1', 'defense')!

    const view = toPlayAnimationSnapshot(
      core,
      engine,
      'home',
      'inside_zone',
      'cover_2_zone',
    )
    expect(view.controlMode).toBe('defense')
    expect(view.defensiveControlEnabled).toBe(true)
    expect(view.selectedDefenderId).toBe('home_cb1')

    const startY = core.players.find((p) => p.id === 'home_cb1')!.y
    core = setPlayerMoveVector(core, 0, 1)
    const moved = advancePlaySimulationFrame(core, 500)
    expect(moved).not.toBeNull()
    expect(moved!.activePlayerId).toBe('home_cb1')
    expect(moved!.players.find((p) => p.id === 'home_cb1')!.y).toBeGreaterThan(startY)
  })
})
