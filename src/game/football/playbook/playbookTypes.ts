/**
 * Rich football playbook metadata (concepts, assignments, matchup hints).
 * Resolver uses numeric fields on OffensivePlay/DefensiveCall plus matchupVsDefense maps.
 */

export type PlayTag =
  | 'run'
  | 'pass'
  | 'play_action'
  | 'screen'
  | 'trick'
  | 'inside_zone'
  | 'outside_zone'
  | 'gap'
  | 'vertical'
  | 'quick_game'
  | 'movement'

export type QbAction = 'under_center_3_step' | 'shotgun_quick' | 'shotgun_5_step' | 'play_fake' | 'turn_back'

export type RouteDef = {
  playerRole: string
  concept: string
  breakYards: number
  stem: string
}

export type BlockingScheme =
  | 'zone'
  | 'gap'
  | 'man'
  | 'slide'
  | 'max_protect'
  | 'screen'
  | 'play_action'

export type OffensivePlayConcept = {
  formation: string
  personnel: string
  alignment: string
  assignments: string
  routes: RouteDef[]
  qbDrop: QbAction
  rbPath: string
  blockingScheme: BlockingScheme
  timingWindows: string
  progression: string
  strengthsVsShells: string
}

export type DefensiveShell = 'cover0' | 'cover1' | 'cover2' | 'cover3' | 'cover4' | 'tampa2' | 'goal_line'

export type DefensiveCallConcept = {
  front: string
  coverageShell: string
  pressure: string
  runFits: string
  responsibilities: string
  matchupNotes: string
}
