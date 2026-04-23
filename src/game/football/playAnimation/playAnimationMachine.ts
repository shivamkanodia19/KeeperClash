import { advanceDrive, createSeededRng } from '../footballState'
import { getDefensiveCall } from '../defensiveCalls'
import type { FootballGameState, PlayResolution, TeamId } from '../footballTypes'
import { getOffensivePlay } from '../playDefinitions'
import { deriveCameraRecommendation } from '../spatial/cameraContract'
import { buildPlayTimelineSegments } from '../spatial/playTimeline'
import { buildPreSnapPreview } from '../spatial/preSnapPreview'
import {
  blendPlayerFrames,
  layoutPlayersAtLos,
  passReceiverIds,
  projectRouteEndpoints,
  qbIdForTeam,
} from './layout'
import type {
  BallFieldState,
  PassTrajectory,
  PlayAnimationLegalActions,
  PlayAnimationPhase,
  PlayAnimationSnapshot,
  PlayTimelineStage,
  PlayerFieldPosition,
} from './types'
import type { PlayResultMarker, PlayTimelineSegment } from '../spatial/geometryTypes'
import type { PlayWorldSimulation } from '../playSim/playSimTypes'
import {
  applyCarrierDive,
  applyCarrierJuke,
  applyDefenderShedIntent,
  applyDefenderTackleIntent,
  createPlayWorldFromSnap,
  setWorldPrimaryTarget,
  stepPlayWorld,
  SUBSTEP_DT,
  syncWorldToField,
} from '../playSim/playWorldSimulation'
import { PLAY_FEEL } from '../playSim/playFeelConfig'

const YARD_ANIM_STEP = 0.34
const PLAYBACK_TIME_SCALE = PLAY_FEEL.playbackTimeScale
/** Physics substeps bundled into one `moveBallCarrier` UI tick. */
const SIM_SUBSTEPS_PER_MOVE = PLAY_FEEL.manualStepSubsteps

export type PlayAnimationCore = {
  phase: PlayAnimationPhase
  players: PlayerFieldPosition[]
  ball: BallFieldState
  /** Continuous sim (22 + ball); null when idle or legacy lerp. */
  world: PlayWorldSimulation | null
  /** -1…1 lateral intent for user-controlled ball carrier (offense). */
  carrierSteerInput: number
  moveInputX: number
  moveInputY: number
  activePlayerId: string | null
  pendingNext: FootballGameState | null
  pendingResolution: PlayResolution | null
  /** Offense play id used for this snap (includes CPU pick when away has ball). */
  committedOffensePlayId: string | null
  /** Defense call id used for this snap (includes CPU pick when home has ball). */
  committedDefenseCallId: string | null
  yardLineAtSnap: number
  offenseTeamAtSnap: TeamId
  /** Clamped net yards toward goal for this snap (integer-ish). */
  signedTargetYards: number
  /** Cumulative yards moved in animation toward signedTargetYards. */
  animatedYards: number
  /** Cycle index for `selectReceiver` on pass plays. */
  receiverCycle: number
  /** Snap shot for smooth lerp. */
  playerSnapStart: PlayerFieldPosition[] | null
  /** Route/blocking endpoint snapshot. */
  playerRouteEnd: PlayerFieldPosition[] | null
}

export function animationSeed(
  engine: FootballGameState,
  offensePlayId: string,
  defenseCallId: string,
): number {
  let h =
    engine.down * 131 +
    engine.yardLine * 17 +
    engine.quarter * 23 +
    (engine.possession === 'away' ? 911382323 : 0)
  for (let i = 0; i < offensePlayId.length; i++) {
    h = (h + offensePlayId.charCodeAt(i) * (i + 7)) >>> 0
  }
  for (let i = 0; i < defenseCallId.length; i++) {
    h = (h + defenseCallId.charCodeAt(i) * (i + 11)) >>> 0
  }
  return h >>> 0
}

function clampYardDelta(yardLine: number, yardsGained: number): number {
  const maxGain = 100 - yardLine
  const maxLoss = -(yardLine - 1)
  if (yardsGained >= 0) return Math.min(yardsGained, maxGain)
  return Math.max(yardsGained, maxLoss)
}

function syncCarrierToPlayers(
  players: PlayerFieldPosition[],
  ball: BallFieldState,
): PlayerFieldPosition[] {
  if (!ball.carrierId) return players
  return players.map((p) =>
    p.id === ball.carrierId ? { ...p, x: ball.x, y: ball.y } : p,
  )
}

function progress01(core: PlayAnimationCore): number {
  const tgt = Math.abs(core.signedTargetYards)
  if (tgt < 0.01) return 1
  return Math.min(1, Math.abs(core.animatedYards) / tgt)
}

function deriveTimelineStage(core: PlayAnimationCore): PlayTimelineStage {
  if (core.phase === 'preSnap') return 'preSnap'
  if (core.phase === 'snap') return 'snap'
  if (core.phase === 'playInProgress') {
    const p = progress01(core)
    if (p < 0.38) return 'routesBlocking'
    return 'ballMovement'
  }
  if (core.phase === 'tackleOrScore') return 'tackleScoreTurnover'
  if (core.phase === 'result') return 'result'
  return 'ballMovement'
}

function derivePassTrajectory(
  core: PlayAnimationCore,
  players: PlayerFieldPosition[],
): PassTrajectory | null {
  const play = getOffensivePlay(core.committedOffensePlayId ?? '')
  if (!play || play.category !== 'pass') return null
  if (core.phase === 'preSnap' || core.phase === 'result') return null
  const qbId = qbIdForTeam(core.offenseTeamAtSnap)
  const qb = players.find((p) => p.id === qbId)
  if (!qb) return null
  const target = core.ball.throwTargetId
    ? players.find((p) => p.id === core.ball.throwTargetId)
    : undefined
  const carrier = players.find((p) => p.id === core.ball.carrierId)
  const end = target ?? carrier
  if (!end) return null
  return {
    fromX: qb.x,
    fromY: qb.y,
    toX: end.x,
    toY: end.y,
    peakY: Math.max(qb.y, end.y) + 9,
  }
}

export function createPlayAnimationCore(engine: FootballGameState): PlayAnimationCore {
  const { players, ball } = layoutPlayersAtLos(engine.possession, engine.yardLine)
  return {
    phase: 'preSnap',
    players,
    ball,
    world: null,
    carrierSteerInput: 0,
    moveInputX: 0,
    moveInputY: 0,
    activePlayerId: ball.carrierId,
    pendingNext: null,
    pendingResolution: null,
    committedOffensePlayId: null,
    committedDefenseCallId: null,
    yardLineAtSnap: engine.yardLine,
    offenseTeamAtSnap: engine.possession,
    signedTargetYards: 0,
    animatedYards: 0,
    receiverCycle: 0,
    playerSnapStart: null,
    playerRouteEnd: null,
  }
}

export function derivePlayAnimationLegal(
  core: PlayAnimationCore,
  engine: FootballGameState | null,
  userTeamId: TeamId,
  offensePick: string | null,
  defensePick: string | null,
): PlayAnimationLegalActions {
  const empty: PlayAnimationLegalActions = {
    canSelectOffensivePlay: false,
    canSelectDefensiveCall: false,
    canSnap: false,
    canMoveBallCarrier: false,
    canJuke: false,
    canDive: false,
    canSelectReceiver: false,
    canAdvanceResult: false,
  }
  if (!engine || engine.gameOver) return empty
  if (engine.sessionPhase !== 'play_calling') return empty

  const userOnOffense = engine.possession === userTeamId
  const off = offensePick ?? ''
  const def = defensePick ?? ''

  if (core.phase === 'preSnap') {
    const canSnap =
      (engine.possession === 'home' && off.length > 0) ||
      (engine.possession === 'away' && def.length > 0)
    return {
      canSelectOffensivePlay: userOnOffense,
      canSelectDefensiveCall: !userOnOffense,
      canSnap,
      canMoveBallCarrier: false,
      canJuke: false,
      canDive: false,
      canSelectReceiver: false,
      canAdvanceResult: false,
    }
  }

  if (core.phase === 'snap') {
    return {
      ...empty,
      canMoveBallCarrier: true,
    }
  }

  if (core.phase === 'playInProgress') {
    const play = getOffensivePlay(core.committedOffensePlayId ?? offensePick ?? '')
    const isPass = play?.category === 'pass'
    return {
      ...empty,
      canMoveBallCarrier: true,
      canJuke: true,
      canDive: true,
      canSelectReceiver: Boolean(isPass),
    }
  }

  if (core.phase === 'tackleOrScore' || core.phase === 'result') {
    return {
      ...empty,
      canAdvanceResult: true,
    }
  }

  return empty
}

function defenderCandidates(players: readonly PlayerFieldPosition[]): readonly string[] {
  return players.filter((p) => p.unit === 'defense').map((p) => p.id)
}

function offensiveControlCandidates(core: PlayAnimationCore): readonly string[] {
  const ids: string[] = []
  if (core.ball.carrierId) ids.push(core.ball.carrierId)
  const play = getOffensivePlay(core.committedOffensePlayId ?? '')
  if (play?.category === 'pass') {
    for (const id of passReceiverIds(core.offenseTeamAtSnap, play.formationId, play.id)) {
      if (!ids.includes(id)) ids.push(id)
    }
  }
  return ids
}

function passReceiverCandidates(core: PlayAnimationCore): readonly string[] {
  const play = getOffensivePlay(core.committedOffensePlayId ?? '')
  if (!play || play.category !== 'pass') return []
  return [...passReceiverIds(core.offenseTeamAtSnap, play.formationId, play.id)]
}

function currentPassTargetId(core: PlayAnimationCore, receivers: readonly string[]): string | null {
  const target = core.world?.primaryTargetId ?? core.ball.throwTargetId
  if (target && receivers.includes(target)) return target
  const idx = core.receiverCycle % Math.max(1, receivers.length)
  return receivers[idx] ?? null
}

function applyPassTargetSelection(
  core: PlayAnimationCore,
  receiverId: string,
  receiverIndex: number,
): PlayAnimationCore | null {
  if (receiverIndex < 0) return null
  const nextCycle = receiverIndex + 1
  if (!core.world) {
    return {
      ...core,
      ball: { ...core.ball, throwTargetId: receiverId },
      receiverCycle: nextCycle,
    }
  }
  const w = setWorldPrimaryTarget(core.world, receiverId)
  const { players, ball } = syncWorldToField(w)
  return {
    ...core,
    world: w,
    receiverCycle: nextCycle,
    players: syncCarrierToPlayers(players, ball),
    ball,
  }
}

function activePlayerAfterWorldSync(
  core: PlayAnimationCore,
  players: readonly PlayerFieldPosition[],
  ball: BallFieldState,
): string | null {
  const active = players.find((p) => p.id === core.activePlayerId)
  if (active?.unit === 'defense') {
    const ballHolder = ball.carrierId ? players.find((p) => p.id === ball.carrierId) : null
    return ballHolder?.unit === 'defense' ? ballHolder.id : active.id
  }
  return ball.carrierId ?? core.activePlayerId
}

export function toPlayAnimationSnapshot(
  core: PlayAnimationCore,
  engine: FootballGameState | null,
  userTeamId: TeamId,
  offensePick: string | null,
  defensePick: string | null,
): PlayAnimationSnapshot {
  const players = core.players
  const passTrajectory = derivePassTrajectory(core, [...players])
  const userOnOffense = Boolean(engine && engine.possession === userTeamId)
  const offIdPick = userOnOffense ? offensePick : core.committedOffensePlayId
  const defIdPick = userOnOffense ? core.committedDefenseCallId : defensePick
  const selOff = getOffensivePlay(offIdPick ?? '')
  const selDef = getDefensiveCall(defIdPick ?? '')

  const preSnapPreview =
    engine && core.phase === 'preSnap' && engine.sessionPhase === 'play_calling'
      ? buildPreSnapPreview({
          los: engine.yardLine,
          yardsToGo: engine.yardsToGo,
          offenseFormationId: selOff?.formationId ?? 'shotgun_doubles',
          offensePlayId: selOff?.id ?? 'quick_slants',
          offenseCategory: selOff?.category ?? 'pass',
          defenseCall: userOnOffense ? null : selDef ?? null,
          includeOffenseRoutePreview: userOnOffense,
          labels: {
            offense: selOff?.name,
            defense: userOnOffense ? undefined : selDef?.name,
          },
        })
      : null

  let playTimelineSegments: PlayTimelineSegment[] = []
  if (core.playerSnapStart && core.playerRouteEnd) {
    const qbId = qbIdForTeam(core.offenseTeamAtSnap)
    const qbS = core.playerSnapStart.find((p) => p.id === qbId)
    const ballStart = { x: qbS?.x ?? core.ball.x, y: qbS?.y ?? core.ball.y }
    const carrier = core.playerRouteEnd.find((p) => p.id === core.ball.carrierId)
    const ballEnd = carrier
      ? { x: carrier.x, y: carrier.y }
      : {
          x: core.yardLineAtSnap + core.signedTargetYards,
          y: core.ball.y,
        }
    playTimelineSegments = buildPlayTimelineSegments(
      core.playerSnapStart,
      core.playerRouteEnd,
      ballStart,
      ballEnd,
    )
  }

  const losX = engine?.yardLine ?? core.yardLineAtSnap
  const playResultMarkers: PlayResultMarker[] = []
  if (core.phase === 'tackleOrScore' || core.phase === 'result') {
    const kind =
      core.pendingResolution?.outcome === 'touchdown'
        ? 'score'
        : core.pendingResolution?.outcome === 'incomplete'
          ? 'incomplete'
          : 'tackle'
    playResultMarkers.push({
      t: 1,
      kind,
      position: { x: core.ball.x, y: core.ball.y },
    })
  }

  const cameraRecommendation = deriveCameraRecommendation({
    phase: core.phase,
    lineOfScrimmageX: losX,
    ball: core.ball,
    playProgress01: progress01(core),
  })

  const defenderIds = defenderCandidates(players)
  const offenseCandidates = offensiveControlCandidates(core)
  const liveControl = core.phase === 'snap' || core.phase === 'playInProgress'
  const userOnDefense = Boolean(engine && !userOnOffense)
  const defensiveLiveControl = userOnDefense && liveControl
  const controllablePlayerIds = userOnOffense ? offenseCandidates : defenderIds
  const controlMode: PlayAnimationSnapshot['controlMode'] =
    userOnOffense && liveControl
      ? 'offense'
      : defensiveLiveControl
        ? 'defense'
      : userOnDefense && core.phase === 'preSnap'
        ? 'defense_preview'
        : 'none'
  const inputHints =
    controlMode === 'offense'
      ? ['move', 'juke', 'dive', 'switch']
      : controlMode === 'defense'
        ? ['move', 'switch', 'tackle']
      : controlMode === 'defense_preview'
        ? ['select defensive call']
        : []
  const selectedDefenderId =
    defensiveLiveControl && core.activePlayerId && defenderIds.includes(core.activePlayerId)
      ? core.activePlayerId
      : null

  return {
    schemaVersion: 1,
    phase: core.phase,
    timelineStage: deriveTimelineStage(core),
    lineOfScrimmageAtSnap: core.yardLineAtSnap,
    players,
    ball: core.ball,
    ballCarrierId: core.ball.carrierId,
    passTrajectory,
    selectedOffensivePlayId: core.committedOffensePlayId ?? offensePick,
    selectedDefensiveCallId: core.committedDefenseCallId ?? defensePick,
    legal: derivePlayAnimationLegal(
      core,
      engine,
      userTeamId,
      offensePick,
      defensePick,
    ),
    preSnapPreview,
    playTimelineSegments,
    cameraRecommendation,
    playResultMarkers,
    selectedDefenderId,
    controllableDefenderCandidates: defenderIds,
    defensiveControlEnabled: defensiveLiveControl,
    activePlayerId: core.activePlayerId,
    controllablePlayerIds,
    controlMode,
    inputHints,
  }
}

export function snap(
  core: PlayAnimationCore,
  engine: FootballGameState,
  offensePlayId: string,
  defenseCallId: string,
): { core: PlayAnimationCore; resolution: PlayResolution } | null {
  if (core.phase !== 'preSnap' || engine.gameOver) return null
  if (engine.sessionPhase !== 'play_calling') return null

  const rng = createSeededRng(animationSeed(engine, offensePlayId, defenseCallId))
  let next: FootballGameState
  let resolution: PlayResolution
  let committedOffensePlayId: string
  let committedDefenseCallId: string
  try {
    const out =
      engine.possession === 'home'
        ? advanceDrive(engine, { userOffensePlayId: offensePlayId }, rng)
        : advanceDrive(engine, { userDefenseCallId: defenseCallId }, rng)
    next = out.next
    resolution = out.resolution
    committedOffensePlayId = out.committedPlayIds.offensePlayId
    committedDefenseCallId = out.committedPlayIds.defenseCallId
  } catch {
    return null
  }

  const yardLineAtSnap = engine.yardLine
  const offenseTeamAtSnap = engine.possession
  const signedTargetYards = clampYardDelta(yardLineAtSnap, resolution.yardsGained)
  const offPl = getOffensivePlay(committedOffensePlayId)
  const defCl = getDefensiveCall(committedDefenseCallId)
  const { players, ball } = layoutPlayersAtLos(
    offenseTeamAtSnap,
    yardLineAtSnap,
    offPl?.formationId ?? 'shotgun_doubles',
    defCl?.visualTemplateId ?? 'four_three_base',
  )
  const routeEnd = projectRouteEndpoints(players, committedOffensePlayId, signedTargetYards)

  const qbCarrierId = qbIdForTeam(offenseTeamAtSnap)
  const ballAtSnap: BallFieldState = { ...ball, carrierId: qbCarrierId }
  const world = createPlayWorldFromSnap({
    offenseTeam: offenseTeamAtSnap,
    yardLineAtSnap,
    signedTargetYards,
    offensePlayId: committedOffensePlayId,
    defenseCallId: committedDefenseCallId,
    layoutPlayers: players,
    ball: ballAtSnap,
    resolution,
  })
  const ballWithLiveTarget: BallFieldState = {
    ...ballAtSnap,
    mode: world.ball.mode,
    throwTargetId: world.ball.throwTargetId,
    z: world.ball.z,
  }

  return {
    core: {
      ...core,
      phase: 'snap',
      players,
      ball: ballWithLiveTarget,
      world,
      carrierSteerInput: 0,
      moveInputX: 0,
      moveInputY: 0,
      activePlayerId: ballWithLiveTarget.carrierId,
      pendingNext: next,
      pendingResolution: resolution,
      committedOffensePlayId,
      committedDefenseCallId,
      yardLineAtSnap,
      offenseTeamAtSnap,
      signedTargetYards,
      animatedYards: 0,
      receiverCycle: 0,
      playerSnapStart: players.map((p) => ({ ...p })),
      playerRouteEnd: routeEnd,
    },
    resolution,
  }
}

function stepTowardTarget(current: number, target: number, step: number): number {
  if (target === current) return current
  if (target > current) return Math.min(current + step, target)
  return Math.max(current - step, target)
}

function lerpPlayersForCore(core: PlayAnimationCore): PlayerFieldPosition[] {
  const start = core.playerSnapStart
  const end = core.playerRouteEnd
  if (!start || !end) return core.players
  const t = progress01(core)
  return blendPlayerFrames(start, end, t)
}

export function setCarrierSteerInput(core: PlayAnimationCore, steer: number): PlayAnimationCore {
  const s = Math.max(-1, Math.min(1, steer))
  return { ...core, carrierSteerInput: s, moveInputY: s }
}

export function setPlayerMoveVector(
  core: PlayAnimationCore,
  x: number,
  y: number,
): PlayAnimationCore {
  return {
    ...core,
    carrierSteerInput: Math.max(-1, Math.min(1, y)),
    moveInputX: Math.max(-1, Math.min(1, x)),
    moveInputY: Math.max(-1, Math.min(1, y)),
  }
}

export function switchActivePlayer(
  core: PlayAnimationCore,
  target?: string | number,
  unit: 'offense' | 'defense' = 'offense',
): PlayAnimationCore | null {
  if (unit === 'defense') {
    const ids = defenderCandidates(core.players)
    if (ids.length === 0) return core

    let nextId: string
    if (typeof target === 'string' && ids.includes(target)) {
      nextId = target
    } else {
      const direction = typeof target === 'number' && target < 0 ? -1 : 1
      const currentIdx = ids.indexOf(core.activePlayerId ?? '')
      const startIdx = currentIdx >= 0 ? currentIdx : direction > 0 ? -1 : 0
      nextId = ids[(startIdx + direction + ids.length) % ids.length]!
    }

    return { ...core, activePlayerId: nextId }
  }

  const play = getOffensivePlay(core.committedOffensePlayId ?? '')
  if (play?.category === 'pass') {
    const receivers = passReceiverCandidates(core)
    if (receivers.length === 0) return core

    const currentTarget = currentPassTargetId(core, receivers)
    let nextId = currentTarget ?? receivers[0]!
    let nextIndex = receivers.indexOf(nextId)

    if (typeof target === 'string') {
      const directIdx = receivers.indexOf(target)
      if (directIdx >= 0) {
        nextId = target
        nextIndex = directIdx
      } else {
        nextIndex = nextIndex >= 0 ? nextIndex : 0
      }
    } else if (typeof target === 'number') {
      const direction = target < 0 ? -1 : 1
      const baseIdx = nextIndex >= 0 ? nextIndex : 0
      nextIndex = (baseIdx + direction + receivers.length) % receivers.length
      nextId = receivers[nextIndex]!
    } else if (nextIndex < 0) {
      nextIndex = 0
      nextId = receivers[0]!
    } else {
      nextIndex = (nextIndex + 1) % receivers.length
      nextId = receivers[nextIndex]!
    }

    return applyPassTargetSelection(core, nextId, nextIndex)
  }

  const ids = offensiveControlCandidates(core)
  if (ids.length === 0) return core

  let nextId: string
  if (typeof target === 'string' && ids.includes(target)) {
    nextId = target
  } else {
    const direction = typeof target === 'number' && target < 0 ? -1 : 1
    const currentIdx = ids.indexOf(core.activePlayerId ?? '')
    const startIdx = currentIdx >= 0 ? currentIdx : direction > 0 ? -1 : 0
    nextId = ids[(startIdx + direction + ids.length) % ids.length]!
  }

  return { ...core, activePlayerId: nextId }
}

function dynamicCommentary(base: PlayResolution, yards: number, outcome: PlayResolution['outcome']): string {
  if (outcome === 'touchdown') return 'Touchdown!'
  if (outcome === 'interception') return 'Intercepted!'
  if (outcome === 'incomplete') return 'Incomplete pass.'
  if (outcome === 'sack') return `Sack for ${Math.abs(yards)} yards.`
  if (yards >= 10) return `User-controlled play gains ${yards} yards.`
  if (yards > 0) return `Play gains ${yards} yards.`
  if (yards === 0) return 'Stuffed at the line.'
  if (base.outcome === 'sack') return `Sack for ${Math.abs(yards)} yards.`
  return `Play loses ${Math.abs(yards)} yards.`
}

export function deriveLivePlayResolution(core: PlayAnimationCore): PlayResolution | null {
  const base = core.pendingResolution
  if (!base) return null
  if (
    base.outcome === 'field_goal_made' ||
    base.outcome === 'field_goal_miss' ||
    base.outcome === 'punt' ||
    base.outcome === 'fumble_lost' ||
    base.outcome === 'turnover_on_downs'
  ) {
    return base
  }

  const carrier = core.ball.carrierId
    ? core.players.find((p) => p.id === core.ball.carrierId)
    : null
  if (carrier?.unit === 'defense') {
    const turnoverYardLine = Math.round(core.ball.x)
    return {
      ...base,
      outcome: 'interception',
      yardsGained: Math.round(core.ball.x - core.yardLineAtSnap),
      turnoverYardLine,
      commentary: dynamicCommentary(base, 0, 'interception'),
    }
  }

  if (!carrier && core.ball.mode === 'dead') {
    if (base.outcome === 'sack') {
      return {
        ...base,
        outcome: 'sack',
        commentary: dynamicCommentary(base, base.yardsGained, 'sack'),
      }
    }
    return {
      ...base,
      outcome: 'incomplete',
      yardsGained: 0,
      commentary: dynamicCommentary(base, 0, 'incomplete'),
    }
  }

  const yards = Math.round(core.ball.x - core.yardLineAtSnap)
  const outcome =
    core.ball.x >= 100 && carrier?.unit === 'offense'
      ? 'touchdown'
      : base.outcome === 'sack' && yards <= 0
        ? 'sack'
        : 'normal'

  return {
    ...base,
    outcome,
    yardsGained: yards,
    commentary: dynamicCommentary(base, yards, outcome),
  }
}

/**
 * Advance the play-world sim by wall-clock `dtMs` (for rAF loops). No-op if no active world.
 */
export function advancePlaySimulationFrame(
  core: PlayAnimationCore,
  dtMs: number,
): PlayAnimationCore | null {
  if (!core.world || !core.pendingResolution) return null
  if (core.phase !== 'snap' && core.phase !== 'playInProgress') return null

  let w = core.world
  const res = core.pendingResolution
  const dtSec = Math.min(
    PLAY_FEEL.maxFrameDtSeconds,
    (Math.max(0, dtMs) / 1000) * PLAYBACK_TIME_SCALE,
  )
  let remaining = dtSec
  while (remaining > 1e-6) {
    const step = Math.min(SUBSTEP_DT, remaining)
    w = stepPlayWorld(
      w,
      step,
      {
        carrierSteer: core.carrierSteerInput,
        moveX: core.moveInputX,
        moveY: core.moveInputY,
        activePlayerId: core.activePlayerId,
      },
      res,
    )
    remaining -= step
    if (w.finished) break
  }
  const { players, ball, animatedYards } = syncWorldToField(w)
  const reached = w.finished
  let phase: PlayAnimationPhase = core.phase
  if (core.phase === 'snap') phase = reached ? 'tackleOrScore' : 'playInProgress'
  else if (core.phase === 'playInProgress' && reached) phase = 'tackleOrScore'

  return {
    ...core,
    world: reached ? null : w,
    phase,
    players: syncCarrierToPlayers(players, ball),
    ball,
    activePlayerId: activePlayerAfterWorldSync(core, players, ball),
    animatedYards,
  }
}

function stepWorldOnce(core: PlayAnimationCore): PlayAnimationCore | null {
  if (!core.world || !core.pendingResolution) return null
  let w = core.world
  const res = core.pendingResolution
  for (let i = 0; i < SIM_SUBSTEPS_PER_MOVE; i++) {
    w = stepPlayWorld(
      w,
      SUBSTEP_DT,
      {
        carrierSteer: core.carrierSteerInput,
        moveX: core.moveInputX,
        moveY: core.moveInputY,
        activePlayerId: core.activePlayerId,
      },
      res,
    )
    if (w.finished) break
  }
  const { players, ball, animatedYards } = syncWorldToField(w)
  const reached = w.finished
  let phase: PlayAnimationPhase = core.phase
  if (core.phase === 'snap') phase = reached ? 'tackleOrScore' : 'playInProgress'
  else if (core.phase === 'playInProgress' && reached) phase = 'tackleOrScore'

  return {
    ...core,
    world: reached ? null : w,
    phase,
    players: syncCarrierToPlayers(players, ball),
    ball,
    activePlayerId: activePlayerAfterWorldSync(core, players, ball),
    animatedYards,
  }
}

export function moveBallCarrier(core: PlayAnimationCore): PlayAnimationCore | null {
  if (core.world && core.pendingResolution) {
    return stepWorldOnce(core)
  }

  if (core.phase === 'snap') {
    if (core.signedTargetYards === 0) {
      const players = lerpPlayersForCore({ ...core, animatedYards: 0 })
      const ball: BallFieldState = {
        x: core.yardLineAtSnap,
        y: core.ball.y,
        carrierId: core.ball.carrierId,
      }
      return {
        ...core,
        phase: 'tackleOrScore',
        animatedYards: 0,
        players: syncCarrierToPlayers(players, ball),
        ball,
      }
    }
    const step = Math.sign(core.signedTargetYards) * YARD_ANIM_STEP
    const nextAnimated = stepTowardTarget(0, core.signedTargetYards, Math.abs(step))
    const ball: BallFieldState = {
      x: core.yardLineAtSnap + nextAnimated,
      y: core.ball.y,
      carrierId: core.ball.carrierId,
    }
    const basePlayers = lerpPlayersForCore({ ...core, animatedYards: nextAnimated })
    const players = syncCarrierToPlayers(basePlayers, ball)
    const reached = nextAnimated === core.signedTargetYards
    return {
      ...core,
      phase: reached ? 'tackleOrScore' : 'playInProgress',
      animatedYards: nextAnimated,
      ball,
      players,
    }
  }
  if (core.phase !== 'playInProgress') return null

  const step = Math.sign(core.signedTargetYards) * YARD_ANIM_STEP
  const nextAnimated = stepTowardTarget(
    core.animatedYards,
    core.signedTargetYards,
    Math.abs(step),
  )
  const ball: BallFieldState = {
    x: core.yardLineAtSnap + nextAnimated,
    y: core.ball.y,
    carrierId: core.ball.carrierId,
  }
  const basePlayers = lerpPlayersForCore({ ...core, animatedYards: nextAnimated })
  const players = syncCarrierToPlayers(basePlayers, ball)
  const reached = nextAnimated === core.signedTargetYards
  if (reached) {
    return {
      ...core,
      phase: 'tackleOrScore',
      animatedYards: nextAnimated,
      ball,
      players,
    }
  }
  return {
    ...core,
    animatedYards: nextAnimated,
    ball,
    players,
  }
}

export function juke(core: PlayAnimationCore): PlayAnimationCore | null {
  if (core.phase !== 'snap' && core.phase !== 'playInProgress') return null
  if (core.world) {
    const active = core.world.players.find((p) => p.id === core.activePlayerId)
    if (active?.unit === 'defense') {
      const world = applyDefenderShedIntent(core.world, active.id)
      const synced = syncWorldToField(world)
      return {
        ...core,
        world,
        players: synced.players,
        ball: synced.ball,
        animatedYards: synced.animatedYards,
      }
    }
    const w = applyCarrierJuke(core.world, 1)
    const { players, ball } = syncWorldToField(w)
    return {
      ...core,
      world: w,
      players: syncCarrierToPlayers(players, ball),
      ball,
      activePlayerId: activePlayerAfterWorldSync(core, players, ball),
    }
  }
  const ny = Math.max(-20, Math.min(20, core.ball.y + 3))
  const ball = { ...core.ball, y: ny }
  const players = syncCarrierToPlayers(core.players, ball)
  return { ...core, ball, players }
}

export function dive(core: PlayAnimationCore): PlayAnimationCore | null {
  if (core.phase !== 'snap' && core.phase !== 'playInProgress') return null
  if (core.world) {
    const world = core.world
    const active = world.players.find((p) => p.id === core.activePlayerId)
    const w =
      active?.unit === 'defense'
        ? applyDefenderTackleIntent(world, active.id)
        : applyCarrierDive(world)
    const { players, ball } = syncWorldToField(w)
    return {
      ...core,
      world: w,
      players: syncCarrierToPlayers(players, ball),
      ball,
      activePlayerId: activePlayerAfterWorldSync(core, players, ball),
    }
  }
  const nextAnimated = stepTowardTarget(
    core.animatedYards,
    core.signedTargetYards,
    Math.min(3, Math.abs(core.signedTargetYards - core.animatedYards)),
  )
  const ball: BallFieldState = {
    x: core.yardLineAtSnap + nextAnimated,
    y: core.ball.y,
    carrierId: core.ball.carrierId,
  }
  const basePlayers = lerpPlayersForCore({ ...core, animatedYards: nextAnimated })
  const players = syncCarrierToPlayers(basePlayers, ball)
  const reached = nextAnimated === core.signedTargetYards
  return {
    ...core,
    phase: reached ? 'tackleOrScore' : 'playInProgress',
    animatedYards: nextAnimated,
    ball,
    players,
  }
}

export function setPassTargetReceiver(
  core: PlayAnimationCore,
  receiverId: string,
): PlayAnimationCore | null {
  if (core.phase !== 'playInProgress' && core.phase !== 'snap') return null
  const receivers = passReceiverCandidates(core)
  const idx = receivers.indexOf(receiverId)
  if (idx < 0) return null
  return applyPassTargetSelection(core, receiverId, idx)
}

export function selectReceiver(core: PlayAnimationCore): PlayAnimationCore | null {
  if (core.phase !== 'playInProgress') return null
  const receivers = passReceiverCandidates(core)
  if (receivers.length === 0) return null
  const idx = core.receiverCycle % receivers.length
  const targetId = receivers[idx]!
  return applyPassTargetSelection(core, targetId, idx)
}

/**
 * From `tackleOrScore`: pass the engine state **after** applying `pendingNext`; returns `result` layout.
 * From `result`: returns fresh `preSnap` layout for the same engine (caller does not mutate engine).
 */
export function advanceResult(
  core: PlayAnimationCore,
  engineAfterApply: FootballGameState | null,
): PlayAnimationCore | null {
  if (core.phase === 'tackleOrScore') {
    if (!engineAfterApply) return null
    return {
      ...createPlayAnimationCore(engineAfterApply),
      phase: 'result',
      committedOffensePlayId: core.committedOffensePlayId,
      committedDefenseCallId: core.committedDefenseCallId,
    }
  }
  if (core.phase === 'result') {
    if (!engineAfterApply) return null
    return createPlayAnimationCore(engineAfterApply)
  }
  return null
}
