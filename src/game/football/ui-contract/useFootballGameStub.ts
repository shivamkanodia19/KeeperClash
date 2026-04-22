import type { FootballGameActions, UseFootballGameResult } from './types'

import {

  SAMPLE_DEFENSIVE_CALL_OPTIONS,

  SAMPLE_FOOTBALL_VIEW_STATE,

  SAMPLE_PLAY_ANIMATION,

  SAMPLE_PLAY_OPTIONS,

} from './sampleData'



const noop = (): void => {}



const stubActions: FootballGameActions = {

  startGame: noop,

  resetGame: noop,

  setSelectedOffensivePlayId: (playId: string) => {

    void playId

  },

  setSelectedDefensiveCallId: (callId: string) => {

    void callId

  },

  runPlay: noop,

  snap: noop,

  moveBallCarrier: noop,

  juke: noop,

  dive: noop,

  selectReceiver: noop,

  advanceResult: noop,

  setCarrierSteerInput: (steer: number) => {
    void steer
  },

  setMoveVector: (x: number, y: number) => {
    void x
    void y
  },

  switchPlayer: (target?: string | number) => {
    void target
  },

  primaryAction: noop,

  secondaryAction: noop,

  throwTo: (receiverId: string) => {
    void receiverId
  },

  setPassTargetReceiver: (receiverId: string) => {
    void receiverId
  },

}



const STUB_FOOTBALL_GAME_RESULT: UseFootballGameResult = {

  state: SAMPLE_FOOTBALL_VIEW_STATE,

  playAnimation: SAMPLE_PLAY_ANIMATION,

  playOptions: SAMPLE_PLAY_OPTIONS,

  defensiveCallOptions: SAMPLE_DEFENSIVE_CALL_OPTIONS,

  selectedOffensivePlayId: 'quick_slants',

  selectedDefensiveCallId: 'cover_2_zone',

  actions: stubActions,

  source: 'stub',

}



/** Mock hook for Storybook / UI-only repos without the engine bundle. */

export function useFootballGameStub(): UseFootballGameResult {

  return STUB_FOOTBALL_GAME_RESULT

}



export function getStubFootballGameResult(): UseFootballGameResult {

  return STUB_FOOTBALL_GAME_RESULT

}

