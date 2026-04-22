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
})
