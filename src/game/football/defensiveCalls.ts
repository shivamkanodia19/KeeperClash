import type { DefensiveCall } from './footballTypes'
import { DEFENSIVE_PLAYBOOK } from './playbook/defensePlays'

export const DEFENSIVE_CALLS: DefensiveCall[] = DEFENSIVE_PLAYBOOK

const byId = new Map(DEFENSIVE_CALLS.map((d) => [d.id, d]))

export function getDefensiveCall(id: string): DefensiveCall | undefined {
  return byId.get(id)
}
