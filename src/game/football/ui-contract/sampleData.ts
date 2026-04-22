import { deriveCameraRecommendation } from '../spatial/cameraContract'
import { layoutPlayersAtLos } from '../playAnimation/layout'
import type {
  DefensiveCallOption,
  FootballGameViewState,
  PlayAnimationSnapshot,
  PlayOption,
} from './types'

/** Static offensive rows for Storybook / stub hook (aligns with engine play ids when integrated). */
export const SAMPLE_PLAY_OPTIONS: readonly PlayOption[] = [
  {
    id: 'inside_run',
    label: 'Inside Run',
    category: 'run',
    group: 'Run',
    description: 'North-south; lower variance.',
  },
  {
    id: 'outside_run',
    label: 'Outside Run',
    category: 'run',
    group: 'Run',
  },
  {
    id: 'short_pass',
    label: 'Short Pass',
    category: 'pass',
    group: 'Pass',
  },
  {
    id: 'medium_pass',
    label: 'Medium Pass',
    category: 'pass',
    group: 'Pass',
  },
  {
    id: 'deep_pass',
    label: 'Deep Pass',
    category: 'pass',
    group: 'Pass',
  },
  {
    id: 'play_action',
    label: 'Play Action',
    category: 'pass',
    group: 'Pass',
  },
  {
    id: 'field_goal',
    label: 'Field Goal',
    category: 'special',
    group: 'Special',
  },
  {
    id: 'punt',
    label: 'Punt',
    category: 'special',
    group: 'Special',
  },
]

export const SAMPLE_DEFENSIVE_CALL_OPTIONS: readonly DefensiveCallOption[] = [
  { id: 'base', label: 'Base Defense', description: 'Balanced default.' },
  { id: 'run_focus', label: 'Run Focus' },
  { id: 'man', label: 'Man Coverage' },
  { id: 'zone', label: 'Zone Coverage' },
  { id: 'blitz', label: 'Blitz' },
  { id: 'prevent', label: 'Prevent' },
]

export const SAMPLE_FOOTBALL_VIEW_STATE: FootballGameViewState = {
  schemaVersion: 1,
  homeScore: 7,
  awayScore: 3,
  quarter: 2,
  clockSeconds: 78,
  clockRunning: true,
  playClockSeconds: 18,
  clockMode: 'pre_snap_running',
  lastClockEvent: 'Clock running after in-bounds play.',
  quarterLengthSeconds: 120,
  quarterLengthOptions: [60, 120, 180, 300],
  possessionTeamId: 'home',
  userTeamId: 'home',
  sessionPhase: 'play_calling',
  kickoffContext: 'none',
  userControlledTeam: 'home',
  openingKickIsHome: true,
  yardLine: 42,
  down: 2,
  yardsToGo: 6,
  gameOver: false,
  phase: 'awaiting_offensive_play',
  lastResultSummary: 'Short pass complete for 7 yards.',
  recentPlays: [
    'Kickoff: Home receives at own 25.',
    'Inside run for 3 yards.',
    'Short pass complete for 7 yards.',
  ],
  interaction: {
    canSelectOffensivePlay: true,
    canSelectDefensiveCall: false,
    canCommitPlay: true,
  },
}

const stubLayout = layoutPlayersAtLos('home', 25)
const stubBall = stubLayout.ball

/** Stub field snapshot (22 players + ball) for Storybook / `useFootballGameStub`. */
export const SAMPLE_PLAY_ANIMATION: PlayAnimationSnapshot = {
  schemaVersion: 1,
  phase: 'preSnap',
  timelineStage: 'preSnap',
  lineOfScrimmageAtSnap: 25,
  players: stubLayout.players,
  ball: stubLayout.ball,
  ballCarrierId: stubLayout.ball.carrierId,
  passTrajectory: null,
  selectedOffensivePlayId: 'quick_slants',
  selectedDefensiveCallId: 'cover_2_zone',
  legal: {
    canSelectOffensivePlay: true,
    canSelectDefensiveCall: false,
    canSnap: true,
    canMoveBallCarrier: false,
    canJuke: false,
    canDive: false,
    canSelectReceiver: false,
    canAdvanceResult: false,
  },
  preSnapPreview: null,
  playTimelineSegments: [],
  cameraRecommendation: deriveCameraRecommendation({
    phase: 'preSnap',
    lineOfScrimmageX: 25,
    ball: stubBall,
    playProgress01: 0,
  }),
  playResultMarkers: [],
  selectedDefenderId: null,
  controllableDefenderCandidates: stubLayout.players
    .filter((p) => p.unit === 'defense')
    .map((p) => p.id)
    .slice(0, 4),
  defensiveControlEnabled: false,
  activePlayerId: null,
  controllablePlayerIds: [],
  controlMode: 'none',
  inputHints: [],
}
