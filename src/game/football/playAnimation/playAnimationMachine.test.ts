import { describe, expect, it } from 'vitest'
import { createTestScrimmageState } from '../footballState'
import {
  advancePlaySimulationFrame,
  advanceResult,
  animationSeed,
  createPlayAnimationCore,
  deriveLivePlayResolution,
  dive,
  moveBallCarrier,
  juke,
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

  it('live frame loop advances under normal 60fps frame deltas', () => {
    const engine = createTestScrimmageState()
    let core = createPlayAnimationCore(engine)
    const s0 = snap(core, engine, 'inside_zone', 'cover_2_zone')
    expect(s0).not.toBeNull()
    core = setPlayerMoveVector(s0!.core, 0, 1)
    const startY = core.world?.ball.y ?? core.ball.y

    for (let i = 0; i < 12; i++) {
      const next = advancePlaySimulationFrame(core, 16)
      expect(next).not.toBeNull()
      core = next!
    }

    expect(core.ball.y).toBeGreaterThan(startY)
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

  it('screen pass exposes the RB as the live pass target', () => {
    const engine = createTestScrimmageState()
    let core = createPlayAnimationCore(engine)
    const s0 = snap(core, engine, 'screen_pass', 'cover_3_sky')
    expect(s0).not.toBeNull()
    core = s0!.core

    expect(core.ball.throwTargetId).toBe('home_rb')

    const view = toPlayAnimationSnapshot(
      core,
      engine,
      'home',
      'screen_pass',
      'cover_3_sky',
    )
    expect(view.controllablePlayerIds).toContain('home_rb')

    const targeted = switchActivePlayer(core, 'home_rb', 'offense')
    expect(targeted).not.toBeNull()
    expect(targeted!.ball.throwTargetId).toBe('home_rb')
  })

  it('throwTo target keeps QB control while aiming at the selected receiver', () => {
    const engine = createTestScrimmageState()
    let core = createPlayAnimationCore(engine)
    const s0 = snap(core, engine, 'quick_slants', 'cover_2_zone')
    expect(s0).not.toBeNull()
    core = s0!.core
    const qbId = core.ball.carrierId
    const view = toPlayAnimationSnapshot(
      core,
      engine,
      'home',
      'quick_slants',
      'cover_2_zone',
    )
    const targetId = view.controllablePlayerIds.find(
      (id) => id !== qbId && id !== core.ball.throwTargetId,
    )
    const target = core.players.find((p) => p.id === targetId)
    expect(target).toBeDefined()

    core = switchActivePlayer(core, target!.id, 'offense')!
    expect(core.ball.throwTargetId).toBe(target!.id)
    expect(core.activePlayerId).toBe(core.ball.carrierId)
    for (let i = 0; i < 60 && core.ball.mode !== 'thrown' && core.phase !== 'tackleOrScore'; i++) {
      core = advancePlaySimulationFrame(core, 33)!
    }

    expect(core.ball.throwTargetId).toBe(target!.id)
    expect(core.activePlayerId === qbId || core.activePlayerId === target!.id).toBe(true)
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

  it('primary action performs a defensive tackle intent when controlling defense', () => {
    const engine = {
      ...createTestScrimmageState(),
      possession: 'away' as const,
      userControlledTeam: 'home' as const,
    }
    let core = createPlayAnimationCore(engine)
    const s0 = snap(core, engine, 'inside_zone', 'cover_2_zone')
    expect(s0).not.toBeNull()
    core = switchActivePlayer(s0!.core, 'home_mike', 'defense')!
    const acted = dive(core)
    expect(acted).not.toBeNull()
    expect(acted!.world?.players.find((p) => p.id === 'home_mike')?.tackleIntentTimer).toBeGreaterThan(0)
  })

  it('secondary action performs a defender shed intent when controlling defense', () => {
    const engine = {
      ...createTestScrimmageState(),
      possession: 'away' as const,
      userControlledTeam: 'home' as const,
    }
    let core = createPlayAnimationCore(engine)
    const s0 = snap(core, engine, 'inside_zone', 'cover_2_zone')
    expect(s0).not.toBeNull()
    core = switchActivePlayer(s0!.core, 'home_mike', 'defense')!
    const acted = juke(core)
    expect(acted).not.toBeNull()
    expect(acted!.world?.players.find((p) => p.id === 'home_mike')?.shedBoostTimer).toBeGreaterThan(0)
  })

  it('live play resolution uses the controlled field result instead of the snap script', () => {
    const engine = createTestScrimmageState()
    let core = createPlayAnimationCore(engine)
    const s0 = snap(core, engine, 'inside_zone', 'cover_2_zone')
    expect(s0).not.toBeNull()
    core = {
      ...s0!.core,
      phase: 'tackleOrScore',
      pendingResolution: {
        ...s0!.core.pendingResolution!,
        yardsGained: 12,
        commentary: 'Scripted gain.',
      },
      ball: {
        ...s0!.core.ball,
        x: s0!.core.yardLineAtSnap + 2,
        y: s0!.core.ball.y,
      },
    }

    const dynamic = deriveLivePlayResolution(core)
    expect(dynamic).not.toBeNull()
    expect(dynamic!.outcome).toBe('normal')
    expect(dynamic!.yardsGained).toBe(2)
    expect(dynamic!.yardsGained).not.toBe(core.pendingResolution!.yardsGained)
  })

  it('live play resolution preserves sacks when the ball is dead without a carrier', () => {
    const engine = createTestScrimmageState()
    let core = createPlayAnimationCore(engine)
    const s0 = snap(core, engine, 'quick_slants', 'cover_0_blitz')
    expect(s0).not.toBeNull()
    core = {
      ...s0!.core,
      phase: 'tackleOrScore',
      pendingResolution: {
        ...s0!.core.pendingResolution!,
        outcome: 'sack',
        yardsGained: -6,
        commentary: 'Scripted sack.',
      },
      ball: {
        ...s0!.core.ball,
        mode: 'dead',
        carrierId: null,
        x: s0!.core.yardLineAtSnap - 6,
      },
    }

    const dynamic = deriveLivePlayResolution(core)
    expect(dynamic).not.toBeNull()
    expect(dynamic!.outcome).toBe('sack')
    expect(dynamic!.yardsGained).toBe(-6)
  })
})
