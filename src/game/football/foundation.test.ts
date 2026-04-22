import { describe, expect, it } from 'vitest'
import {
  createLiveStateAfterOpeningKickoff,
  createSeededRng,
  createTestScrimmageState,
  advanceDrive,
} from './footballState'
import {
  createPlayAnimationCore,
  derivePlayAnimationLegal,
  snap,
  toPlayAnimationSnapshot,
} from './playAnimation/playAnimationMachine'
import type { PlayAnimationCore } from './playAnimation/playAnimationMachine'
import { blendPlayerFrames } from './playAnimation/layout'
import { getOffensivePlay } from './playDefinitions'
import { getDefensiveCall } from './defensiveCalls'
import { buildOffensivePreviewLines } from './spatial/playRouteGeometry'
import { buildPreSnapPreview } from './spatial/preSnapPreview'
import { resolvePlay } from './playResolver'
import type { FootballGameState } from './footballTypes'
import { DEFAULT_AWAY_RATINGS, DEFAULT_HOME_RATINGS } from './footballTypes'

describe('foundation milestone', () => {
  it('route preview data exists for pass plays', () => {
    const play = getOffensivePlay('quick_slants')!
    const lines = buildOffensivePreviewLines(40, play.formationId, play.id, 'pass')
    expect(lines.some((l) => l.kind === 'route')).toBe(true)
  })

  it('defensive shell preview data exists for zone/man/blitz calls', () => {
    const d = getDefensiveCall('cover_2_zone')!
    const p = buildPreSnapPreview({
      los: 35,
      yardsToGo: 10,
      offenseFormationId: 'shotgun_trips',
      offensePlayId: 'mesh',
      offenseCategory: 'pass',
      defenseCall: d,
      includeOffenseRoutePreview: false,
    })
    expect(p.zoneHulls.length).toBeGreaterThan(0)

    const d1 = getDefensiveCall('cover_1_man')!
    const p1 = buildPreSnapPreview({
      los: 35,
      yardsToGo: 10,
      offenseFormationId: 'shotgun_trips',
      offensePlayId: 'mesh',
      offenseCategory: 'pass',
      defenseCall: d1,
      includeOffenseRoutePreview: false,
    })
    expect(p1.manEdges.length).toBeGreaterThan(0)

    const d0 = getDefensiveCall('cover_0_blitz')!
    const p0 = buildPreSnapPreview({
      los: 35,
      yardsToGo: 10,
      offenseFormationId: 'shotgun_trips',
      offensePlayId: 'mesh',
      offenseCategory: 'pass',
      defenseCall: d0,
      includeOffenseRoutePreview: false,
    })
    expect(p0.blitzArrows.length).toBeGreaterThan(0)
  })

  it('players interpolate smoothly between positions (no teleport per frame)', () => {
    const a = [
      { id: 'home_qb', teamId: 'home' as const, unit: 'offense' as const, x: 25, y: 0 },
    ]
    const b = [
      { id: 'home_qb', teamId: 'home' as const, unit: 'offense' as const, x: 32, y: 2 },
    ]
    let maxHop = 0
    let prev = blendPlayerFrames(a, b, 0)[0]!
    for (let i = 1; i <= 20; i++) {
      const t = i / 20
      const cur = blendPlayerFrames(a, b, t)[0]!
      maxHop = Math.max(maxHop, Math.hypot(cur.x - prev.x, cur.y - prev.y))
      prev = cur
    }
    expect(maxHop).toBeLessThan(2)
  })

  it('defensive calls affect resolver outcomes', () => {
    const play = getOffensivePlay('inside_zone')!
    const d1 = getDefensiveCall('prevent')!
    const d2 = getDefensiveCall('run_blitz')!
    const st = { yardLine: 45, down: 1 as const, yardsToGo: 10 }
    const r1 = resolvePlay(
      DEFAULT_HOME_RATINGS,
      DEFAULT_AWAY_RATINGS,
      play,
      d1,
      st,
      createSeededRng(99),
    )
    const r2 = resolvePlay(
      DEFAULT_HOME_RATINGS,
      DEFAULT_AWAY_RATINGS,
      play,
      d2,
      st,
      createSeededRng(99),
    )
    expect(r1.yardsGained).not.toBe(r2.yardsGained)
  })

  it('user cannot select both offensive play and defensive call for same play (legal flags)', () => {
    const core: PlayAnimationCore = {
      phase: 'preSnap',
      players: [],
      ball: { x: 25, y: 0, carrierId: 'home_qb' },
      world: null,
      carrierSteerInput: 0,
      moveInputX: 0,
      moveInputY: 0,
      activePlayerId: 'home_qb',
      pendingNext: null,
      pendingResolution: null,
      committedOffensePlayId: null,
      committedDefenseCallId: null,
      yardLineAtSnap: 25,
      offenseTeamAtSnap: 'home',
      signedTargetYards: 0,
      animatedYards: 0,
      receiverCycle: 0,
      playerSnapStart: null,
      playerRouteEnd: null,
    }
    const engine: FootballGameState = {
      ...createTestScrimmageState(),
      possession: 'home',
    }
    const uo = derivePlayAnimationLegal(core, engine, 'home', 'inside_zone', 'cover_2_zone')
    expect(uo.canSelectOffensivePlay).toBe(true)
    expect(uo.canSelectDefensiveCall).toBe(false)

    const ud = derivePlayAnimationLegal(
      { ...core, offenseTeamAtSnap: 'away' },
      { ...engine, possession: 'away' },
      'home',
      'inside_zone',
      'nickel',
    )
    expect(ud.canSelectOffensivePlay).toBe(false)
    expect(ud.canSelectDefensiveCall).toBe(true)
  })

  it('opening kickoff sets possession and field position', () => {
    const s = createLiveStateAfterOpeningKickoff({
      receivingTeam: 'away',
      userControlledTeam: 'home',
      openingKickIsHome: true,
    })
    expect(s.yardLine).toBe(25)
    expect(s.possession).toBe('away')
    expect(s.quarterLengthSeconds).toBe(120)
  })

  it('snapshot exposes timeline segments after snap', () => {
    const eHome: FootballGameState = {
      ...createLiveStateAfterOpeningKickoff({
        receivingTeam: 'home',
        userControlledTeam: 'home',
        openingKickIsHome: false,
      }),
      possession: 'home',
    }
    let core = createPlayAnimationCore(eHome)
    const snapOut = snap(core, eHome, 'inside_zone', 'cover_2_zone')
    expect(snapOut).not.toBeNull()
    core = snapOut!.core
    const shot = toPlayAnimationSnapshot(core, eHome, 'home', 'inside_zone', 'cover_2_zone')
    expect(shot.playTimelineSegments.length).toBeGreaterThan(0)
  })

  it('full short game can advance many drives without crashing', () => {
    let s = createTestScrimmageState()
    const rng = createSeededRng(7)
    for (let i = 0; i < 200; i++) {
      if (s.gameOver) break
      if (s.possession === 'home') {
        s = advanceDrive(s, { userOffensePlayId: 'quick_slants' }, rng).next
      } else {
        s = advanceDrive(s, { userDefenseCallId: 'cover_3_sky' }, rng).next
      }
    }
    expect(s).toBeDefined()
  })
})
