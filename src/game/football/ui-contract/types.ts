/**
 * UI integration contract for the football sim.
 * Intended for consumption by this app or a separate UI package — keep stable semver-ish changes only.
 */

import type { GameSessionPhase, KickoffContext } from '../footballTypes'

/** Scoreboard / possession side. Aligns with engine `TeamId`. */
export type FootballTeamSide = 'home' | 'away'

export type {
  BallFieldState,
  PassTrajectory,
  PlayAnimationLegalActions,
  PlayAnimationPhase,
  PlayAnimationSnapshot,
  PlayTimelineStage,
  PlayerFieldPosition,
} from '../playAnimation/types'

export type { GameSessionPhase, KickoffContext }

/**
 * High-level lifecycle for routing screens, overlays, and input affordances.
 * Not every phase may be used in every build; UI should treat unknown future values gracefully.
 */
export type FootballGamePhase =
  | 'not_started'
  | 'in_progress'
  | 'awaiting_kickoff'
  | 'awaiting_offensive_play'
  | 'awaiting_defensive_call'
  | 'resolving_play'
  | 'between_plays'
  | 'quarter_break'
  | 'halftime'
  | 'final'
  | 'error'

/**
 * Serializable snapshot for HUD, banners, and accessibility announcements.
 * All display strings that are not here should be derived in the UI layer from this data.
 */
export type FootballGameViewState = {
  /** Contract version for forward compatibility. */
  schemaVersion: 1
  homeScore: number
  awayScore: number
  quarter: 1 | 2 | 3 | 4
  /** Remaining time in the current quarter, seconds (integer or fractional). */
  clockSeconds: number
  /** Configured quarter duration for this session (arcade pacing). */
  quarterLengthSeconds: number
  /** Supported values for settings UI (seconds). */
  quarterLengthOptions: readonly number[]
  possessionTeamId: FootballTeamSide
  /**
   * Team the human is coaching in integrated play (default `home` in `useFootballGame`).
   * UI may hide irrelevant pickers when possession does not match this side.
   */
  userTeamId: FootballTeamSide
  /** Engine session phase (pregame, kickoff, live, over). */
  sessionPhase: GameSessionPhase
  kickoffContext: KickoffContext
  /** Human franchise; null until team selection completes in full pregame flows. */
  userControlledTeam: FootballTeamSide | null
  /** Who kicked off Q1; drives halftime receiver. Null before opening kickoff is committed. */
  openingKickIsHome: boolean | null
  /** Offensive field position 1–99 from current offense’s perspective. */
  yardLine: number
  down: 1 | 2 | 3 | 4
  yardsToGo: number
  gameOver: boolean
  phase: FootballGamePhase
  /** Short line for result banner / live region; null when none yet. */
  lastResultSummary: string | null
  /** Newest-last entries for transcript widgets. */
  recentPlays: readonly string[]
  /** What inputs are meaningful for this tick (engine may disable during sim). */
  interaction: FootballGameInteractionHints
}

export type FootballGameInteractionHints = {
  canSelectOffensivePlay: boolean
  canSelectDefensiveCall: boolean
  canCommitPlay: boolean
}

/** Offensive play row for pickers (playbook UI). */
export type PlayOption = {
  id: string
  label: string
  category: 'run' | 'pass' | 'special'
  /** Optional grouping for accordions / filters. */
  group?: string
  /** If true, picker should disable the row (e.g. illegal situation). */
  disabled?: boolean
  /** Optional tooltip / subtitle. */
  description?: string
}

/** Defensive call row for pickers. */
export type DefensiveCallOption = {
  id: string
  label: string
  disabled?: boolean
  description?: string
}

/**
 * Imperative surface the UI calls. Implementations may sync React state, dispatch to a store, or POST to an API.
 * All methods should be safe to call from event handlers; async work is implementation-defined.
 */
export type FootballGameActions = {
  /** Start or restart a session from a pregame / idle screen. */
  startGame: () => void
  /** Reset to initial kickoff / drive state without reloading the page. */
  resetGame: () => void
  /** Highlighted offensive play when user commits (when user is on offense). */
  setSelectedOffensivePlayId: (playId: string) => void
  /** Highlighted defensive call when user commits (when user is on defense). */
  setSelectedDefensiveCallId: (callId: string) => void
  /** Advance one play using current selections + engine rules. */
  runPlay: () => void
  /** Begin animated snap (commits play/defense for this down; engine updates on `advanceResult`). */
  snap: () => void
  /** Advance ball + carrier one step toward the resolved gain (or exit `snap`). */
  moveBallCarrier: () => void
  /** Lateral shift while the ball is live. */
  juke: () => void
  /** Burst forward up to 3 yards toward the resolved line. */
  dive: () => void
  /** Cycle intended receiver on pass plays (deterministic order). */
  selectReceiver: () => void
  /** Apply resolved down (`tackleOrScore`) or dismiss result overlay (`result`). */
  advanceResult: () => void
  /** Lateral steer for user-controlled ball carrier while sim is live (-1 … 1). */
  setCarrierSteerInput: (steer: number) => void
  /** On pass plays, set the primary throw target by receiver player id (e.g. `home_wr1`). */
  setPassTargetReceiver: (receiverId: string) => void
}

/**
 * Full return shape for `useFootballGame` (or an equivalent store selector in non-React UIs).
 */
export type UseFootballGameResult = {
  state: FootballGameViewState
  /** Field / micro-phase data for motion layers (22 players, ball, legals). */
  playAnimation: import('../playAnimation/types').PlayAnimationSnapshot
  playOptions: readonly PlayOption[]
  defensiveCallOptions: readonly DefensiveCallOption[]
  /** Current picker highlights for controlled components. */
  selectedOffensivePlayId: string | null
  selectedDefensiveCallId: string | null
  actions: FootballGameActions
  /**
   * Provenance for debugging in multi-repo setups.
   * `stub` = `useFootballGameStub`; `live` = `useFootballGame` wired to Milestone 2 engine.
   */
  source: 'stub' | 'live'
}
