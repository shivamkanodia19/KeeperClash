import type { TeamId } from '../footballTypes'
import type { BallSimMode, PlayerSimPhase, PlayerSimRole } from '../playSim/playSimTypes'
import type {
  CameraRecommendation,
  PlayResultMarker,
  PlayTimelineSegment,
} from '../spatial/geometryTypes'
import type { PreSnapPreviewPayload } from '../spatial/preSnapPreview'

/**
 * Micro phases for animated play UI (distinct from scoreboard `FootballGamePhase`).
 * Linear-ish flow: preSnap → snap → playInProgress → tackleOrScore → result → preSnap.
 */
export type PlayAnimationPhase =
  | 'preSnap'
  | 'snap'
  | 'playInProgress'
  | 'tackleOrScore'
  | 'result'

/**
 * Higher-level timeline for film / debug HUD (maps 1:1-ish to design spec).
 */
export type PlayTimelineStage =
  | 'preSnap'
  | 'snap'
  | 'routesBlocking'
  | 'ballMovement'
  | 'tackleScoreTurnover'
  | 'result'

export type PlayerFieldPosition = {
  id: string
  teamId: TeamId
  /** Offense = team that snapped; defense = opponent at snap. */
  unit: 'offense' | 'defense'
  /** Yards from offense’s own goal line toward opponent (float for smooth animation). */
  x: number
  /** Lateral offset (yards), offense facing “up” field. */
  y: number
  /** Derived motion hints for film / HUD (yards/sec-ish). */
  vx?: number
  vy?: number
  /** 0° = downfield (+x). */
  facingDeg?: number
  /** Populated when play-world sim is active. */
  role?: PlayerSimRole
  simPhase?: PlayerSimPhase
}

export type BallFieldState = {
  x: number
  y: number
  /** Player id holding the ball, or null if loose (not used in v1). */
  carrierId: string | null
  /** Ball lifecycle when sim layer is active. */
  mode?: BallSimMode
  throwTargetId?: string | null
  /** Pass arc height (0 = ground) for rendering. */
  z?: number
}

/** Simple arc for pass visualization (field coordinates). */
export type PassTrajectory = {
  fromX: number
  fromY: number
  toX: number
  toY: number
  peakY: number
}

/** What the animation layer allows this tick (game logic, not button styling). */
export type PlayAnimationLegalActions = {
  canSelectOffensivePlay: boolean
  canSelectDefensiveCall: boolean
  canSnap: boolean
  canMoveBallCarrier: boolean
  canJuke: boolean
  canDive: boolean
  canSelectReceiver: boolean
  canAdvanceResult: boolean
}

/**
 * Serializable snapshot for renderers / motion layers.
 * Selection ids mirror hook state for a single read surface.
 */
export type PlayAnimationSnapshot = {
  schemaVersion: 1
  phase: PlayAnimationPhase
  /** Normalized timeline label for contracts / analytics. */
  timelineStage: PlayTimelineStage
  /** Yard line from offense’s own goal at the snap (for LOS marker). */
  lineOfScrimmageAtSnap: number
  players: readonly PlayerFieldPosition[]
  ball: BallFieldState
  /** Redundant with `ball.carrierId` for UI contract consumers. */
  ballCarrierId: string | null
  /** Populated on pass concepts while the ball is live in the secondary. */
  passTrajectory: PassTrajectory | null
  selectedOffensivePlayId: string | null
  selectedDefensiveCallId: string | null
  legal: PlayAnimationLegalActions
  /** Non-null during `preSnap` + live play-calling; UI draws routes/shells. */
  preSnapPreview: PreSnapPreviewPayload | null
  /** Deterministic animation segments (22 + ball). */
  playTimelineSegments: readonly PlayTimelineSegment[]
  cameraRecommendation: CameraRecommendation
  playResultMarkers: readonly PlayResultMarker[]
  selectedDefenderId: string | null
  controllableDefenderCandidates: readonly string[]
  /** Future: user steers a defender post-snap. */
  defensiveControlEnabled: boolean
  activePlayerId: string | null
  controllablePlayerIds: readonly string[]
  controlMode: 'none' | 'offense' | 'defense_preview'
  inputHints: readonly string[]
}
