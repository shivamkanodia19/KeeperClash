/**
 * Football UI integration contract — types, catalogs, view mapper, live hook, stub hook.
 * UI layers should import from here and avoid `../playResolver` or `../footballState` directly.
 */

/** Bump only on breaking UI-contract changes. */
export const FOOTBALL_UI_CONTRACT_VERSION = '1.0.0' as const

export type {
  BallFieldState,
  DefensiveCallOption,
  FootballGameActions,
  FootballGameInteractionHints,
  FootballGamePhase,
  FootballGameViewState,
  FootballTeamSide,
  GameSessionPhase,
  KickoffContext,
  PassTrajectory,
  PlayAnimationLegalActions,
  PlayAnimationPhase,
  PlayAnimationSnapshot,
  PlayTimelineStage,
  PlayerFieldPosition,
  PlayOption,
  UseFootballGameResult,
} from './types'

export {
  FOOTBALL_DEFENSIVE_CALL_OPTIONS,
  FOOTBALL_PLAY_OPTIONS,
} from './catalog'

export { toFootballGameViewState } from './viewState'
export type { FootballViewStateMeta } from './viewState'

export {
  SAMPLE_DEFENSIVE_CALL_OPTIONS,
  SAMPLE_FOOTBALL_VIEW_STATE,
  SAMPLE_PLAY_ANIMATION,
  SAMPLE_PLAY_OPTIONS,
} from './sampleData'

export { useFootballGame } from './useFootballGame'
export type { UseFootballGameOptions } from './useFootballGame'

export {
  getStubFootballGameResult,
  useFootballGameStub,
} from './useFootballGameStub'

export type { FootballUiAdapter, FootballUiAdapterSource } from './adapter'
export { useFootballGameAdapter } from './adapter'
