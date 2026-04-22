/** Canonical defensive call ids for matchup maps and AI */
export const DEFENSE_PLAYBOOK_IDS = [
  'four_three_base',
  'nickel',
  'dime',
  'goal_line',
  'cover_2_zone',
  'cover_3_sky',
  'cover_4_quarters',
  'cover_1_man',
  'cover_0_blitz',
  'tampa_2',
  'run_blitz',
  'prevent',
] as const

export type DefensePlaybookId = (typeof DEFENSE_PLAYBOOK_IDS)[number]
