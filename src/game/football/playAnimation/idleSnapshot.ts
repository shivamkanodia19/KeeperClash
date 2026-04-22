import { deriveCameraRecommendation } from '../spatial/cameraContract'
import type { PlayAnimationSnapshot } from './types'

const idleLegal = {
  canSelectOffensivePlay: false,
  canSelectDefensiveCall: false,
  canSnap: false,
  canMoveBallCarrier: false,
  canJuke: false,
  canDive: false,
  canSelectReceiver: false,
  canAdvanceResult: false,
} as const

/** When there is no engine session yet. */
export function idlePlayAnimationSnapshot(): PlayAnimationSnapshot {
  const ball = { x: 25, y: 0, carrierId: null }
  return {
    schemaVersion: 1,
    phase: 'preSnap',
    timelineStage: 'preSnap',
    lineOfScrimmageAtSnap: 25,
    players: [],
    ball,
    ballCarrierId: null,
    passTrajectory: null,
    selectedOffensivePlayId: null,
    selectedDefensiveCallId: null,
    legal: idleLegal,
    preSnapPreview: null,
    playTimelineSegments: [],
    cameraRecommendation: deriveCameraRecommendation({
      phase: 'preSnap',
      lineOfScrimmageX: 25,
      ball,
      playProgress01: 0,
    }),
    playResultMarkers: [],
    selectedDefenderId: null,
    controllableDefenderCandidates: [],
    defensiveControlEnabled: false,
    activePlayerId: null,
    controllablePlayerIds: [],
    controlMode: 'none',
    inputHints: [],
  }
}
