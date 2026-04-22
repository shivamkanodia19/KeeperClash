import type {
  Down,
  FootballGameState,
  PlayResolution,
  Quarter,
  TeamId,
  TeamRatings,
} from './footballTypes'
import {
  DEFAULT_AWAY_RATINGS,
  DEFAULT_HOME_RATINGS,
  DEFAULT_QUARTER_LENGTH_SECONDS,
} from './footballTypes'
import { getDefensiveCall } from './defensiveCalls'
import { getOffensivePlay } from './playDefinitions'
import { pickOpponentDefenseCall, pickOpponentOffensePlay } from './opponentAI'
import { getPuntNetYards, resolvePlay } from './playResolver'

function clampLine(y: number): number {
  return Math.max(1, Math.min(99, Math.round(y)))
}

function yardsToGoAfterFirstDown(yardLine: number): number {
  const dist = 100 - yardLine
  return Math.min(10, Math.max(1, dist))
}

function mirrorField(yardLine: number): number {
  return clampLine(100 - yardLine)
}

/** Exported for tests — advances quarter clock and sets `gameOver` when Q4 expires. */
export function applyClock(
  state: FootballGameState,
  secondsUsed: number,
): Pick<FootballGameState, 'quarter' | 'clockSeconds' | 'gameOver'> {
  if (state.gameOver) {
    return {
      quarter: state.quarter,
      clockSeconds: state.clockSeconds,
      gameOver: true,
    }
  }
  let c = state.clockSeconds - secondsUsed
  let q = state.quarter
  while (c <= 0 && q < 4) {
    const carry = c
    q = (q + 1) as Quarter
    c = state.quarterLengthSeconds + carry
  }
  if (c <= 0 && q === 4) {
    return { quarter: 4, clockSeconds: 0, gameOver: true }
  }
  return { quarter: q, clockSeconds: Math.max(0, c), gameOver: false }
}

function other(team: TeamId): TeamId {
  return team === 'home' ? 'away' : 'home'
}

function kickoffReceiveState(
  possession: TeamId,
): Pick<FootballGameState, 'possession' | 'yardLine' | 'down' | 'yardsToGo'> {
  return {
    possession,
    yardLine: 25,
    down: 1,
    yardsToGo: 10,
  }
}

/** Pregame: no user team yet; UI should run team selection then opening kickoff. */
export function createPregameFootballState(): FootballGameState {
  return {
    homeScore: 0,
    awayScore: 0,
    quarter: 1,
    clockSeconds: DEFAULT_QUARTER_LENGTH_SECONDS,
    quarterLengthSeconds: DEFAULT_QUARTER_LENGTH_SECONDS,
    possession: 'home',
    yardLine: 25,
    down: 1,
    yardsToGo: 10,
    gameOver: false,
    playLog: [],
    userControlledTeam: null,
    sessionPhase: 'team_selection',
    kickoffContext: 'none',
    kickoffReceivingTeam: null,
    openingKickIsHome: null,
  }
}

export type LiveKickoffParams = {
  /** Who is receiving the opening kick (starts with ball @ own 25). */
  receivingTeam: TeamId
  /** Human-controlled side (for possession / picker rules). */
  userControlledTeam: TeamId
  /** True if the home team kicked off to start Q1. */
  openingKickIsHome: boolean
  /** Arcade quarter length; default 120s. */
  quarterLengthSeconds?: number
}

/**
 * Live scrimmage state immediately after the opening kick is caught / placed at the 25.
 */
export function createLiveStateAfterOpeningKickoff(
  p: LiveKickoffParams,
): FootballGameState {
  const kicker = p.openingKickIsHome ? 'Home' : 'Away'
  const recv = p.receivingTeam === 'home' ? 'Home' : 'Away'
  const ql = p.quarterLengthSeconds ?? DEFAULT_QUARTER_LENGTH_SECONDS
  return {
    homeScore: 0,
    awayScore: 0,
    quarter: 1,
    clockSeconds: ql,
    quarterLengthSeconds: ql,
    ...kickoffReceiveState(p.receivingTeam),
    gameOver: false,
    playLog: [`Opening kickoff: ${kicker} kicks, ${recv} receives at own 25.`],
    userControlledTeam: p.userControlledTeam,
    sessionPhase: 'play_calling',
    kickoffContext: 'none',
    kickoffReceivingTeam: null,
    openingKickIsHome: p.openingKickIsHome,
  }
}

/**
 * Deterministic post-kickoff scrimmage for unit tests (home ball, 1st & 10 @25).
 * @deprecated Prefer explicit factories; kept for focused engine tests.
 */
export function createTestScrimmageState(): FootballGameState {
  return {
    homeScore: 0,
    awayScore: 0,
    quarter: 1,
    clockSeconds: DEFAULT_QUARTER_LENGTH_SECONDS,
    quarterLengthSeconds: DEFAULT_QUARTER_LENGTH_SECONDS,
    possession: 'home',
    yardLine: 25,
    down: 1,
    yardsToGo: 10,
    gameOver: false,
    playLog: ['Test setup: Home ball 1st & 10 @ own 25.'],
    userControlledTeam: 'home',
    sessionPhase: 'play_calling',
    kickoffContext: 'none',
    kickoffReceivingTeam: null,
    openingKickIsHome: true,
  }
}

/** @alias {@link createPregameFootballState} */
export function createInitialFootballState(): FootballGameState {
  return createPregameFootballState()
}

export type AdvanceParams = {
  /** Required when `state.possession === 'home'`. */
  userOffensePlayId?: string
  /** Required when `state.possession === 'away'`. */
  userDefenseCallId?: string
}

/**
 * Apply a resolved play to game state (clock, downs, possession, score).
 * Exported for unit tests and debug harnesses; prefer `advanceDrive` in production flow.
 */
export function applyResolvedPlay(
  state: FootballGameState,
  resolution: PlayResolution,
  rng: () => number,
): FootballGameState {
  if (state.gameOver) {
    throw new Error('Cannot apply play to a finished game.')
  }

  let next: FootballGameState = {
    ...state,
    playLog: [...state.playLog, resolution.commentary].slice(-80),
  }

  const prevQuarter = state.quarter
  const clockTick = applyClock(next, resolution.clockUsed)
  next = { ...next, ...clockTick }

  const crossedHalftime = prevQuarter === 2 && next.quarter === 3

  const offenseTeam = state.possession
  const scoringTeam = offenseTeam

  const addScore = (team: TeamId, pts: number) => {
    if (team === 'home') next.homeScore += pts
    else next.awayScore += pts
  }

  const flipPossessionKickoff = (newPossession: TeamId) => {
    Object.assign(next, kickoffReceiveState(newPossession))
    const recv = newPossession === 'home' ? 'Home' : 'Away'
    next.playLog = [...next.playLog, `Post-score kickoff: ${recv} receives at own 25.`].slice(
      -80,
    )
    next.sessionPhase = 'play_calling'
    next.kickoffContext = 'none'
  }

  switch (resolution.outcome) {
    case 'touchdown': {
      addScore(scoringTeam, 7)
      flipPossessionKickoff(other(scoringTeam))
      break
    }
    case 'field_goal_made': {
      addScore(scoringTeam, 3)
      flipPossessionKickoff(other(scoringTeam))
      break
    }
    case 'field_goal_miss': {
      const spot = clampLine(mirrorField(state.yardLine))
      next.possession = other(offenseTeam)
      next.yardLine = spot
      next.down = 1
      next.yardsToGo = yardsToGoAfterFirstDown(spot)
      break
    }
    case 'punt': {
      const net = getPuntNetYards(resolution)
      const landing = state.yardLine + net
      let recvYard: number
      if (landing >= 100) {
        recvYard = 25
      } else {
        recvYard = clampLine(100 - landing)
      }
      next.possession = other(offenseTeam)
      next.yardLine = recvYard
      next.down = 1
      next.yardsToGo = yardsToGoAfterFirstDown(recvYard)
      break
    }
    case 'interception':
    case 'fumble_lost': {
      const returnYard = Math.round(25 + rng() * 30)
      next.possession = other(offenseTeam)
      next.yardLine = clampLine(returnYard)
      next.down = 1
      next.yardsToGo = yardsToGoAfterFirstDown(next.yardLine)
      break
    }
    case 'sack':
    case 'incomplete':
    case 'normal': {
      const y = resolution.yardsGained
      let line = state.yardLine
      let down = state.down
      let ytg = state.yardsToGo

      if (resolution.outcome === 'incomplete') {
        down = (down + 1) as Down
      } else {
        line = clampLine(state.yardLine + y)
        const gained = line - state.yardLine
        if (gained >= ytg) {
          down = 1
          ytg = yardsToGoAfterFirstDown(line)
        } else {
          down = (down + 1) as Down
          ytg = Math.max(1, ytg - gained)
        }
      }

      if (down > 4) {
        next.possession = other(offenseTeam)
        next.yardLine = mirrorField(line)
        next.down = 1
        next.yardsToGo = yardsToGoAfterFirstDown(next.yardLine)
        next.playLog = [...next.playLog, 'Turnover on downs.'].slice(-80)
      } else {
        next.yardLine = line
        next.down = down
        next.yardsToGo = ytg
      }
      break
    }
    default:
      break
  }

  if (crossedHalftime && state.openingKickIsHome != null) {
    const secondHalfReceiver: TeamId = state.openingKickIsHome ? 'home' : 'away'
    next.possession = secondHalfReceiver
    next.yardLine = 25
    next.down = 1
    next.yardsToGo = 10
    next.sessionPhase = 'play_calling'
    next.kickoffContext = 'none'
    const recv = secondHalfReceiver === 'home' ? 'Home' : 'Away'
    next.playLog = [...next.playLog, `Halftime kickoff: ${recv} receives at own 25.`].slice(
      -80,
    )
  }

  return next
}

export function advanceDrive(
  state: FootballGameState,
  params: AdvanceParams,
  rng: () => number,
  homeRatings: TeamRatings = DEFAULT_HOME_RATINGS,
  awayRatings: TeamRatings = DEFAULT_AWAY_RATINGS,
): {
  next: FootballGameState
  resolution: PlayResolution
  /** Play call ids actually used for this snap (CPU picks included). */
  committedPlayIds: { offensePlayId: string; defenseCallId: string }
} {
  if (state.gameOver) {
    throw new Error('Cannot advance a finished game.')
  }
  if (state.sessionPhase !== 'play_calling') {
    throw new Error('Scrimmage plays are only allowed during play_calling phase.')
  }

  const offenseTeam = state.possession
  const defenseTeam = other(offenseTeam)

  let offensePlayId: string
  let defenseCallId: string

  if (offenseTeam === 'home') {
    if (!params.userOffensePlayId) {
      throw new Error('userOffensePlayId required when home has possession.')
    }
    offensePlayId = params.userOffensePlayId
    defenseCallId = pickOpponentDefenseCall(state, offensePlayId, rng)
  } else {
    if (!params.userDefenseCallId) {
      throw new Error('userDefenseCallId required when away has possession.')
    }
    offensePlayId = pickOpponentOffensePlay(state, rng)
    defenseCallId = params.userDefenseCallId
  }

  const offensivePlay = getOffensivePlay(offensePlayId)
  const defenseCall = getDefensiveCall(defenseCallId)
  if (!offensivePlay || !defenseCall) {
    throw new Error('Unknown play or defensive call id.')
  }

  const offenseRatings = offenseTeam === 'home' ? homeRatings : awayRatings
  const defenseRatings = defenseTeam === 'home' ? homeRatings : awayRatings

  const resolution = resolvePlay(
    offenseRatings,
    defenseRatings,
    offensivePlay,
    defenseCall,
    {
      yardLine: state.yardLine,
      down: state.down,
      yardsToGo: state.yardsToGo,
    },
    rng,
  )

  const next = applyResolvedPlay(state, resolution, rng)
  return {
    next,
    resolution,
    committedPlayIds: { offensePlayId, defenseCallId },
  }
}

/** Deterministic RNG factory for tests (mulberry32). */
export function createSeededRng(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
