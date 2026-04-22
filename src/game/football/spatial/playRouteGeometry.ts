import type { FieldPolyline, Vec2 } from './geometryTypes'
import type { OffensiveFormationId } from '../footballTypes'
import type { FormationSlot } from './offensiveFormations'
import { slotsForFormation } from './offensiveFormations'

function absFromRel(los: number, rel: Vec2): Vec2 {
  return { x: los + rel.x, y: rel.y }
}

function firstSlotRel(slots: FormationSlot[], keys: string[]): Vec2 {
  for (const k of keys) {
    const s = slots.find((x) => x.key === k)
    if (s) return s.rel
  }
  return { x: 0, y: 0 }
}

/** Route / run preview polylines (field absolute coords). */
export function buildOffensivePreviewLines(
  los: number,
  formationId: OffensiveFormationId,
  playId: string,
  category: 'run' | 'pass' | 'special',
): FieldPolyline[] {
  const slots = slotsForFormation(formationId)
  const by = (k: string) => slots.find((s) => s.key === k)?.rel ?? { x: 0, y: 0 }
  const thirdShort = () => firstSlotRel(slots, ['slot', 'wr3', 'wr2'])

  const lines: FieldPolyline[] = []

  if (category === 'run') {
    const rb = by('rb')
    const push = playId.includes('outside') ? 6 : playId.includes('jet') ? 8 : 4
    const bend = playId.includes('outside') ? 10 : 0
    lines.push({
      id: 'run_rb',
      kind: 'runPath',
      label: 'RB path',
      points: [
        absFromRel(los, rb),
        absFromRel(los, { x: rb.x + push * 0.4, y: rb.y + bend * 0.15 }),
        absFromRel(los, { x: rb.x + push, y: rb.y + bend * 0.35 }),
      ],
    })
    const olPush = [
      by('ol1'),
      by('ol3'),
      by('ol5'),
    ].map((r) =>
      [
        absFromRel(los, r),
        absFromRel(los, { x: r.x + 2.2, y: r.y * 0.9 }),
      ].flat(),
    )
    for (let i = 0; i < olPush.length; i++) {
      const pts = olPush[i]!
      lines.push({
        id: `run_ol_${i}`,
        kind: 'blocking',
        label: 'OL surge',
        points: [pts[0]!, pts[1]!],
      })
    }
    return lines
  }

  if (category === 'pass') {
    const addRoute = (id: string, rel: Vec2, dx: number, dy: number, mid?: Vec2) => {
      const a = absFromRel(los, rel)
      const end = absFromRel(los, { x: rel.x + dx, y: rel.y + dy })
      const pts = mid
        ? [a, absFromRel(los, mid), end]
        : [a, end]
      lines.push({ id, kind: 'route', points: pts })
    }

    if (playId === 'quick_slants') {
      const s3 = thirdShort()
      addRoute('wr1_slant', by('wr1'), 7, -6, { x: by('wr1').x + 3, y: by('wr1').y - 2 })
      addRoute('wr2_slant', by('wr2'), 7, 6, { x: by('wr2').x + 3, y: by('wr2').y + 2 })
      addRoute('wr3_slant', s3, 6, -4, undefined)
    } else if (playId === 'stick') {
      addRoute('wr1_out', by('wr1'), 5, -4)
      addRoute('wr2_stick', by('wr2'), 6, 0)
      addRoute('te_stick', by('te'), 5, -2)
    } else if (playId === 'four_verticals') {
      const w3 = firstSlotRel(slots, ['wr3', 'slot', 'wr2'])
      addRoute('wr1_go', by('wr1'), 22, -2)
      addRoute('wr2_go', by('wr2'), 22, 2)
      addRoute('wr3_go', w3, 22, 0)
      addRoute('te_seam', firstSlotRel(slots, ['te', 'te1']), 18, 1)
    } else if (playId === 'mesh') {
      addRoute('wr1_mesh', by('wr1'), 4, -8, { x: by('wr1').x + 2, y: by('wr1').y - 3 })
      addRoute('wr2_mesh', by('wr2'), 4, 8, { x: by('wr2').x + 2, y: by('wr2').y + 3 })
    } else if (playId === 'flood') {
      addRoute('wr1_flat', by('wr1'), 3, -12)
      addRoute('wr2_corner', by('wr2'), 14, 10)
      addRoute('te_out', by('te'), 10, -6)
    } else if (playId === 'screen_pass') {
      addRoute('rb_screen', by('rb'), -2, 8, { x: by('rb').x + 1, y: by('rb').y + 12 })
    } else if (playId === 'play_action_crossers') {
      addRoute('te_cross', by('te'), 12, -10)
      addRoute('wr2_cross', by('wr2'), 11, 8)
    } else {
      addRoute('wr1_default', by('wr1'), 10, -4)
      addRoute('wr2_default', by('wr2'), 10, 4)
    }
    return lines
  }

  return lines
}
