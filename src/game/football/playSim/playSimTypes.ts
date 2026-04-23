import type { TeamId } from '../footballTypes'

/** Skill / roster role for sim + HUD. */
export type PlayerSimRole =
  | 'QB'
  | 'RB'
  | 'WR'
  | 'TE'
  | 'OL'
  | 'DL'
  | 'LB'
  | 'CB'
  | 'S'
  | 'K'
  | 'KR'

/**
 * Per-player behavioral phase (subset prioritized for vertical slice).
 * Idle/celebrate reserved for future polish.
 */
export type PlayerSimPhase =
  | 'idle'
  | 'preSnapSet'
  | 'snapReact'
  | 'routeRun'
  | 'runBlock'
  | 'passBlock'
  | 'blockEngaged'
  | 'passRush'
  | 'coverageDrop'
  | 'manCoverage'
  | 'zoneCoverage'
  | 'pursueBall'
  | 'carryBall'
  | 'throwBall'
  | 'catchBall'
  | 'tackleAttempt'
  | 'tackled'
  | 'celebrate'

export type BallSimMode = 'snapped' | 'carried' | 'thrown' | 'loose' | 'dead'

export type SimWaypoint = { x: number; y: number }

export type SimPlayer = {
  id: string
  teamId: TeamId
  unit: 'offense' | 'defense'
  role: PlayerSimRole
  x: number
  y: number
  vx: number
  vy: number
  facingRad: number
  speed: number
  maxSpeed: number
  acceleration: number
  agility: number
  strength: number
  awareness: number
  assignment: string
  assignmentTargetId: string | null
  controlled: boolean
  actionCooldown: number
  tackleIntentTimer: number
  shedBoostTimer: number
  phase: PlayerSimPhase
  routeWaypoints: SimWaypoint[]
  routeIndex: number
  engagedWith: string | null
  engagedBy: string | null
  shedTimer: number
  /** Defender pursuit: last known carrier pos */
  pursuitTx: number
  pursuitTy: number
}

export type BallSimState = {
  mode: BallSimMode
  x: number
  y: number
  /** 0 = ground, 1 = apex of throw */
  z: number
  carrierId: string | null
  throwTargetId: string | null
  vx: number
  vy: number
  vz: number
  /** Sim time when catch window opens (ball near target) */
  catchWindowOpen: number | null
}

export type PassSimStage =
  | 'qbCarry'
  | 'inFlight'
  | 'received'
  | 'incomplete'
  | 'intercepted'
  | 'sacked'

export type PlayWorldInput = {
  /** -1 … 1 lateral intent for ball carrier (offense user). */
  carrierSteer: number
  /** -1 ... 1 downfield/backfield intent for active player. */
  moveX?: number
  /** -1 ... 1 sideline intent for active player. */
  moveY?: number
  activePlayerId?: string | null
}

export type PlayWorldSimulation = {
  offenseTeam: TeamId
  yardLineAtSnap: number
  signedTargetYards: number
  playId: string
  playCategory: 'run' | 'pass' | 'special'
  defenseCallId: string
  time: number
  players: SimPlayer[]
  ball: BallSimState
  /** When pass: stage of pass script */
  passStage: PassSimStage
  passTimer: number
  /** Target receiver id for throw / catch checks */
  primaryTargetId: string | null
  finished: boolean
  lastWhistleReason:
    | 'tackle'
    | 'score'
    | 'incomplete'
    | 'interception'
    | 'sack'
    | 'script_limit'
    | null
  /** Architecture: future user-controlled defender id */
  futureControllableDefenseId: string | null
}
