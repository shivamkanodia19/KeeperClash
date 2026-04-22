import type { OffensiveFormationId } from '../footballTypes'
import type { Vec2 } from './geometryTypes'

/** Relative to LOS (x=0 at LOS, negative = backfield toward own goal). */
export type FormationSlot = { key: string; rel: Vec2 }

export const OFFENSIVE_FORMATIONS: Record<OffensiveFormationId, FormationSlot[]> = {
  shotgun_doubles: [
    { key: 'qb', rel: { x: -4.5, y: 0 } },
    { key: 'rb', rel: { x: -6.5, y: 3 } },
    { key: 'c', rel: { x: -0.5, y: 0 } },
    { key: 'ol1', rel: { x: -0.4, y: -6 } },
    { key: 'ol2', rel: { x: -0.4, y: -3.6 } },
    { key: 'ol3', rel: { x: -0.4, y: -1.2 } },
    { key: 'ol4', rel: { x: -0.4, y: 1.2 } },
    { key: 'ol5', rel: { x: -0.4, y: 3.6 } },
    { key: 'wr1', rel: { x: 0.5, y: -16 } },
    { key: 'wr2', rel: { x: 0.5, y: 16 } },
    { key: 'te', rel: { x: -0.5, y: 10 } },
    { key: 'slot', rel: { x: 0.8, y: -6 } },
  ],
  shotgun_trips: [
    { key: 'qb', rel: { x: -4.5, y: 0 } },
    { key: 'rb', rel: { x: -6.2, y: -4 } },
    { key: 'c', rel: { x: -0.5, y: 0 } },
    { key: 'ol1', rel: { x: -0.4, y: -6 } },
    { key: 'ol2', rel: { x: -0.4, y: -3.6 } },
    { key: 'ol3', rel: { x: -0.4, y: -1.2 } },
    { key: 'ol4', rel: { x: -0.4, y: 1.2 } },
    { key: 'ol5', rel: { x: -0.4, y: 3.6 } },
    { key: 'wr1', rel: { x: 0.5, y: -18 } },
    { key: 'wr2', rel: { x: 0.5, y: -8 } },
    { key: 'wr3', rel: { x: 0.5, y: 8 } },
    { key: 'te', rel: { x: -0.5, y: 14 } },
  ],
  singleback_ace: [
    { key: 'qb', rel: { x: -3.5, y: 0 } },
    { key: 'rb', rel: { x: -6.5, y: 0 } },
    { key: 'c', rel: { x: -0.5, y: 0 } },
    { key: 'ol1', rel: { x: -0.4, y: -6 } },
    { key: 'ol2', rel: { x: -0.4, y: -3.6 } },
    { key: 'ol3', rel: { x: -0.4, y: -1.2 } },
    { key: 'ol4', rel: { x: -0.4, y: 1.2 } },
    { key: 'ol5', rel: { x: -0.4, y: 3.6 } },
    { key: 'wr1', rel: { x: 1, y: -18 } },
    { key: 'wr2', rel: { x: 1, y: 18 } },
    { key: 'wr3', rel: { x: 1.2, y: 0 } },
    { key: 'te', rel: { x: -0.5, y: 10 } },
  ],
  i_form: [
    { key: 'qb', rel: { x: -3.5, y: 0 } },
    { key: 'fb', rel: { x: -5.5, y: 0 } },
    { key: 'rb', rel: { x: -7.5, y: 0 } },
    { key: 'c', rel: { x: -0.5, y: 0 } },
    { key: 'ol1', rel: { x: -0.4, y: -6 } },
    { key: 'ol2', rel: { x: -0.4, y: -3.6 } },
    { key: 'ol3', rel: { x: -0.4, y: -1.2 } },
    { key: 'ol4', rel: { x: -0.4, y: 1.2 } },
    { key: 'ol5', rel: { x: -0.4, y: 3.6 } },
    { key: 'wr1', rel: { x: 0.5, y: -18 } },
    { key: 'wr2', rel: { x: 0.5, y: 18 } },
    { key: 'te', rel: { x: -0.5, y: 10 } },
  ],
  goal_line: [
    { key: 'qb', rel: { x: -2.5, y: 0 } },
    { key: 'rb', rel: { x: -5.5, y: 0 } },
    { key: 'c', rel: { x: -0.5, y: 0 } },
    { key: 'ol1', rel: { x: -0.2, y: -5 } },
    { key: 'ol2', rel: { x: -0.2, y: -3 } },
    { key: 'ol3', rel: { x: -0.2, y: -1 } },
    { key: 'ol4', rel: { x: -0.2, y: 1 } },
    { key: 'ol5', rel: { x: -0.2, y: 3 } },
    { key: 'ol6', rel: { x: -0.2, y: 5 } },
    { key: 'te1', rel: { x: -0.5, y: 8 } },
    { key: 'te2', rel: { x: -0.5, y: -8 } },
  ],
}

export function slotsForFormation(fid: OffensiveFormationId): FormationSlot[] {
  return OFFENSIVE_FORMATIONS[fid] ?? OFFENSIVE_FORMATIONS.shotgun_doubles
}
