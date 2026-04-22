import { describe, expect, it } from 'vitest'
import { createTestScrimmageState } from '../footballState'
import {
  advanceResult,
  animationSeed,
  createPlayAnimationCore,
  moveBallCarrier,
  snap,
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
})
