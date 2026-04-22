import type { OffensiveFormationId, PlayResolution, TeamId } from '../footballTypes'
import { getOffensivePlay } from '../playDefinitions'
import type { BallFieldState, PlayerFieldPosition } from '../playAnimation/types'
import { buildOffensivePreviewLines } from '../spatial/playRouteGeometry'
import { PLAY_FEEL } from './playFeelConfig'
import type {
  BallSimState,
  PassSimStage,
  PlayWorldInput,
  PlayWorldSimulation,
  PlayerSimPhase,
  PlayerSimRole,
  SimPlayer,
  SimWaypoint,
} from './playSimTypes'

const ENGAGE_RADIUS = PLAY_FEEL.contact.engageRadius
const CATCH_RADIUS = PLAY_FEEL.pass.catchRadius
const SUBSTEP_DT = PLAY_FEEL.substepDt

export { SUBSTEP_DT }

function slotKeyFromId(playerId: string): string {
  const i = playerId.indexOf('_')
  return i >= 0 ? playerId.slice(i + 1) : playerId
}

export function inferRoleFromPlayerId(playerId: string, unit: 'offense' | 'defense'): PlayerSimRole {
  const k = slotKeyFromId(playerId).toLowerCase()
  if (/^qb/.test(k)) return 'QB'
  if (/^rb|^fb/.test(k)) return 'RB'
  if (/^wr|^slot/.test(k)) return 'WR'
  if (/^te/.test(k)) return 'TE'
  if (/^ol|^c|^g|^t/.test(k)) return 'OL'
  if (/^de|^dt|^dl|^nt/.test(k)) return 'DL'
  if (/^lb|^sam|^mike|^will|^nickel/.test(k)) return 'LB'
  if (/^cb/.test(k)) return 'CB'
  if (/^fs|^ss|^s\d/.test(k)) return 'S'
  if (/^k\b|^pk/.test(k)) return 'K'
  if (/^kr|^pr/.test(k)) return 'KR'
  if (unit === 'defense') return 'LB'
  return 'OL'
}

function roleStats(role: PlayerSimRole): {
  maxSpeed: number
  acceleration: number
  agility: number
  strength: number
  awareness: number
} {
  switch (role) {
    case 'QB':
      return { maxSpeed: 6.8, acceleration: 14, agility: 0.55, strength: 0.5, awareness: 0.85 }
    case 'RB':
      return { maxSpeed: 8.6, acceleration: 20, agility: 0.82, strength: 0.55, awareness: 0.62 }
    case 'WR':
      return { maxSpeed: 8.9, acceleration: 19, agility: 0.88, strength: 0.38, awareness: 0.7 }
    case 'TE':
      return { maxSpeed: 7.4, acceleration: 15, agility: 0.55, strength: 0.68, awareness: 0.58 }
    case 'OL':
      return { maxSpeed: 4.2, acceleration: 11, agility: 0.35, strength: 0.82, awareness: 0.45 }
    case 'DL':
      return { maxSpeed: 5.4, acceleration: 16, agility: 0.48, strength: 0.78, awareness: 0.5 }
    case 'LB':
      return { maxSpeed: 7.1, acceleration: 17, agility: 0.62, strength: 0.65, awareness: 0.72 }
    case 'CB':
      return { maxSpeed: 8.2, acceleration: 18, agility: 0.85, strength: 0.42, awareness: 0.68 }
    case 'S':
      return { maxSpeed: 7.8, acceleration: 17, agility: 0.72, strength: 0.52, awareness: 0.75 }
    case 'K':
    case 'KR':
      return { maxSpeed: 7.5, acceleration: 16, agility: 0.7, strength: 0.45, awareness: 0.55 }
    default:
      return { maxSpeed: 6.5, acceleration: 14, agility: 0.5, strength: 0.5, awareness: 0.55 }
  }
}

function densifyPolyline(pts: { x: number; y: number }[], spacing = 1.2): SimWaypoint[] {
  if (pts.length === 0) return []
  const out: SimWaypoint[] = [{ x: pts[0]!.x, y: pts[0]!.y }]
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const steps = Math.max(1, Math.ceil(len / spacing))
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      out.push({ x: a.x + dx * t, y: a.y + dy * t })
    }
  }
  return out
}

function lineIdToOffenseSlotKey(lineId: string): string | null {
  const base = lineId.replace(/^(run_|route_)/, '')
  const m = base.match(/^(wr1|wr2|wr3|wr4|slot|te|rb|fb|ol\d|qb)/i)
  if (m) return m[1]!.toLowerCase()
  if (base.startsWith('wr1')) return 'wr1'
  if (base.startsWith('wr2')) return 'wr2'
  if (base.startsWith('wr3')) return 'wr3'
  if (base.startsWith('te')) return 'te'
  if (base.startsWith('rb')) return 'rb'
  return null
}

function buildWaypointsForPlayer(
  los: number,
  formationId: OffensiveFormationId,
  playId: string,
  category: 'run' | 'pass' | 'special',
  playerId: string,
): SimWaypoint[] {
  const slot = slotKeyFromId(playerId)
  const lines = buildOffensivePreviewLines(los, formationId, playId, category)
  for (const ln of lines) {
    const sk = lineIdToOffenseSlotKey(ln.id)
    if (sk && sk === slot && ln.points.length >= 2) {
      return densifyPolyline(ln.points)
    }
  }
  if (/^ol\d/.test(slot)) {
    const ln = lines.find((l) => l.id.startsWith('run_ol'))
    if (ln && ln.points.length >= 2) return densifyPolyline(ln.points)
  }
  /** Fallback: push downfield from current position — filled by caller */
  return []
}

function defaultPushWaypoint(
  los: number,
  signedYards: number,
  start: SimWaypoint,
  lateralScale: number,
): SimWaypoint[] {
  const endX = los + signedYards * 0.92
  return densifyPolyline(
    [
      start,
      { x: start.x + signedYards * 0.35, y: start.y + lateralScale * 0.4 },
      { x: endX, y: start.y + lateralScale * 0.7 },
    ],
    1.4,
  )
}

function initialPhaseFor(
  role: PlayerSimRole,
  unit: 'offense' | 'defense',
  category: 'run' | 'pass' | 'special',
  defenseCallId: string,
): PlayerSimPhase {
  if (unit === 'offense') {
    if (role === 'OL') return category === 'pass' ? 'passBlock' : 'runBlock'
    if (role === 'TE' && category === 'run') return 'runBlock'
    if (role === 'TE') return 'routeRun'
    if (role === 'RB' && category === 'pass') return 'passBlock'
    if (role === 'QB') return 'snapReact'
    if (role === 'RB' && category === 'run') return 'snapReact'
    if (role === 'WR') return 'routeRun'
    return 'snapReact'
  }
  if (role === 'DL') return 'passRush'
  if (role === 'LB') return category === 'run' ? 'pursueBall' : 'coverageDrop'
  if (role === 'CB' || role === 'S')
    return defenseCallId === 'cover_1_man' ? 'manCoverage' : 'zoneCoverage'
  return 'zoneCoverage'
}

function layoutToSimPlayers(
  layout: PlayerFieldPosition[],
  los: number,
  formationId: OffensiveFormationId,
  playId: string,
  category: 'run' | 'pass' | 'special',
  signedTargetYards: number,
  defenseCallId: string,
): SimPlayer[] {
  return layout.map((p) => {
    const role = inferRoleFromPlayerId(p.id, p.unit)
    const st = roleStats(role)
    let routeWaypoints: SimWaypoint[] =
      p.unit === 'offense'
        ? buildWaypointsForPlayer(los, formationId, playId, category, p.id)
        : []
    if (p.unit === 'offense' && routeWaypoints.length < 2) {
      const start = { x: p.x, y: p.y }
      const lat = role === 'RB' || role === 'WR' ? p.y * 0.08 : 0
      routeWaypoints = defaultPushWaypoint(los, signedTargetYards, start, lat)
    }
    if (p.unit === 'defense') {
      const drift = signedTargetYards > 0 ? 0.55 : 0.45
      routeWaypoints = densifyPolyline(
        [
          { x: p.x, y: p.y },
          { x: p.x + signedTargetYards * drift, y: p.y * 0.92 },
        ],
        1.5,
      )
    }
    return {
      id: p.id,
      teamId: p.teamId,
      unit: p.unit,
      role,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      facingRad: 0,
      speed: 0,
      maxSpeed: st.maxSpeed,
      acceleration: st.acceleration,
      agility: st.agility,
      strength: st.strength,
      awareness: st.awareness,
      assignment: category === 'run' && role === 'OL' ? 'run_lane' : 'default',
      assignmentTargetId: null,
      controlled: false,
      actionCooldown: 0,
      tackleIntentTimer: 0,
      shedBoostTimer: 0,
      phase: initialPhaseFor(role, p.unit, category, defenseCallId),
      routeWaypoints,
      routeIndex: 0,
      engagedWith: null,
      engagedBy: null,
      shedTimer: 0,
      pursuitTx: p.x,
      pursuitTy: p.y,
    }
  })
}

function defenseAssignmentLabel(
  defenseCallId: string,
  role: PlayerSimRole,
  slot: string,
): string {
  if (defenseCallId === 'cover_1_man') return `man_${slot}`
  if (defenseCallId === 'cover_2_zone') {
    if (role === 'S') return 'deep_half'
    if (role === 'CB') return 'flat_cloud'
    if (role === 'LB') return 'hook_zone'
    return 'curl'
  }
  if (defenseCallId === 'cover_3_sky' || defenseCallId.includes('cover_3')) {
    if (role === 'CB') return 'deep_third'
    if (role === 'S') return 'post_safety'
    if (role === 'LB') return 'hook_flat'
    return 'seam_help'
  }
  if (defenseCallId === 'run_blitz') {
    if (role === 'LB' || role === 'DL') return 'shoot_gap'
    return 'contain'
  }
  if (role === 'DL') return 'rush_lane'
  return 'zone_drop'
}

function applyDefenseAssignments(players: SimPlayer[], defenseCallId: string): SimPlayer[] {
  const off = players.filter((p) => p.unit === 'offense')
  const qb = off.find((p) => p.role === 'QB')
  const rbs = off.filter((p) => p.role === 'RB')
  const wrs = off.filter((p) => p.role === 'WR' || p.role === 'TE')
  return players.map((p) => {
    if (p.unit !== 'defense') return p
    const slot = slotKeyFromId(p.id)
    let assignment = defenseAssignmentLabel(defenseCallId, p.role, slot)
    if (defenseCallId === 'cover_1_man' && p.role === 'CB') {
      const idx = players.filter((x) => x.unit === 'defense' && x.role === 'CB').indexOf(p)
      const wr = wrs[idx % Math.max(1, wrs.length)]
      if (wr) assignment = `mirror:${wr.id}`
    }
    if (defenseCallId === 'cover_2_zone' && p.role === 'S') {
      assignment = p.y >= 0 ? 'deep_r' : 'deep_l'
    }
    if (defenseCallId === 'run_blitz' && (p.role === 'LB' || p.role === 'DL')) {
      const anchor = rbs[0] ?? qb
      if (anchor) assignment = `blitz:${anchor.id}`
    }
    return { ...p, assignment }
  })
}

export type CreatePlayWorldParams = {
  offenseTeam: TeamId
  yardLineAtSnap: number
  signedTargetYards: number
  offensePlayId: string
  defenseCallId: string
  layoutPlayers: PlayerFieldPosition[]
  ball: BallFieldState
  resolution: PlayResolution
}

export function createPlayWorldFromSnap(p: CreatePlayWorldParams): PlayWorldSimulation {
  const play = getOffensivePlay(p.offensePlayId)
  const category = play?.category ?? 'run'
  const formationId = play?.formationId ?? 'shotgun_doubles'
  let players = layoutToSimPlayers(
    p.layoutPlayers,
    p.yardLineAtSnap,
    formationId,
    p.offensePlayId,
    category,
    p.signedTargetYards,
    p.defenseCallId,
  )
  players = applyDefenseAssignments(players, p.defenseCallId)

  const qbId = players.find((x) => x.role === 'QB' && x.teamId === p.offenseTeam)?.id ?? null
  const rbId = players.find((x) => x.role === 'RB' && x.teamId === p.offenseTeam)?.id ?? null

  const isPass = category === 'pass'
  let carrierId = qbId
  const ballMode: BallSimState['mode'] = 'carried'
  const passStage: PassSimStage = 'qbCarry'

  if (!isPass && rbId) {
    carrierId = rbId
    const rb = players.find((x) => x.id === rbId)
    const qbP = players.find((x) => x.id === qbId)
    if (rb && qbP) {
      rb.x = qbP.x + 0.35
      rb.y = qbP.y - 0.4
      rb.phase = 'carryBall'
    }
    if (qbP) qbP.phase = 'snapReact'
  }

  const receiverOrder = players
    .filter((x) => x.unit === 'offense' && (x.role === 'WR' || x.role === 'TE'))
    .map((x) => x.id)
  const primaryTargetId = receiverOrder[0] ?? null

  const ball: BallSimState = {
    mode: ballMode,
    x: carrierId ? (players.find((x) => x.id === carrierId)?.x ?? p.ball.x) : p.ball.x,
    y: carrierId ? (players.find((x) => x.id === carrierId)?.y ?? p.ball.y) : p.ball.y,
    z: 0,
    carrierId,
    throwTargetId: isPass ? primaryTargetId : null,
    vx: 0,
    vy: 0,
    vz: 0,
    catchWindowOpen: null,
  }

  players = players.map((pl) => {
    if (pl.id === carrierId) return { ...pl, phase: 'carryBall' as PlayerSimPhase }
    return pl
  })

  return {
    offenseTeam: p.offenseTeam,
    yardLineAtSnap: p.yardLineAtSnap,
    signedTargetYards: p.signedTargetYards,
    playId: p.offensePlayId,
    playCategory: category,
    defenseCallId: p.defenseCallId,
    time: 0,
    players,
    ball,
    passStage,
    passTimer: 0,
    primaryTargetId,
    finished: Math.abs(p.signedTargetYards) < 0.05,
    lastWhistleReason: null,
    futureControllableDefenseId: null,
  }
}

function rotateToward(current: number, target: number, maxTurn: number): number {
  let d = target - current
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  if (Math.abs(d) <= maxTurn) return target
  return current + Math.sign(d) * maxTurn
}

function computeDesiredMotion(
  p: SimPlayer,
  world: PlayWorldSimulation,
  input: PlayWorldInput,
): { dx: number; dy: number; maxMul: number } {
  const { ball, yardLineAtSnap: los, signedTargetYards, playCategory, defenseCallId } = world
  const carrier = world.players.find((x) => x.id === ball.carrierId)

  let maxMul = 1
  if (p.engagedWith || p.engagedBy) maxMul = 0.34 + Math.min(0.2, p.strength * 0.15)

  if (playCategory === 'pass' && p.role === 'QB' && world.passStage === 'qbCarry') {
    const userMoveY = input.activePlayerId === p.id ? (input.moveY ?? 0) : input.carrierSteer
    const userMoveX = input.activePlayerId === p.id ? (input.moveX ?? 0) : 0
    return {
      dx: -0.22 + userMoveX * 0.42,
      dy: userMoveY * 0.55,
      maxMul: 0.48,
    }
  }

  if (p.phase === 'blockEngaged') {
    const oid = p.engagedWith ?? p.engagedBy
    const oth = oid ? world.players.find((x) => x.id === oid) : undefined
    if (oth) {
      const dx = oth.x - p.x
      const dy = oth.y - p.y
      const len = Math.hypot(dx, dy) || 1
      return { dx: (dx / len) * 0.25, dy: (dy / len) * 0.25, maxMul: 0.22 }
    }
  }

  if (p.phase === 'carryBall' && ball.carrierId === p.id) {
    const targetX = los + signedTargetYards * 0.96
    const isActive = input.activePlayerId === p.id
    const moveX = isActive ? (input.moveX ?? 0) : 0
    const moveY = isActive ? (input.moveY ?? 0) : input.carrierSteer
    const tx = Math.min(Math.max(los - 3, targetX + moveX * 7), p.x + 16)
    const ty = p.y + moveY * 9
    const dx = tx - p.x
    const dy = ty - p.y
    const len = Math.hypot(dx, dy) || 1
    return { dx: dx / len, dy: dy / len, maxMul }
  }

  if (p.unit === 'offense' && (p.phase === 'routeRun' || p.phase === 'snapReact')) {
    const wp = p.routeWaypoints
    if (wp.length >= 2) {
      let idx = p.routeIndex
      while (idx < wp.length - 1) {
        const w = wp[idx]!
        if ((w.x - p.x) ** 2 + (w.y - p.y) ** 2 < 1.44) idx++
        else break
      }
      const target = wp[Math.min(idx, wp.length - 1)]!
      const dx = target.x - p.x
      const dy = target.y - p.y
      const len = Math.hypot(dx, dy) || 1
      return { dx: dx / len, dy: dy / len, maxMul: 0.95 }
    }
  }

  if (p.unit === 'offense' && (p.phase === 'runBlock' || p.phase === 'passBlock')) {
    const defPlayers = world.players.filter((x) => x.unit === 'defense')
    let best: SimPlayer | null = null
    let bestD = 22
    for (const d of defPlayers) {
      if (d.x < los + 0.25) continue
      const dy = d.y - p.y
      if (Math.abs(dy) > 7) continue
      const dd = Math.hypot(d.x - p.x, d.y - p.y)
      if (dd < bestD) {
        bestD = dd
        best = d
      }
    }
    if (best) {
      const dx = best.x - p.x
      const dy = best.y - p.y
      const len = Math.hypot(dx, dy) || 1
      return { dx: dx / len, dy: dy / len, maxMul: 0.42 }
    }
    return { dx: 1, dy: 0, maxMul: 0.4 }
  }

  if (p.unit === 'defense') {
    if (input.activePlayerId === p.id) {
      const moveX = input.moveX ?? 0
      const moveY = input.moveY ?? 0
      if (Math.hypot(moveX, moveY) > 0.05) {
        const len = Math.hypot(moveX, moveY) || 1
        return { dx: moveX / len, dy: moveY / len, maxMul: 1.12 }
      }
    }
    if (!carrier) return { dx: 0.4, dy: 0, maxMul: 0.8 }
    if (p.assignment.startsWith('mirror:')) {
      const tid = p.assignment.slice('mirror:'.length)
      const wr = world.players.find((x) => x.id === tid)
      if (wr) {
        const lead = wr.vx * 0.25
        const dx = wr.x + lead - p.x
        const dy = wr.y - p.y
        const len = Math.hypot(dx, dy) || 1
        return { dx: dx / len, dy: dy / len, maxMul: 0.94 }
      }
    }
    if (defenseCallId === 'cover_2_zone' && p.role === 'S') {
      const deepY = p.y >= 0 ? 17 : -17
      const dx = carrier.x - p.x + 4
      const dy = deepY - p.y
      const len = Math.hypot(dx, dy) || 1
      return { dx: dx / len, dy: dy / len, maxMul: 0.9 }
    }
    if ((defenseCallId === 'cover_3_sky' || defenseCallId.includes('cover_3')) && p.role === 'CB') {
      const dropX = los + 11
      const dropY = p.y >= 0 ? 15 : -15
      const dx = dropX - p.x
      const dy = dropY - p.y
      const len = Math.hypot(dx, dy) || 1
      return { dx: dx / len, dy: dy / len, maxMul: 0.88 }
    }
    if (p.assignment.startsWith('blitz:')) {
      const tid = p.assignment.slice('blitz:'.length)
      const tgt = world.players.find((x) => x.id === tid) ?? carrier
      const dx = tgt.x - p.x
      const dy = tgt.y - p.y
      const len = Math.hypot(dx, dy) || 1
      return { dx: dx / len, dy: dy / len, maxMul: 1.08 }
    }
    const lead = 0.4
    const ix = carrier.x + carrier.vx * lead
    const iy = carrier.y + carrier.vy * lead
    const dx = ix - p.x
    const dy = iy - p.y
    const len = Math.hypot(dx, dy) || 1
    return { dx: dx / len, dy: dy / len, maxMul: playCategory === 'run' ? 1 : 0.9 }
  }

  if (p.role === 'OL' && p.unit === 'offense') {
    return { dx: 1, dy: -p.y * 0.03, maxMul: 0.48 }
  }

  return { dx: 1, dy: 0, maxMul: 0.65 }
}

function integrateVelocity(
  p: SimPlayer,
  ddx: number,
  ddy: number,
  dt: number,
  maxMul: number,
): { vx: number; vy: number; facingRad: number } {
  const engaged = Boolean(p.engagedWith || p.engagedBy)
  const controlMul = p.controlled ? PLAY_FEEL.player.controlledSpeedMultiplier : 1
  const cap =
    p.maxSpeed *
    PLAY_FEEL.player.globalSpeedMultiplier *
    maxMul *
    controlMul *
    (engaged ? PLAY_FEEL.contact.blockSlowMultiplier : 1)
  const targetVx = ddx * cap
  const targetVy = ddy * cap
  const accelMul = p.controlled ? PLAY_FEEL.player.controlledAccelerationMultiplier : 1
  const maxDv = p.acceleration * accelMul * dt
  let nvx = p.vx + clamp(targetVx - p.vx, -maxDv, maxDv)
  let nvy = p.vy + clamp(targetVy - p.vy, -maxDv, maxDv)
  const sp = Math.hypot(nvx, nvy)
  if (sp > cap) {
    nvx = (nvx / sp) * cap
    nvy = (nvy / sp) * cap
  }
  const targetFace = Math.atan2(nvy, nvx + 0.001)
  const maxTurn = (0.55 + p.agility * 2.2) * dt
  const facingRad = rotateToward(p.facingRad, targetFace, maxTurn)
  return { vx: nvx, vy: nvy, facingRad }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function tryEngagements(players: SimPlayer[]): SimPlayer[] {
  const ps = players.map((p) => ({ ...p }))
  const ol = ps.filter((p) => p.role === 'OL' && p.unit === 'offense')
  const dl = ps.filter((p) => p.role === 'DL' && p.unit === 'defense')
  for (const o of ol) {
    if (o.engagedWith) continue
    let best: SimPlayer | null = null
    let bd = ENGAGE_RADIUS
    for (const d of dl) {
      if (d.engagedBy) continue
      const dist = Math.hypot(d.x - o.x, d.y - o.y)
      if (dist < bd) {
        bd = dist
        best = d
      }
    }
    if (best && bd < ENGAGE_RADIUS) {
      o.engagedWith = best.id
      o.phase = 'blockEngaged'
      const di = ps.findIndex((x) => x.id === best!.id)
      if (di >= 0) {
        ps[di]!.engagedBy = o.id
        ps[di]!.phase = 'blockEngaged'
      }
    }
  }
  /** Run support: TE/RB engage nearby LB */
  const blockers = ps.filter(
    (p) => p.unit === 'offense' && (p.role === 'TE' || p.role === 'RB') && p.phase === 'runBlock',
  )
  const lbs = ps.filter((p) => p.unit === 'defense' && p.role === 'LB')
  for (const b of blockers) {
    if (b.engagedWith) continue
    let best: SimPlayer | null = null
    let bd = ENGAGE_RADIUS * 1.05
    for (const lb of lbs) {
      if (lb.engagedBy) continue
      const dist = Math.hypot(lb.x - b.x, lb.y - b.y)
      if (dist < bd) {
        bd = dist
        best = lb
      }
    }
    if (best && bd < ENGAGE_RADIUS * 1.05) {
      b.engagedWith = best.id
      b.phase = 'blockEngaged'
      const di = ps.findIndex((x) => x.id === best!.id)
      if (di >= 0) {
        ps[di]!.engagedBy = b.id
        ps[di]!.phase = 'blockEngaged'
      }
    }
  }
  return ps
}

function applyEngagementPhysics(ps: SimPlayer[], dt: number): SimPlayer[] {
  const next = ps.map((p) => {
    if (!p.engagedWith) return p
    const oth = ps.find((x) => x.id === p.engagedWith)
    if (!oth)
      return {
        ...p,
        engagedWith: null,
        phase: p.unit === 'defense' ? 'passRush' : resetBlockerPhase(p),
      }
    const mx = (oth.x - p.x) * 0.08 * dt * 60
    const my = (oth.y - p.y) * 0.08 * dt * 60
    const push = (p.strength - oth.strength) * 0.015 * dt
    let shedTimer = p.shedTimer + (oth.strength - p.strength) * 0.35 * dt
    let engagedWith: string | null = p.engagedWith
    let phase = p.phase
    if (p.unit === 'defense' && shedTimer > 0.92 + oth.awareness * 0.25) {
      engagedWith = null
      shedTimer = 0
      phase = 'passRush'
    }
    return {
      ...p,
      x: p.x + mx * push,
      y: p.y + my * push,
      vx: p.vx * 0.92,
      vy: p.vy * 0.92,
      shedTimer,
      engagedWith,
      phase,
    }
  })
  /** Clear OL/TE engagedWith when defender shed */
  return next.map((p) => {
    if (!p.engagedWith) return p
    const mate = next.find((x) => x.id === p.engagedWith)
    if (!mate || !mate.engagedWith || mate.engagedWith !== p.id) {
      return { ...p, engagedWith: null, phase: resetBlockerPhase(p) }
    }
    return p
  })
}

function resetBlockerPhase(p: SimPlayer): PlayerSimPhase {
  if (p.role === 'OL') return p.assignment === 'run_lane' ? 'runBlock' : 'passBlock'
  if (p.role === 'TE') return 'runBlock'
  if (p.role === 'RB') return 'passBlock'
  return 'passRush'
}

function syncPartnerClear(ps: SimPlayer[]): SimPlayer[] {
  return ps.map((p) => {
    if (!p.engagedBy) return p
    const mate = ps.find((x) => x.id === p.engagedBy)
    if (!mate || (!mate.engagedWith && !mate.engagedBy)) {
      return {
        ...p,
        engagedBy: null,
        phase: p.role === 'DL' || p.role === 'LB' ? 'passRush' : p.phase,
      }
    }
    if (mate.engagedWith !== p.id && mate.engagedBy !== p.id) {
      return {
        ...p,
        engagedBy: null,
        phase: p.role === 'DL' || p.role === 'LB' ? 'passRush' : p.phase,
      }
    }
    return p
  })
}

function passStep(
  world: PlayWorldSimulation,
  dt: number,
  resolution: PlayResolution,
): PlayWorldSimulation {
  const w = { ...world }
  const qb = w.players.find((x) => x.role === 'QB' && x.teamId === w.offenseTeam)
  const tgtId = w.primaryTargetId ?? w.ball.throwTargetId
  const tgt = tgtId ? w.players.find((x) => x.id === tgtId) : undefined

  if (w.passStage === 'qbCarry') {
    w.passTimer += dt
    if (w.passTimer > 0.32 && tgt) {
      w.passStage = 'inFlight'
      w.ball.mode = 'thrown'
      w.ball.throwTargetId = tgt.id
      w.ball.carrierId = null
      const dx = tgt.x - w.ball.x
      const dy = tgt.y - w.ball.y
      const dist = Math.hypot(dx, dy) || 1
      const flight = clamp(dist * 0.055, 0.38, 0.62)
      w.ball.vx = dx / flight
      w.ball.vy = dy / flight
      w.ball.vz = 2.4 / flight
      if (qb) {
        w.players = w.players.map((pl) =>
          pl.id === qb.id ? { ...pl, phase: 'throwBall' as PlayerSimPhase } : pl,
        )
      }
    }
    return w
  }

  if (w.passStage === 'inFlight') {
    w.ball.x += w.ball.vx * dt
    w.ball.y += w.ball.vy * dt
    w.ball.z += w.ball.vz * dt
    w.ball.vz -= 4.2 * dt
    if (w.ball.z <= 0) {
      w.ball.z = 0
      const outcome = resolution.outcome
      const distTgt =
        tgt != null ? Math.hypot(w.ball.x - tgt.x, w.ball.y - tgt.y) : 999
      const defs = w.players.filter((p) => p.unit === 'defense')
      let nearestDef: SimPlayer | null = null
      let nd = 999
      for (const d of defs) {
        const dd = Math.hypot(d.x - w.ball.x, d.y - w.ball.y)
        if (dd < nd) {
          nd = dd
          nearestDef = d
        }
      }

      if (outcome === 'incomplete' || outcome === 'sack') {
        w.passStage = 'incomplete'
        w.ball.mode = 'dead'
        w.finished = true
        return w
      }
      if (outcome === 'interception' && nearestDef && nd < CATCH_RADIUS + 1.1) {
        w.passStage = 'intercepted'
        w.ball.carrierId = nearestDef.id
        w.ball.mode = 'carried'
        nearestDef.phase = 'carryBall'
        w.players = w.players.map((p) =>
          p.id === nearestDef!.id ? { ...p, phase: 'carryBall' as PlayerSimPhase } : p,
        )
        return w
      }
      if (distTgt < CATCH_RADIUS + 0.35 && tgt) {
        w.passStage = 'received'
        w.ball.carrierId = tgt.id
        w.ball.mode = 'carried'
        w.ball.x = tgt.x
        w.ball.y = tgt.y
        w.players = w.players.map((p) =>
          p.id === tgt.id ? { ...p, phase: 'carryBall' as PlayerSimPhase } : p,
        )
      } else {
        /** contested: use awareness vs nearest defender */
        const defPressure = nearestDef && nd < 1.8 ? nearestDef.awareness : 0
        const catchScore = (tgt?.awareness ?? 0.6) + (tgt?.agility ?? 0.5) * 0.2 - defPressure
        if (catchScore > 0.45 && tgt) {
          w.passStage = 'received'
          w.ball.carrierId = tgt.id
          w.ball.mode = 'carried'
          w.ball.x = tgt.x
          w.ball.y = tgt.y
          w.players = w.players.map((p) =>
            p.id === tgt.id ? { ...p, phase: 'carryBall' as PlayerSimPhase } : p,
          )
        } else {
          w.passStage = 'incomplete'
          w.ball.mode = 'dead'
          w.finished = true
        }
      }
    }
    return w
  }

  return w
}

export function stepPlayWorld(
  world: PlayWorldSimulation,
  dt: number,
  input: PlayWorldInput,
  resolution: PlayResolution,
): PlayWorldSimulation {
  if (world.finished) return world

  let w: PlayWorldSimulation = {
    ...world,
    time: world.time + dt,
    players: world.players.map((p) => ({ ...p })),
  }

  w.players = w.players.map((p) => ({
    ...p,
    controlled: input.activePlayerId === p.id,
    actionCooldown: Math.max(0, p.actionCooldown - dt),
    tackleIntentTimer: Math.max(0, p.tackleIntentTimer - dt),
    shedBoostTimer: Math.max(0, p.shedBoostTimer - dt),
  }))

  if (w.playCategory === 'pass') {
    w = passStep(w, dt, resolution)
    if (w.finished) return w
  }

  /** Route index advance */
  w.players = w.players.map((p) => {
    if (p.routeWaypoints.length < 2) return p
    let idx = p.routeIndex
    while (idx < p.routeWaypoints.length - 1) {
      const pt = p.routeWaypoints[idx]!
      if ((pt.x - p.x) ** 2 + (pt.y - p.y) ** 2 < 1.69) idx++
      else break
    }
    return { ...p, routeIndex: idx }
  })

  w.players = tryEngagements(w.players)
  w.players = applyEngagementPhysics(w.players, dt)
  w.players = syncPartnerClear(w.players)

  w.players = w.players.map((p) => {
    const { dx, dy, maxMul } = computeDesiredMotion(p, w, input)
    const { vx, vy, facingRad } = integrateVelocity(p, dx, dy, dt, maxMul)
    let x = p.x + vx * dt
    let y = p.y + vy * dt
    x = clamp(x, 1, 99)
    y = clamp(y, -26, 26)
    return { ...p, vx, vy, facingRad, x, y }
  })

  /** Ball follows carrier */
  if (w.ball.mode === 'carried' && w.ball.carrierId) {
    const c = w.players.find((x) => x.id === w.ball.carrierId)
    if (c) {
      w.ball.x = c.x
      w.ball.y = c.y
    }
  }

  const ballCarrier = w.players.find((x) => x.id === w.ball.carrierId)

  /** Run tackle: proximity + leverage (engaged defenders rarely wrap). */
  if (ballCarrier && w.playCategory !== 'pass') {
    for (const d of w.players.filter((x) => x.unit === 'defense')) {
      const dist = Math.hypot(d.x - ballCarrier.x, d.y - ballCarrier.y)
      if (d.phase === 'blockEngaged' && dist > 0.58) continue
      if (dist < 0.52) {
        const breakTackle =
          ballCarrier.agility * 0.45 + ballCarrier.strength * 0.25 - d.strength * 0.22
        if (dist < 0.38 || breakTackle < 0.22) {
          w.finished = true
          w.ball.mode = 'dead'
          w.players = w.players.map((p) =>
            p.id === ballCarrier.id ? { ...p, phase: 'tackled' as PlayerSimPhase } : p,
          )
          return w
        }
      }
    }
  }

  if (ballCarrier && w.playCategory === 'pass' && w.passStage === 'received') {
    for (const d of w.players.filter((x) => x.unit === 'defense')) {
      const dist = Math.hypot(d.x - ballCarrier.x, d.y - ballCarrier.y)
      if (dist < 0.48) {
        w.finished = true
        w.ball.mode = 'dead'
        return w
      }
    }
  }

  /** Finish at yard line (run / short pass script). */
  const tgtX = w.yardLineAtSnap + w.signedTargetYards
  if (w.ball.mode === 'carried' && w.ball.carrierId) {
    const cx = w.ball.x
    if (w.signedTargetYards >= 0 && cx >= tgtX - 0.45) w.finished = true
    if (w.signedTargetYards < 0 && cx <= tgtX + 0.45) w.finished = true
  }

  if (
    w.playCategory === 'pass' &&
    (w.passStage === 'received' || w.passStage === 'intercepted') &&
    w.ball.mode === 'carried' &&
    w.ball.carrierId
  ) {
    const car = w.players.find((x) => x.id === w.ball.carrierId)
    if (car) {
      const line = w.yardLineAtSnap + w.signedTargetYards
      if (
        (w.signedTargetYards >= 0 && car.x >= line - 0.48) ||
        (w.signedTargetYards < 0 && car.x <= line + 0.48)
      ) {
        w.finished = true
      }
    }
  }

  if (w.time > 20) w.finished = true

  return w
}

export function syncWorldToField(world: PlayWorldSimulation): {
  players: PlayerFieldPosition[]
  ball: BallFieldState
  animatedYards: number
} {
  const players = world.players.map(
    (p): PlayerFieldPosition => ({
      id: p.id,
      teamId: p.teamId,
      unit: p.unit,
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      facingDeg: (p.facingRad * 180) / Math.PI,
      role: p.role,
      simPhase: p.phase,
    }),
  )
  const ball: BallFieldState = {
    x: world.ball.x,
    y: world.ball.y,
    carrierId: world.ball.carrierId,
    mode: world.ball.mode,
    throwTargetId: world.ball.throwTargetId,
    z: world.ball.z,
  }
  const animatedYards = world.ball.x - world.yardLineAtSnap
  return { players, ball, animatedYards }
}

export function applyCarrierJuke(world: PlayWorldSimulation, lateral: number): PlayWorldSimulation {
  const id = world.ball.carrierId
  if (!id) return world
  return {
    ...world,
    players: world.players.map((p) =>
      p.id === id ? { ...p, vy: p.vy + lateral * 2.8, vx: p.vx + 0.4 } : p,
    ),
  }
}

export function applyCarrierDive(world: PlayWorldSimulation): PlayWorldSimulation {
  const id = world.ball.carrierId
  if (!id) return world
  return {
    ...world,
    players: world.players.map((p) =>
      p.id === id ? { ...p, vx: p.vx + 2.2, maxSpeed: p.maxSpeed * 1.12 } : p,
    ),
  }
}

export function setWorldPrimaryTarget(world: PlayWorldSimulation, receiverId: string): PlayWorldSimulation {
  return {
    ...world,
    primaryTargetId: receiverId,
    ball: { ...world.ball, throwTargetId: receiverId },
  }
}
