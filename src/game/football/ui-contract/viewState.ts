import type { FootballGameState } from '../footballTypes'
import {
  DEFAULT_PLAY_CLOCK_SECONDS,
  DEFAULT_QUARTER_LENGTH_SECONDS,
  QUARTER_LENGTH_OPTIONS,
} from '../footballTypes'
import type { PlayAnimationPhase } from '../playAnimation/types'
import type {
  FootballGamePhase,
  FootballGameViewState,
  FootballTeamSide,
} from './types'

export type FootballViewStateMeta = {
  userTeamId: FootballTeamSide
  /** Whether `startGame` has been called at least once (engine snapshot exists). */
  hasSession: boolean
  /** Last resolver commentary line for HUD; UI must not depend on outcome enums. */
  lastPlaySummary: string | null
  /**
   * Micro-phase from the animation layer; when set between snap and tackle, scoreboard `runPlay` should stay disabled.
   */
  playAnimationPhase: PlayAnimationPhase | null
}

function derivePhase(
  engine: FootballGameState,
  hasSession: boolean,
  userTeamId: FootballTeamSide,
): FootballGamePhase {
  if (!hasSession) return 'not_started'
  if (engine.gameOver) return 'final'
  if (engine.sessionPhase === 'team_selection') return 'not_started'
  if (engine.sessionPhase === 'kickoff') return 'awaiting_kickoff'
  if (engine.sessionPhase === 'game_over') return 'final'
  const userOnOffense = engine.possession === userTeamId
  if (userOnOffense) return 'awaiting_offensive_play'
  return 'awaiting_defensive_call'
}

function deriveInteraction(
  engine: FootballGameState,
  hasSession: boolean,
  userTeamId: FootballTeamSide,
  playAnimationPhase: PlayAnimationPhase | null,
): FootballGameViewState['interaction'] {
  if (!hasSession || engine.gameOver) {
    return {
      canSelectOffensivePlay: false,
      canSelectDefensiveCall: false,
      canCommitPlay: false,
    }
  }
  if (engine.sessionPhase !== 'play_calling') {
    return {
      canSelectOffensivePlay: false,
      canSelectDefensiveCall: false,
      canCommitPlay: false,
    }
  }
  const pickOnlyPreSnap = playAnimationPhase === 'preSnap'
  const instantPlayLocked =
    playAnimationPhase != null && playAnimationPhase !== 'preSnap'
  const userOnOffense = engine.possession === userTeamId
  return {
    canSelectOffensivePlay: userOnOffense && pickOnlyPreSnap,
    canSelectDefensiveCall: !userOnOffense && pickOnlyPreSnap,
    canCommitPlay: !instantPlayLocked,
  }
}

/**
 * Maps Milestone 2 engine state to the UI contract. Keeps resolver types and play tuning off the wire.
 */
export function toFootballGameViewState(
  engine: FootballGameState | null,
  meta: FootballViewStateMeta,
): FootballGameViewState {
  if (!meta.hasSession || engine === null) {
    return {
      schemaVersion: 1,
      homeScore: 0,
      awayScore: 0,
      quarter: 1,
      clockSeconds: 0,
      clockRunning: false,
      playClockSeconds: DEFAULT_PLAY_CLOCK_SECONDS,
      clockMode: 'stopped',
      lastClockEvent: null,
      quarterLengthSeconds: DEFAULT_QUARTER_LENGTH_SECONDS,
      quarterLengthOptions: [...QUARTER_LENGTH_OPTIONS],
      possessionTeamId: 'home',
      userTeamId: meta.userTeamId,
      sessionPhase: 'team_selection',
      kickoffContext: 'none',
      userControlledTeam: null,
      openingKickIsHome: null,
      yardLine: 25,
      down: 1,
      yardsToGo: 10,
      gameOver: false,
      phase: 'not_started',
      lastResultSummary: null,
      recentPlays: [],
      interaction: {
        canSelectOffensivePlay: false,
        canSelectDefensiveCall: false,
        canCommitPlay: false,
      },
    }
  }

  return {
    schemaVersion: 1,
    homeScore: engine.homeScore,
    awayScore: engine.awayScore,
    quarter: engine.quarter,
    clockSeconds: engine.clockSeconds,
    clockRunning: engine.clockRunning,
    playClockSeconds: engine.playClockSeconds,
    clockMode: engine.clockMode,
    lastClockEvent: engine.lastClockEvent,
    quarterLengthSeconds: engine.quarterLengthSeconds,
    quarterLengthOptions: [...QUARTER_LENGTH_OPTIONS],
    possessionTeamId: engine.possession,
    userTeamId: meta.userTeamId,
    sessionPhase: engine.sessionPhase,
    kickoffContext: engine.kickoffContext,
    userControlledTeam: engine.userControlledTeam,
    openingKickIsHome: engine.openingKickIsHome,
    yardLine: engine.yardLine,
    down: engine.down,
    yardsToGo: engine.yardsToGo,
    gameOver: engine.gameOver,
    phase: derivePhase(engine, meta.hasSession, meta.userTeamId),
    lastResultSummary: meta.lastPlaySummary,
    recentPlays: engine.playLog,
    interaction: deriveInteraction(
      engine,
      meta.hasSession,
      meta.userTeamId,
      meta.playAnimationPhase,
    ),
  }
}
