import type { OffensiveFormationId, TeamId } from '../footballTypes'
import { getOffensivePlay } from '../playDefinitions'
import { OFFENSIVE_PLAY_CONCEPTS } from '../playbook/offenseConcepts'
import { getDefensiveVisualTemplate } from '../spatial/defensiveVisuals'
import { slotsForFormation } from '../spatial/offensiveFormations'
import type { BallFieldState } from './types'
import type { PlayerFieldPosition } from './types'

function offId(team: TeamId, role: string): string {
  return `${team}_${role}`
}

/**
 * 11-on-11 layout from formation catalog + defensive visual template.
 * Coordinates: x = yards from offense’s own goal; y = lateral spread.
 */
export function layoutPlayersAtLos(
  offenseTeam: TeamId,
  yardLine: number,
  offenseFormationId: OffensiveFormationId = 'shotgun_doubles',
  defenseVisualTemplateId: string = 'four_three_base',
): { players: PlayerFieldPosition[]; ball: BallFieldState } {
  const defenseTeam: TeamId = offenseTeam === 'home' ? 'away' : 'home'
  const los = yardLine

  const offenseSlots = slotsForFormation(offenseFormationId)
  const offense: PlayerFieldPosition[] = offenseSlots.map((s) => ({
    id: offId(offenseTeam, s.key),
    teamId: offenseTeam,
    unit: 'offense',
    x: los + s.rel.x,
    y: s.rel.y,
  }))

  const tmpl = getDefensiveVisualTemplate(defenseVisualTemplateId)
  const defense: PlayerFieldPosition[] = tmpl.defenderSlots.map((s) => ({
    id: offId(defenseTeam, s.key),
    teamId: defenseTeam,
    unit: 'defense',
    x: los + s.rel.x,
    y: s.rel.y,
  }))

  const qbSlot = offenseSlots.find((x) => x.key === 'qb')
  const qbRel = qbSlot?.rel ?? { x: -3.5, y: 0 }
  const qbId = offId(offenseTeam, 'qb')
  const ball: BallFieldState = {
    x: los + qbRel.x,
    y: qbRel.y,
    carrierId: qbId,
  }

  return { players: [...offense, ...defense], ball }
}

export function qbIdForTeam(team: TeamId): string {
  return offId(team, 'qb')
}

function defaultReceiverSlot(key: string): boolean {
  return /^(wr|slot|te)/.test(key)
}

function routeRoleMatchesSlot(routeRole: string, slotKey: string): boolean {
  const role = routeRole.toLowerCase().replace(/\s+/g, '')
  if (role === 'rb' || role.includes('back')) return slotKey === 'rb'
  if (role === 'fb') return slotKey === 'fb'
  if (role === 'y' || role.includes('te')) return slotKey.startsWith('te')
  if (role.includes('slot')) return slotKey.startsWith('slot')
  if (role === 'x') return slotKey === 'wr1'
  if (role === 'z') return slotKey === 'wr2' || slotKey === 'wr3'
  if (role.includes('allwr') || role.includes('wr')) {
    return slotKey.startsWith('wr') || slotKey.startsWith('slot')
  }
  return defaultReceiverSlot(slotKey)
}

export function passReceiverIds(
  offenseTeam: TeamId,
  formationId: OffensiveFormationId,
  playId?: string | null,
): readonly string[] {
  const slots = slotsForFormation(formationId)
  const routes = playId ? (OFFENSIVE_PLAY_CONCEPTS[playId]?.routes ?? []) : []
  const routed = routes.length
    ? slots.filter((s) => routes.some((route) => routeRoleMatchesSlot(route.playerRole, s.key)))
    : []
  const receiverSlots = routed.length ? routed : slots.filter((s) => defaultReceiverSlot(s.key))
  return receiverSlots.map((s) => offId(offenseTeam, s.key))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Projected end-of-play positions for smooth interpolation (not full physics).
 */
export function projectRouteEndpoints(
  players: PlayerFieldPosition[],
  offensePlayId: string,
  signedTargetYards: number,
): PlayerFieldPosition[] {
  const play = getOffensivePlay(offensePlayId)
  const runish = play?.category === 'run'
  const push =
    Math.sign(signedTargetYards) *
    Math.min(Math.abs(signedTargetYards) * 0.82, 22)

  return players.map((p) => {
    if (p.unit === 'defense') {
      return {
        ...p,
        x: p.x + push * 0.52,
        y: lerp(p.y, p.y * 1.06, 0.35),
      }
    }
    if (/wr|te|slot/i.test(p.id)) {
      return {
        ...p,
        x: p.x + push * (runish ? 0.45 : 1.12),
        y: lerp(p.y, p.y * 1.1, 0.5),
      }
    }
    if (/rb|fb/i.test(p.id)) {
      return {
        ...p,
        x: p.x + push * (runish ? 1.02 : 0.4),
        y: lerp(p.y, p.y * 0.92, 0.4),
      }
    }
    if (/qb/i.test(p.id)) {
      return {
        ...p,
        x: p.x + push * (runish ? 0.25 : 0.55),
        y: p.y,
      }
    }
    return {
      ...p,
      x: p.x + push * 0.88,
      y: lerp(p.y, p.y * 0.98, 0.25),
    }
  })
}

const SPEED_SCALE = 2.8

export function blendPlayerFrames(
  start: PlayerFieldPosition[],
  end: PlayerFieldPosition[],
  t: number,
): PlayerFieldPosition[] {
  const tt = Math.max(0, Math.min(1, t))
  return start.map((s, i) => {
    const e = end[i]!
    const nx = lerp(s.x, e.x, tt)
    const ny = lerp(s.y, e.y, tt)
    const vx = (e.x - s.x) * SPEED_SCALE
    const vy = (e.y - s.y) * SPEED_SCALE
    const facingDeg = (Math.atan2(e.y - s.y, e.x - s.x) * 180) / Math.PI
    return {
      ...s,
      x: nx,
      y: ny,
      vx,
      vy,
      facingDeg,
    }
  })
}
