import type { OffensivePlay } from './footballTypes'
import { OFFENSIVE_PLAYBOOK } from './playbook/offensePlays'

export const OFFENSIVE_PLAYS: OffensivePlay[] = OFFENSIVE_PLAYBOOK

const byId = new Map(OFFENSIVE_PLAYS.map((p) => [p.id, p]))

export function getOffensivePlay(id: string): OffensivePlay | undefined {
  return byId.get(id)
}
