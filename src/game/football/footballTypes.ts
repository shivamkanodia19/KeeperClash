export type TeamId = 'home' | 'away'

export type Quarter = 1 | 2 | 3 | 4

export type Down = 1 | 2 | 3 | 4

export type PlayCategory = 'run' | 'pass' | 'special'

/** Canonical offensive formation ids (alignments + play art). */
export type OffensiveFormationId =
  | 'shotgun_doubles'
  | 'shotgun_trips'
  | 'singleback_ace'
  | 'i_form'
  | 'goal_line'

/** Yard line from offense's perspective: 1 = own end, 50 = midfield, 99 = opponent goal line. */
export type OffensivePlay = {
  id: string
  name: string
  category: PlayCategory
  baseYards: number
  variance: number
  turnoverRisk: number
  bigPlayChance: number
  clockCostSeconds: number
  /** Concept tags (run, pass, screen, verticals, …) for resolver + UI */
  tags: readonly string[]
  /**
   * Per–defensive-call yard expectation shift (before RNG). Keys = defensive play ids.
   * No call should dominate every concept — values typically in roughly [-2, 2].
   */
  matchupVsDefense: Partial<Record<string, number>>
  /** Formation shell for alignments + preview geometry. */
  formationId: OffensiveFormationId
  /** Human-readable personnel (e.g. "11", "12"). */
  personnel: string
}

export type DefensiveCall = {
  id: string
  name: string
  runModifier: number
  shortPassModifier: number
  deepPassModifier: number
  pressureModifier: number
  turnoverModifier: number
  bigPlayRiskModifier: number
  /** Rough strengths for tag-based counters (not binary optimal). */
  strengthVsInsideRun: number
  strengthVsOutsideRun: number
  strengthVsShortPass: number
  strengthVsDeepPass: number
  strengthVsScreen: number
  /** Visual / scouting labels (4-3 Under, Cover 2, …). */
  frontLabel: string
  shellLabel: string
  /**
   * Keys into `defensiveVisualTemplates` for 11-man spots, shells, blitz arrows, etc.
   */
  visualTemplateId: string
}

export type TeamRatings = {
  offense: number
  defense: number
  rushing: number
  passing: number
  passRush: number
  coverage: number
  kicking: number
}

export type PlayOutcome =
  | 'normal'
  | 'touchdown'
  | 'field_goal_made'
  | 'field_goal_miss'
  | 'punt'
  | 'interception'
  | 'fumble_lost'
  | 'turnover_on_downs'
  | 'sack'
  | 'incomplete'

export type PlayResolution = {
  outcome: PlayOutcome
  /** Net yards toward opponent goal for the offense that snapped the ball. */
  yardsGained: number
  clockUsed: number
  commentary: string
  /** Set when outcome is `punt`: distance toward opponent goal from previous LOS. */
  puntNetYards?: number
  /** Set on live turnovers: spot from the snapping offense's field perspective. */
  turnoverYardLine?: number
}

export type GameSessionPhase =
  | 'team_selection'
  | 'kickoff'
  | 'play_calling'
  | 'game_over'

export type KickoffContext = 'none' | 'opening' | 'halftime' | 'after_score'

export type GameClockMode =
  | 'stopped'
  | 'pre_snap_running'
  | 'pre_snap_stopped'
  | 'live'

export type FootballGameState = {
  homeScore: number
  awayScore: number
  quarter: Quarter
  clockSeconds: number
  /** True when the game clock should drain from elapsed frame time. */
  clockRunning: boolean
  /** Real-time ready-for-play clock; drains before the snap. */
  playClockSeconds: number
  clockMode: GameClockMode
  lastClockEvent: string | null
  /** Arcade quarter length (60 / 120 / 180 / 300). */
  quarterLengthSeconds: number
  possession: TeamId
  yardLine: number
  down: Down
  yardsToGo: number
  gameOver: boolean
  playLog: string[]
  /** Human-controlled franchise side; null until team selection completes */
  userControlledTeam: TeamId | null
  sessionPhase: GameSessionPhase
  kickoffContext: KickoffContext
  /** Receives the pending kickoff (opening/halftime); null when not applicable */
  kickoffReceivingTeam: TeamId | null
  /** Opening kick: who kicked off Q1 (other team receives Q3 halftime kick) */
  openingKickIsHome: boolean | null
}

/** Default arcade pacing: 2 minutes. */
export const DEFAULT_QUARTER_LENGTH_SECONDS = 120

export const DEFAULT_PLAY_CLOCK_SECONDS = 25

/** Supported quarter lengths (seconds). */
export const QUARTER_LENGTH_OPTIONS = [60, 120, 180, 300] as const

export type QuarterLengthOption = (typeof QUARTER_LENGTH_OPTIONS)[number]

/** @deprecated Use `DEFAULT_QUARTER_LENGTH_SECONDS` or `state.quarterLengthSeconds`. */
export const QUARTER_LENGTH_SECONDS = DEFAULT_QUARTER_LENGTH_SECONDS

export const DEFAULT_HOME_RATINGS: TeamRatings = {
  offense: 52,
  defense: 50,
  rushing: 52,
  passing: 51,
  passRush: 49,
  coverage: 50,
  kicking: 54,
}

export const DEFAULT_AWAY_RATINGS: TeamRatings = {
  offense: 50,
  defense: 51,
  rushing: 49,
  passing: 52,
  passRush: 52,
  coverage: 51,
  kicking: 50,
}

export function isQuarterLengthOption(n: number): n is QuarterLengthOption {
  return (QUARTER_LENGTH_OPTIONS as readonly number[]).includes(n)
}
