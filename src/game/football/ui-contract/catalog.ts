import { DEFENSIVE_CALLS } from '../defensiveCalls'
import { OFFENSIVE_PLAYS } from '../playDefinitions'
import type { DefensiveCallOption, PlayOption } from './types'

/** Stable offensive rows derived from engine definitions (no sim tuning fields exposed). */
export const FOOTBALL_PLAY_OPTIONS: readonly PlayOption[] = OFFENSIVE_PLAYS.map((p) => ({
  id: p.id,
  label: p.name,
  category: p.category,
  group:
    p.category === 'run' ? 'Run' : p.category === 'pass' ? 'Pass' : 'Special',
}))

/** Stable defensive rows derived from engine definitions. */
export const FOOTBALL_DEFENSIVE_CALL_OPTIONS: readonly DefensiveCallOption[] =
  DEFENSIVE_CALLS.map((d) => ({
    id: d.id,
    label: d.name,
  }))
