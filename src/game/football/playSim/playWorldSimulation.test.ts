import { describe, expect, it } from 'vitest'
import { advanceDrive, createSeededRng, createTestScrimmageState } from '../footballState'
import { getDefensiveCall } from '../defensiveCalls'
import { getOffensivePlay } from '../playDefinitions'
import { layoutPlayersAtLos } from '../playAnimation/layout'
import {
  createPlayWorldFromSnap,
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

    for (let i = 0; i < 60; i++) {
      world = stepPlayWorld(world, SUBSTEP_DT, { carrierSteer: 0 }, resolution)
    }

    expect(world.ball.x - startX).toBeGreaterThan(0.75)
    expect(world.ball.x - startX).toBeLessThan(7)
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
})
