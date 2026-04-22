import type {
  DefensiveCall,
  FootballGameState,
  OffensivePlay,
  PlayResolution,
  TeamRatings,
} from './footballTypes'

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function gaussianish(rng: () => number): number {
  let s = 0
  for (let i = 0; i < 8; i++) s += rng() - 0.5
  return s
}

function hasTag(play: OffensivePlay, tag: string): boolean {
  return play.tags.includes(tag)
}

/**
 * Combine explicit play-vs-call chart with defensive strengths vs concept tags.
 * No single call is globally optimal — charts rotate advantages.
 */
function matchupExecutionYards(play: OffensivePlay, d: DefensiveCall): number {
  const chart = play.matchupVsDefense[d.id] ?? 0
  let tag = 0
  if (hasTag(play, 'inside_zone') || hasTag(play, 'zone_run')) {
    tag -= d.strengthVsInsideRun * 0.14
  }
  if (hasTag(play, 'outside_zone')) tag -= d.strengthVsOutsideRun * 0.12
  if (hasTag(play, 'short_pass') || hasTag(play, 'quick_game')) {
    tag -= d.strengthVsShortPass * 0.11
  }
  if (hasTag(play, 'vertical') || hasTag(play, 'deep_pass')) {
    tag -= d.strengthVsDeepPass * 0.13
  }
  if (hasTag(play, 'screen')) tag -= d.strengthVsScreen * 0.12
  return chart + tag
}

function intChance(play: OffensivePlay, d: DefensiveCall, defense: TeamRatings): number {
  if (play.category !== 'pass') return 0
  const base =
    play.turnoverRisk +
    d.turnoverModifier +
    (defense.coverage - 48) * 0.0025 +
    d.pressureModifier * 0.02
  if (hasTag(play, 'deep_pass') || hasTag(play, 'vertical')) {
    return clamp(base + 0.02 + d.bigPlayRiskModifier * 0.08, 0, 0.35)
  }
  return clamp(base + d.bigPlayRiskModifier * 0.04, 0, 0.28)
}

function fumbleChance(play: OffensivePlay, d: DefensiveCall): number {
  if (play.category !== 'run') return 0
  return clamp(
    play.turnoverRisk + d.turnoverModifier * 0.5 + d.pressureModifier * 0.01,
    0,
    0.18,
  )
}

function sackChance(play: OffensivePlay, d: DefensiveCall, defense: TeamRatings): number {
  if (play.category !== 'pass') return 0
  const p = 0.06 + d.pressureModifier * 0.045 + (defense.passRush - 48) * 0.004
  return clamp(p, 0, 0.42)
}

function incompleteChance(play: OffensivePlay, d: DefensiveCall, defense: TeamRatings): number {
  if (play.category !== 'pass') return 0
  const p =
    0.18 +
    d.pressureModifier * 0.035 -
    d.shortPassModifier *
      (hasTag(play, 'short_pass') || hasTag(play, 'quick_game') ? 0.04 : 0.02) +
    (defense.passRush - 50) * 0.003
  if (hasTag(play, 'deep_pass') || hasTag(play, 'vertical')) {
    return clamp(p + 0.06 + d.bigPlayRiskModifier * 0.04, 0, 0.55)
  }
  return clamp(p, 0, 0.52)
}

export function resolvePlay(
  offenseRatings: TeamRatings,
  defenseRatings: TeamRatings,
  offensivePlay: OffensivePlay,
  defenseCall: DefensiveCall,
  state: Pick<FootballGameState, 'yardLine' | 'down' | 'yardsToGo'>,
  rng: () => number,
): PlayResolution {
  const { yardLine } = state

  if (offensivePlay.id === 'field_goal') {
    const distance = 100 - yardLine + 10
    const makeP = clamp(
      0.48 +
        offenseRatings.kicking * 0.007 -
        defenseRatings.passRush * 0.003 -
        distance * 0.009 +
        defenseCall.pressureModifier * 0.01,
      0.12,
      0.94,
    )
    const made = rng() < makeP
    return {
      outcome: made ? 'field_goal_made' : 'field_goal_miss',
      yardsGained: 0,
      clockUsed: offensivePlay.clockCostSeconds,
      commentary: made
        ? `Field goal good from ${distance} yards. (+3)`
        : `Field goal no good from ${distance} yards.`,
    }
  }

  if (offensivePlay.id === 'punt') {
    const net = Math.round(36 + rng() * 18)
    return {
      outcome: 'punt',
      yardsGained: 0,
      clockUsed: offensivePlay.clockCostSeconds,
      commentary: `Punt rolls for a net of ${net} yards.`,
      puntNetYards: net,
    }
  }

  const ratingDelta = (offenseRatings.offense - defenseRatings.defense) * 0.12

  if (offensivePlay.category === 'pass') {
    if (rng() < intChance(offensivePlay, defenseCall, defenseRatings)) {
      return {
        outcome: 'interception',
        yardsGained: 0,
        clockUsed: Math.max(6, offensivePlay.clockCostSeconds - 4),
        commentary: 'Pass intercepted.',
      }
    }
    if (rng() < sackChance(offensivePlay, defenseCall, defenseRatings)) {
      const loss = -Math.round(3 + rng() * 5 + defenseCall.pressureModifier * 0.8)
      return {
        outcome: 'sack',
        yardsGained: loss,
        clockUsed: offensivePlay.clockCostSeconds + 4,
        commentary: `Sack for ${loss} yards.`,
      }
    }
    if (rng() < incompleteChance(offensivePlay, defenseCall, defenseRatings)) {
      return {
        outcome: 'incomplete',
        yardsGained: 0,
        clockUsed: Math.max(5, offensivePlay.clockCostSeconds - 10),
        commentary: 'Pass incomplete.',
      }
    }
  } else if (offensivePlay.category === 'run') {
    if (rng() < fumbleChance(offensivePlay, defenseCall)) {
      return {
        outcome: 'fumble_lost',
        yardsGained: 0,
        clockUsed: offensivePlay.clockCostSeconds,
        commentary: 'Fumble — defense recovers.',
      }
    }
  }

  const matchup = matchupExecutionYards(offensivePlay, defenseCall)
  const big = rng() < clamp(offensivePlay.bigPlayChance + defenseCall.bigPlayRiskModifier * 0.12, 0, 0.45)
  const bigBonus = big ? Math.round(8 + rng() * 18) : 0
  const yardsFloat =
    offensivePlay.baseYards +
    gaussianish(rng) * offensivePlay.variance * 0.35 +
    ratingDelta +
    matchup +
    bigBonus
  let yardsGained = Math.round(yardsFloat)
  yardsGained = clamp(yardsGained, -12, 75)

  const newLine = yardLine + yardsGained
  if (newLine >= 100) {
    const tdYards = 100 - yardLine
    return {
      outcome: 'touchdown',
      yardsGained: tdYards,
      clockUsed: offensivePlay.clockCostSeconds,
      commentary: `Touchdown — ${tdYards} yard score.`,
    }
  }

  return {
    outcome: 'normal',
    yardsGained,
    clockUsed: offensivePlay.clockCostSeconds,
    commentary: `Play gains ${yardsGained} yards.`,
  }
}

export function getPuntNetYards(resolution: PlayResolution): number {
  if (resolution.outcome !== 'punt') return 0
  return resolution.puntNetYards ?? 42
}
