import type { FootballGameState, TeamId } from './footballTypes'
import { DEFENSE_PLAYBOOK_IDS } from './playbook/defenseIds'
import { getOffensivePlay } from './playDefinitions'

function scoreDiff(state: FootballGameState, forTeam: TeamId): number {
  return forTeam === 'home'
    ? state.homeScore - state.awayScore
    : state.awayScore - state.homeScore
}

function pickWeighted(
  rng: () => number,
  choices: readonly (readonly [string, number])[],
): string {
  const total = choices.reduce((s, [, w]) => s + w, 0)
  let r = rng() * total
  for (const [id, w] of choices) {
    r -= w
    if (r <= 0) return id
  }
  return choices[choices.length - 1]![0]
}

/** Opponent defense vs user's offensive play when user has possession (home offense). */
export function pickOpponentDefenseCall(
  state: FootballGameState,
  userOffensePlayId: string,
  rng: () => number,
): string {
  const play = getOffensivePlay(userOffensePlayId)
  const trailingLate =
    state.quarter >= 4 && scoreDiff(state, 'away') < 0 && state.possession === 'home'
  const leadingLate =
    state.quarter >= 4 && scoreDiff(state, 'away') > 0 && state.possession === 'home'

  if (!play) {
    return DEFENSE_PLAYBOOK_IDS[Math.floor(rng() * DEFENSE_PLAYBOOK_IDS.length)]!
  }

  if (play.category === 'run' || play.tags.includes('inside_zone')) {
    return pickWeighted(rng, [
      ['run_blitz', 2.1],
      ['goal_line', 1.6],
      ['nickel', 1.3],
      ['four_three_base', 1.0],
      ['cover_4_quarters', 1.1],
      ['cover_2_zone', 0.9],
      ['tampa_2', 0.7],
      ['prevent', trailingLate ? 0.6 : 0.15],
    ])
  }

  if (play.tags.includes('deep_pass') || play.tags.includes('vertical')) {
    return pickWeighted(rng, [
      ['cover_2_zone', 2],
      ['tampa_2', 1.7],
      ['prevent', trailingLate ? 2.2 : leadingLate ? 1.2 : 0.9],
      ['cover_4_quarters', 1.3],
      ['cover_3_sky', 1],
      ['cover_0_blitz', 0.85],
    ])
  }

  if (play.tags.includes('screen')) {
    return pickWeighted(rng, [
      ['cover_1_man', 1.4],
      ['nickel', 1.5],
      ['dime', 0.9],
      ['run_blitz', 1.2],
      ['cover_2_zone', 1],
      ['tampa_2', 1.1],
    ])
  }

  if (play.category === 'pass') {
    return pickWeighted(rng, [
      ['cover_3_sky', 1.5],
      ['nickel', 1.3],
      ['dime', 0.85],
      ['cover_1_man', 1.1],
      ['tampa_2', 1],
      ['cover_2_zone', 1],
      ['prevent', leadingLate ? 1.4 : 0.5],
    ])
  }

  return DEFENSE_PLAYBOOK_IDS[Math.floor(rng() * DEFENSE_PLAYBOOK_IDS.length)]!
}

const STANDARD_RUN_PASS = [
  'inside_zone',
  'outside_zone',
  'power_o',
  'quick_slants',
  'stick',
  'four_verticals',
  'flood',
  'mesh',
  'screen_pass',
  'play_action_crossers',
  'jet_sweep',
] as const

/** Opponent offense when user is defending (away possession). */
export function pickOpponentOffensePlay(
  state: FootballGameState,
  rng: () => number,
): string {
  const ytg = state.yardsToGo
  const yl = state.yardLine
  const down = state.down
  const trailing =
    state.quarter >= 4 && scoreDiff(state, 'home') < 0 && state.possession === 'away'
  const leading =
    state.quarter >= 4 && scoreDiff(state, 'home') > 0 && state.possession === 'away'

  if (down === 4) {
    if (yl >= 72 && rng() < 0.55) return 'field_goal'
    if (yl < 45 && rng() < 0.82) return 'punt'
    if (ytg <= 2 && rng() < 0.65) return 'power_o'
    if (rng() < 0.35) return 'four_verticals'
    return 'stick'
  }

  if (ytg <= 3 && rng() < 0.55) return 'inside_zone'
  if (ytg >= 10 && rng() < 0.45) return trailing ? 'four_verticals' : 'mesh'
  if (leading && rng() < 0.5) return 'inside_zone'
  if (rng() < 0.28) return 'outside_zone'
  if (rng() < 0.52) return 'quick_slants'
  if (rng() < 0.72) return 'play_action_crossers'
  if (rng() < 0.88) return 'stick'
  return STANDARD_RUN_PASS[Math.floor(rng() * STANDARD_RUN_PASS.length)]!
}
