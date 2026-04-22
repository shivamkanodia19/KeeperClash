import { describe, expect, it } from 'vitest'
import { advanceDrive, createSeededRng, createTestScrimmageState } from '../footballState'
import { getDefensiveCall } from '../defensiveCalls'
import { getOffensivePlay } from '../playDefinitions'
import { layoutPlayersAtLos } from '../playAnimation/layout'
import {
  createPlayWorldFromSnap,
  setWorldPrimaryTarget,
  stepPlayWorld,
  syncWorldToField,
  SUBSTEP_DT,
} from './playWorldSimulation'

describe('playWorldSimulation', () => {
  it('players do not teleport per substep (bounded displacement)', () => {
    const engine = createTestScrimmageState()
    const rng = createSeededRng(42)
    const { next, resolution, committedPlayIds } = advanceDrive(
      engine,
      { userOffensePlayId: 'inside_zone' },
      rng,
    )
    void next
    const los = engine.yardLine
    const off = getOffensivePlay('inside_zone')!
    const def = getDefensiveCall(committedPlayIds.defenseCallId)
    const { players, ball } = layoutPlayersAtLos(
      engine.possession,
      los,
      off.formationId,
      def?.visualTemplateId ?? 'four_three_base',
    )
    const world = createPlayWorldFromSnap({
      offenseTeam: engine.possession,
      yardLineAtSnap: los,
      signedTargetYards: resolution.yardsGained,
      offensePlayId: 'inside_zone',
      defenseCallId: committedPlayIds.defenseCallId,
      layoutPlayers: players,
      ball,
      resolution,
    })
    const maxStep = 12 * SUBSTEP_DT
    let w = world
    for (let i = 0; i < 80; i++) {
      const prev = w.players.map((p) => ({ x: p.x, y: p.y }))
      w = stepPlayWorld(w, SUBSTEP_DT, { carrierSteer: 0 }, resolution)
      for (let j = 0; j < w.players.length; j++) {
        const d = Math.hypot(w.players[j]!.x - prev[j]!.x, w.players[j]!.y - prev[j]!.y)
        expect(d).toBeLessThanOrEqual(maxStep + 0.02)
      }
      if (w.finished) break
    }
  })

  it('syncWorldToField reports animated yards from ball vs LOS', () => {
    const engine = createTestScrimmageState()
    const rng = createSeededRng(7)
    const { resolution, committedPlayIds } = advanceDrive(
      engine,
      { userOffensePlayId: 'quick_slants' },
      rng,
    )
    const los = engine.yardLine
    const off = getOffensivePlay('quick_slants')!
    const def = getDefensiveCall(committedPlayIds.defenseCallId)
    const { players, ball } = layoutPlayersAtLos(
      engine.possession,
      los,
      off.formationId,
      def?.visualTemplateId ?? 'four_three_base',
    )
    const world = createPlayWorldFromSnap({
      offenseTeam: engine.possession,
      yardLineAtSnap: los,
      signedTargetYards: resolution.yardsGained,
      offensePlayId: 'quick_slants',
      defenseCallId: committedPlayIds.defenseCallId,
      layoutPlayers: players,
      ball,
      resolution,
    })
    const { animatedYards, ball: b } = syncWorldToField(world)
    expect(Math.abs(animatedYards - (b.x - los))).toBeLessThan(0.001)
  })

  it('live tuning keeps players readable over one second', () => {
    const engine = createTestScrimmageState()
    const rng = createSeededRng(15)
    const { resolution, committedPlayIds } = advanceDrive(
      engine,
      { userOffensePlayId: 'inside_zone' },
      rng,
    )
    const off = getOffensivePlay('inside_zone')!
    const def = getDefensiveCall(committedPlayIds.defenseCallId)
    const { players, ball } = layoutPlayersAtLos(
      engine.possession,
      engine.yardLine,
      off.formationId,
      def?.visualTemplateId ?? 'four_three_base',
    )
    let world = createPlayWorldFromSnap({
      offenseTeam: engine.possession,
      yardLineAtSnap: engine.yardLine,
      signedTargetYards: resolution.yardsGained,
      offensePlayId: 'inside_zone',
      defenseCallId: committedPlayIds.defenseCallId,
      layoutPlayers: players,
      ball,
      resolution,
    })
    const startX = world.ball.x
    const defenderId = world.players.find((p) => p.unit === 'defense')?.id ?? null
    expect(defenderId).not.toBeNull()
    const defenderStart = world.players.find((p) => p.id === defenderId)
    expect(defenderStart).toBeDefined()

    for (let i = 0; i < 60; i++) {
      world = stepPlayWorld(world, SUBSTEP_DT, { carrierSteer: 0 }, resolution)
    }

    expect(world.ball.x - startX).toBeGreaterThan(0.75)
    expect(world.ball.x - startX).toBeLessThan(7)
    expect(world.finished).toBe(true)
    expect(world.time).toBeGreaterThan(0.5)
    expect(world.time).toBeLessThan(1)
    const defenderEnd = world.players.find((p) => p.id === defenderId)
    expect(defenderEnd).toBeDefined()
    expect(
      Math.hypot(defenderEnd!.x - defenderStart!.x, defenderEnd!.y - defenderStart!.y),
    ).toBeGreaterThan(1)
  })

  it('active ball carrier input creates a different lateral lane', () => {
    const engine = createTestScrimmageState()
    const rng = createSeededRng(16)
    const { resolution, committedPlayIds } = advanceDrive(
      engine,
      { userOffensePlayId: 'inside_zone' },
      rng,
    )
    const off = getOffensivePlay('inside_zone')!
    const def = getDefensiveCall(committedPlayIds.defenseCallId)
    const setup = layoutPlayersAtLos(
      engine.possession,
      engine.yardLine,
      off.formationId,
      def?.visualTemplateId ?? 'four_three_base',
    )
    const baseParams = {
      offenseTeam: engine.possession,
      yardLineAtSnap: engine.yardLine,
      signedTargetYards: Math.max(5, resolution.yardsGained),
      offensePlayId: 'inside_zone',
      defenseCallId: committedPlayIds.defenseCallId,
      layoutPlayers: setup.players,
      ball: setup.ball,
      resolution,
    }
    let left = createPlayWorldFromSnap(baseParams)
    let right = createPlayWorldFromSnap(baseParams)
    const carrierId = left.ball.carrierId
    expect(carrierId).not.toBeNull()

    for (let i = 0; i < 45; i++) {
      left = stepPlayWorld(left, SUBSTEP_DT, {
        carrierSteer: 0,
        activePlayerId: carrierId,
        moveX: 0,
        moveY: -1,
      }, resolution)
      right = stepPlayWorld(right, SUBSTEP_DT, {
        carrierSteer: 0,
        activePlayerId: carrierId,
        moveX: 0,
        moveY: 1,
      }, resolution)
    }

    expect(right.ball.y - left.ball.y).toBeGreaterThan(3)
  })

  it('offensive linemen engage and slow defensive rushers', () => {
    const engine = createTestScrimmageState()
    const rng = createSeededRng(21)
    const { resolution, committedPlayIds } = advanceDrive(
      engine,
      { userOffensePlayId: 'inside_zone' },
      rng,
    )
    const off = getOffensivePlay('inside_zone')!
    const def = getDefensiveCall(committedPlayIds.defenseCallId)
    const { players, ball } = layoutPlayersAtLos(
      engine.possession,
      engine.yardLine,
      off.formationId,
      def?.visualTemplateId ?? 'four_three_base',
    )
    let world = createPlayWorldFromSnap({
      offenseTeam: engine.possession,
      yardLineAtSnap: engine.yardLine,
      signedTargetYards: Math.max(4, resolution.yardsGained),
      offensePlayId: 'inside_zone',
      defenseCallId: 'cover_2_zone',
      layoutPlayers: players,
      ball,
      resolution,
    })

    for (let i = 0; i < 120 && !world.players.some((p) => p.phase === 'blockEngaged'); i++) {
      world = stepPlayWorld(world, SUBSTEP_DT, { carrierSteer: 0 }, resolution)
    }

    const engaged = world.players.filter((p) => p.phase === 'blockEngaged')
    expect(engaged.length).toBeGreaterThanOrEqual(2)
    expect(engaged.every((p) => Math.hypot(p.vx, p.vy) < p.maxSpeed)).toBe(true)
  })

  it('controlled defender tackle can end a run before the scripted target', () => {
    const engine = createTestScrimmageState()
    const rng = createSeededRng(22)
    const { resolution, committedPlayIds } = advanceDrive(
      engine,
      { userOffensePlayId: 'inside_zone' },
      rng,
    )
    const off = getOffensivePlay('inside_zone')!
    const def = getDefensiveCall(committedPlayIds.defenseCallId)
    const setup = layoutPlayersAtLos(
      engine.possession,
      engine.yardLine,
      off.formationId,
      def?.visualTemplateId ?? 'four_three_base',
    )
    let world = createPlayWorldFromSnap({
      offenseTeam: engine.possession,
      yardLineAtSnap: engine.yardLine,
      signedTargetYards: 12,
      offensePlayId: 'inside_zone',
      defenseCallId: 'cover_2_zone',
      layoutPlayers: setup.players,
      ball: setup.ball,
      resolution,
    })
    const defender = world.players.find((p) => p.unit === 'defense' && p.role === 'LB')!
    const carrier = world.players.find((p) => p.id === world.ball.carrierId)!
    world = {
      ...world,
      players: world.players.map((p) =>
        p.id === defender.id
          ? { ...p, x: carrier.x + 0.35, y: carrier.y + 0.3, tackleIntentTimer: 0.25 }
          : p,
      ),
    }

    world = stepPlayWorld(
      world,
      SUBSTEP_DT,
      {
        carrierSteer: 0,
        activePlayerId: defender.id,
        moveX: -1,
        moveY: 0,
      },
      resolution,
    )

    expect(world.finished).toBe(true)
    expect(world.lastWhistleReason).toBe('tackle')
    expect(world.ball.x - world.yardLineAtSnap).toBeLessThan(12)
  })

  it('runtime timers tick down each frame', () => {
    const engine = createTestScrimmageState()
    const rng = createSeededRng(17)
    const { resolution, committedPlayIds } = advanceDrive(
      engine,
      { userOffensePlayId: 'quick_slants' },
      rng,
    )
    const off = getOffensivePlay('quick_slants')!
    const def = getDefensiveCall(committedPlayIds.defenseCallId)
    const { players, ball } = layoutPlayersAtLos(
      engine.possession,
      engine.yardLine,
      off.formationId,
      def?.visualTemplateId ?? 'four_three_base',
    )
    const world = createPlayWorldFromSnap({
      offenseTeam: engine.possession,
      yardLineAtSnap: engine.yardLine,
      signedTargetYards: resolution.yardsGained,
      offensePlayId: 'quick_slants',
      defenseCallId: committedPlayIds.defenseCallId,
      layoutPlayers: players,
      ball,
      resolution,
    })
    const seeded = {
      ...world,
      players: world.players.map((p, index) =>
        index === 0
          ? {
              ...p,
              actionCooldown: 0.3,
              tackleIntentTimer: 0.2,
              shedBoostTimer: 0.1,
            }
          : p,
      ),
    }

    const next = stepPlayWorld(seeded, SUBSTEP_DT, { carrierSteer: 0 }, resolution)
    const updated = next.players[0]
    expect(updated.actionCooldown).toBeCloseTo(0.3 - SUBSTEP_DT, 6)
    expect(updated.tackleIntentTimer).toBeCloseTo(0.2 - SUBSTEP_DT, 6)
    expect(updated.shedBoostTimer).toBeCloseTo(0.1 - SUBSTEP_DT, 6)
  })

  it('targeted defensive assignments populate assignmentTargetId', () => {
    const engine = createTestScrimmageState()
    const rng = createSeededRng(18)
    const { resolution } = advanceDrive(engine, { userOffensePlayId: 'inside_zone' }, rng)
    const off = getOffensivePlay('inside_zone')!
    const setup = layoutPlayersAtLos(
      engine.possession,
      engine.yardLine,
      off.formationId,
      'four_three_base',
    )
    const world = createPlayWorldFromSnap({
      offenseTeam: engine.possession,
      yardLineAtSnap: engine.yardLine,
      signedTargetYards: resolution.yardsGained,
      offensePlayId: 'inside_zone',
      defenseCallId: 'run_blitz',
      layoutPlayers: setup.players,
      ball: setup.ball,
      resolution,
    })

    const targeted = world.players.find(
      (p) => p.unit === 'defense' && p.assignmentTargetId !== null,
    )
    expect(targeted).toBeDefined()
    expect(targeted?.assignment).toMatch(/^blitz:/)
    expect(targeted?.assignmentTargetId).not.toBeNull()
    expect(world.players.some((p) => p.assignmentTargetId !== null)).toBe(true)
  })

  it('lastWhistleReason starts null and stays on the world state', () => {
    const engine = createTestScrimmageState()
    const rng = createSeededRng(19)
    const { resolution } = advanceDrive(engine, { userOffensePlayId: 'quick_slants' }, rng)
    const off = getOffensivePlay('quick_slants')!
    const setup = layoutPlayersAtLos(
      engine.possession,
      engine.yardLine,
      off.formationId,
      'four_three_base',
    )
    const world = createPlayWorldFromSnap({
      offenseTeam: engine.possession,
      yardLineAtSnap: engine.yardLine,
      signedTargetYards: resolution.yardsGained,
      offensePlayId: 'quick_slants',
      defenseCallId: 'cover_2_zone',
      layoutPlayers: setup.players,
      ball: setup.ball,
      resolution,
    })

    expect(world.lastWhistleReason).toBeNull()
    expect(world).toHaveProperty('lastWhistleReason')

    const next = stepPlayWorld(world, SUBSTEP_DT, { carrierSteer: 0 }, resolution)
    expect(next.lastWhistleReason).toBeNull()
    expect(next).toHaveProperty('lastWhistleReason')
  })

  it('pass target selection changes the receiver who can catch the ball', () => {
    const engine = createTestScrimmageState()
    const rng = createSeededRng(31)
    const { resolution, committedPlayIds } = advanceDrive(
      engine,
      { userOffensePlayId: 'quick_slants' },
      rng,
    )
    const off = getOffensivePlay('quick_slants')!
    const def = getDefensiveCall(committedPlayIds.defenseCallId)
    const setup = layoutPlayersAtLos(
      engine.possession,
      engine.yardLine,
      off.formationId,
      def?.visualTemplateId ?? 'four_three_base',
    )
    let world = createPlayWorldFromSnap({
      offenseTeam: engine.possession,
      yardLineAtSnap: engine.yardLine,
      signedTargetYards: Math.max(5, resolution.yardsGained),
      offensePlayId: 'quick_slants',
      defenseCallId: 'cover_2_zone',
      layoutPlayers: setup.players,
      ball: setup.ball,
      resolution: { ...resolution, outcome: 'normal', yardsGained: 6 },
    })
    const targets = world.players.filter(
      (p) => p.unit === 'offense' && (p.role === 'WR' || p.role === 'TE'),
    )
    expect(targets.length).toBeGreaterThan(1)
    world = setWorldPrimaryTarget(world, targets[1]!.id)

    for (
      let i = 0;
      i < 160 && !world.finished && world.ball.carrierId !== targets[1]!.id;
      i++
    ) {
      world = stepPlayWorld(
        world,
        SUBSTEP_DT,
        { carrierSteer: 0 },
        {
          ...resolution,
          outcome: 'normal',
          yardsGained: 6,
        },
      )
    }

    expect(world.ball.carrierId).toBe(targets[1]!.id)
    expect(world.passStage).toBe('received')
  })
})
