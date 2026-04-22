import type {
  BlitzArrow,
  ManCoverageEdge,
  RunFitIndicator,
  Vec2,
  ZoneHull,
} from './geometryTypes'

export type DefensiveVisualTemplate = {
  id: string
  /** 11 defender anchor points (relative to LOS, x+ = downfield). */
  defenderSlots: { key: string; rel: Vec2 }[]
  deepZones: ZoneHull[]
  underneathZones: ZoneHull[]
  manAssignments: ManCoverageEdge[]
  blitzArrows: BlitzArrow[]
  runFits: RunFitIndicator[]
}

function z(
  id: string,
  corners: Vec2[],
  depth: ZoneHull['depth'],
  label: string,
): ZoneHull {
  return { id, corners, depth, label }
}

const baseSlots: DefensiveVisualTemplate['defenderSlots'] = [
  { key: 'de1', rel: { x: 1.1, y: -7 } },
  { key: 'dt1', rel: { x: 1.0, y: -3.5 } },
  { key: 'dt2', rel: { x: 1.0, y: 3.5 } },
  { key: 'de2', rel: { x: 1.1, y: 7 } },
  { key: 'sam', rel: { x: 3.2, y: -8 } },
  { key: 'mike', rel: { x: 3.5, y: 0 } },
  { key: 'will', rel: { x: 3.2, y: 8 } },
  { key: 'cb1', rel: { x: 5.5, y: -18 } },
  { key: 'cb2', rel: { x: 5.5, y: 18 } },
  { key: 'fs', rel: { x: 12, y: -6 } },
  { key: 'ss', rel: { x: 10, y: 6 } },
]

export const DEFENSIVE_VISUAL_TEMPLATES: Record<string, DefensiveVisualTemplate> = {
  four_three_base: {
    id: 'four_three_base',
    defenderSlots: baseSlots,
    deepZones: [
      z('deep_l', [
        { x: 8, y: -22 },
        { x: 18, y: -18 },
        { x: 16, y: -8 },
        { x: 6, y: -12 },
      ], 'deep', 'Deep L'),
      z('deep_r', [
        { x: 8, y: 22 },
        { x: 18, y: 18 },
        { x: 16, y: 8 },
        { x: 6, y: 12 },
      ], 'deep', 'Deep R'),
    ],
    underneathZones: [
      z('flat_l', [
        { x: 2, y: -20 },
        { x: 8, y: -20 },
        { x: 8, y: -10 },
        { x: 2, y: -10 },
      ], 'underneath', 'Flat L'),
      z('flat_r', [
        { x: 2, y: 20 },
        { x: 8, y: 20 },
        { x: 8, y: 10 },
        { x: 2, y: 10 },
      ], 'underneath', 'Flat R'),
    ],
    manAssignments: [],
    blitzArrows: [],
    runFits: [
      { position: { x: 1.2, y: -5 }, gap: 'B', responsibility: 'Mike' },
      { position: { x: 1.2, y: 5 }, gap: 'C', responsibility: 'Will' },
    ],
  },
  nickel: {
    id: 'nickel',
    defenderSlots: [
      ...baseSlots.slice(0, 4),
      { key: 'lb1', rel: { x: 3.2, y: -6 } },
      { key: 'lb2', rel: { x: 3.5, y: 6 } },
      { key: 'nickel', rel: { x: 4.2, y: -12 } },
      { key: 'cb1', rel: { x: 5.5, y: -18 } },
      { key: 'cb2', rel: { x: 5.5, y: 18 } },
      { key: 'fs', rel: { x: 12, y: -4 } },
      { key: 'ss', rel: { x: 10, y: 6 } },
    ],
    deepZones: [
      z('deep_m', [
        { x: 14, y: -10 },
        { x: 22, y: 0 },
        { x: 14, y: 10 },
      ], 'deep', 'Post safety'),
    ],
    underneathZones: [
      z('curl_flat', [
        { x: 4, y: -14 },
        { x: 10, y: -14 },
        { x: 10, y: -4 },
        { x: 4, y: -4 },
      ], 'underneath', 'Nickel flat'),
    ],
    manAssignments: [],
    blitzArrows: [],
    runFits: [
      { position: { x: 1.1, y: -2 }, gap: 'A', responsibility: 'Nickel' },
    ],
  },
  dime: {
    id: 'dime',
    defenderSlots: [
      { key: 'de1', rel: { x: 1.1, y: -7 } },
      { key: 'dt1', rel: { x: 1.0, y: -3.5 } },
      { key: 'dt2', rel: { x: 1.0, y: 3.5 } },
      { key: 'de2', rel: { x: 1.1, y: 7 } },
      { key: 'dime1', rel: { x: 4.5, y: -14 } },
      { key: 'dime2', rel: { x: 4.5, y: 14 } },
      { key: 'mike', rel: { x: 3.8, y: 0 } },
      { key: 'cb1', rel: { x: 5.5, y: -20 } },
      { key: 'cb2', rel: { x: 5.5, y: 20 } },
      { key: 'fs', rel: { x: 14, y: -5 } },
      { key: 'ss', rel: { x: 12, y: 8 } },
    ],
    deepZones: [
      z('quarter_deep', [
        { x: 16, y: -16 },
        { x: 24, y: -8 },
        { x: 24, y: 8 },
        { x: 16, y: 16 },
      ], 'deep', 'Shell'),
    ],
    underneathZones: [],
    manAssignments: [],
    blitzArrows: [],
    runFits: [],
  },
  goal_line: {
    id: 'goal_line',
    defenderSlots: [
      { key: 'dl1', rel: { x: 0.6, y: -8 } },
      { key: 'dl2', rel: { x: 0.6, y: -4 } },
      { key: 'dl3', rel: { x: 0.6, y: 0 } },
      { key: 'dl4', rel: { x: 0.6, y: 4 } },
      { key: 'dl5', rel: { x: 0.6, y: 8 } },
      { key: 'lb1', rel: { x: 2.2, y: -5 } },
      { key: 'lb2', rel: { x: 2.2, y: 5 } },
      { key: 'cb1', rel: { x: 3, y: -14 } },
      { key: 'cb2', rel: { x: 3, y: 14 } },
      { key: 's1', rel: { x: 4, y: -2 } },
      { key: 's2', rel: { x: 4, y: 2 } },
    ],
    deepZones: [],
    underneathZones: [
      z('goal_box', [
        { x: 0.5, y: -12 },
        { x: 6, y: -12 },
        { x: 6, y: 12 },
        { x: 0.5, y: 12 },
      ], 'underneath', 'Nine-man box'),
    ],
    manAssignments: [],
    blitzArrows: [],
    runFits: [
      { position: { x: 0.8, y: 0 }, gap: 'A', responsibility: 'A-gap' },
      { position: { x: 0.8, y: -4 }, gap: 'B', responsibility: 'B-gap' },
    ],
  },
  cover_2_zone: {
    id: 'cover_2_zone',
    defenderSlots: baseSlots,
    deepZones: [
      z('c2_l', [
        { x: 10, y: -24 },
        { x: 22, y: -10 },
        { x: 12, y: -6 },
      ], 'deep', 'Deep half L'),
      z('c2_r', [
        { x: 10, y: 24 },
        { x: 22, y: 10 },
        { x: 12, y: 6 },
      ], 'deep', 'Deep half R'),
    ],
    underneathZones: [
      z('hook_l', [
        { x: 4, y: -16 },
        { x: 10, y: -16 },
        { x: 10, y: -6 },
        { x: 4, y: -6 },
      ], 'underneath', 'Hook L'),
      z('hook_r', [
        { x: 4, y: 16 },
        { x: 10, y: 16 },
        { x: 10, y: 6 },
        { x: 4, y: 6 },
      ], 'underneath', 'Hook R'),
    ],
    manAssignments: [],
    blitzArrows: [],
    runFits: [{ position: { x: 1.2, y: 0 }, gap: 'A', responsibility: 'Spill' }],
  },
  cover_3_sky: {
    id: 'cover_3_sky',
    defenderSlots: [
      ...baseSlots.slice(0, 9),
      { key: 'fs', rel: { x: 14, y: 0 } },
      { key: 'ss', rel: { x: 8, y: 10 } },
    ],
    deepZones: [
      z('c3_deep_l', [
        { x: 12, y: -22 },
        { x: 20, y: -8 },
        { x: 10, y: -6 },
      ], 'deep', 'Deep 1/3 L'),
      z('c3_deep_m', [
        { x: 16, y: -6 },
        { x: 24, y: 0 },
        { x: 16, y: 6 },
      ], 'deep', 'Deep middle'),
      z('c3_deep_r', [
        { x: 12, y: 22 },
        { x: 20, y: 8 },
        { x: 10, y: 6 },
      ], 'deep', 'Deep 1/3 R'),
    ],
    underneathZones: [
      z('curl_flat_c3', [
        { x: 4, y: -12 },
        { x: 9, y: -12 },
        { x: 9, y: -4 },
        { x: 4, y: -4 },
      ], 'underneath', 'Flat'),
    ],
    manAssignments: [],
    blitzArrows: [],
    runFits: [],
  },
  cover_4_quarters: {
    id: 'cover_4_quarters',
    defenderSlots: baseSlots,
    deepZones: [
      z('q1', [
        { x: 14, y: -22 },
        { x: 22, y: -14 },
        { x: 14, y: -10 },
      ], 'deep', 'Q1'),
      z('q2', [
        { x: 14, y: -8 },
        { x: 20, y: -2 },
        { x: 14, y: 2 },
      ], 'deep', 'Q2'),
      z('q3', [
        { x: 14, y: 8 },
        { x: 20, y: 2 },
        { x: 14, y: -2 },
      ], 'deep', 'Q3'),
      z('q4', [
        { x: 14, y: 22 },
        { x: 22, y: 14 },
        { x: 14, y: 10 },
      ], 'deep', 'Q4'),
    ],
    underneathZones: [],
    manAssignments: [],
    blitzArrows: [],
    runFits: [],
  },
  cover_1_man: {
    id: 'cover_1_man',
    defenderSlots: baseSlots,
    deepZones: [
      {
        id: 'post',
        corners: [
          { x: 18, y: -8 },
          { x: 24, y: 0 },
          { x: 18, y: 8 },
        ],
        depth: 'deep',
        label: 'Post',
      },
    ],
    underneathZones: [],
    manAssignments: [
      {
        defenderSlot: 'cb1',
        from: { x: 5.5, y: -18 },
        to: { x: 2, y: -16 },
      },
      {
        defenderSlot: 'cb2',
        from: { x: 5.5, y: 18 },
        to: { x: 2, y: 16 },
      },
      {
        defenderSlot: 'ss',
        from: { x: 10, y: 6 },
        to: { x: 3, y: 8 },
      },
    ],
    blitzArrows: [],
    runFits: [],
  },
  cover_0_blitz: {
    id: 'cover_0_blitz',
    defenderSlots: baseSlots.map((s) =>
      s.key === 'fs'
        ? { key: 'fs', rel: { x: 6, y: -4 } }
        : s.key === 'ss'
          ? { key: 'ss', rel: { x: 6, y: 4 } }
          : s,
    ),
    deepZones: [],
    underneathZones: [],
    manAssignments: [
      { defenderSlot: 'cb1', from: { x: 5.5, y: -18 }, to: { x: 0.5, y: -16 } },
      { defenderSlot: 'cb2', from: { x: 5.5, y: 18 }, to: { x: 0.5, y: 16 } },
    ],
    blitzArrows: [
      { from: { x: 3.5, y: 0 }, to: { x: -1.5, y: 0 }, rusherSlot: 'mike' },
      { from: { x: 3.2, y: -8 }, to: { x: -0.5, y: -2 }, rusherSlot: 'sam' },
    ],
    runFits: [{ position: { x: 1, y: 0 }, gap: 'A', responsibility: 'Blitz' }],
  },
  tampa_2: {
    id: 'tampa_2',
    defenderSlots: baseSlots,
    deepZones: [
      z('t2_m', [
        { x: 16, y: -10 },
        { x: 26, y: 0 },
        { x: 16, y: 10 },
      ], 'deep', 'MIKE drop middle'),
      z('t2_l', [
        { x: 12, y: -22 },
        { x: 20, y: -12 },
        { x: 10, y: -8 },
      ], 'deep', 'Deep half L'),
      z('t2_r', [
        { x: 12, y: 22 },
        { x: 20, y: 12 },
        { x: 10, y: 8 },
      ], 'deep', 'Deep half R'),
    ],
    underneathZones: [
      z('under_t2', [
        { x: 4, y: -10 },
        { x: 10, y: -10 },
        { x: 10, y: 10 },
        { x: 4, y: 10 },
      ], 'underneath', 'Under'),
    ],
    manAssignments: [],
    blitzArrows: [],
    runFits: [],
  },
  run_blitz: {
    id: 'run_blitz',
    defenderSlots: baseSlots.map((s) =>
      s.key === 'mike' ? { key: 'mike', rel: { x: 1.8, y: 0 } } : s,
    ),
    deepZones: [],
    underneathZones: [],
    manAssignments: [],
    blitzArrows: [
      { from: { x: 3.5, y: -6 }, to: { x: 0.5, y: -2 }, rusherSlot: 'sam' },
      { from: { x: 3.5, y: 6 }, to: { x: 0.5, y: 2 }, rusherSlot: 'will' },
    ],
    runFits: [
      { position: { x: 1.2, y: -4 }, gap: 'B', responsibility: 'Fill' },
      { position: { x: 1.2, y: 4 }, gap: 'C', responsibility: 'Fill' },
    ],
  },
  prevent: {
    id: 'prevent',
    defenderSlots: baseSlots.map((s) =>
      /fs|ss|cb/.test(s.key)
        ? { ...s, rel: { x: s.rel.x + 8, y: s.rel.y * 1.05 } }
        : s,
    ),
    deepZones: [
      z('prev_shell', [
        { x: 22, y: -28 },
        { x: 32, y: -14 },
        { x: 32, y: 14 },
        { x: 22, y: 28 },
      ], 'deep', 'Prevent shell'),
    ],
    underneathZones: [],
    manAssignments: [],
    blitzArrows: [],
    runFits: [],
  },
}

export function getDefensiveVisualTemplate(id: string): DefensiveVisualTemplate {
  return DEFENSIVE_VISUAL_TEMPLATES[id] ?? DEFENSIVE_VISUAL_TEMPLATES.four_three_base
}

/** Map field polylines for LOS / first down (absolute x). */
export function buildScrimmageLines(los: number, firstDownX: number | null): import('./geometryTypes').FieldPolyline[] {
  const lines: import('./geometryTypes').FieldPolyline[] = [
    {
      id: 'los',
      kind: 'los',
      label: 'LOS',
      points: [
        { x: los, y: -34 },
        { x: los, y: 34 },
      ],
    },
  ]
  if (firstDownX != null) {
    lines.push({
      id: 'fd',
      kind: 'fd',
      label: '1st',
      points: [
        { x: firstDownX, y: -34 },
        { x: firstDownX, y: 34 },
      ],
    })
  }
  return lines
}

function absVec(los: number, v: Vec2): Vec2 {
  return { x: los + v.x, y: v.y }
}

export function templateToAbsoluteZones(los: number, t: DefensiveVisualTemplate): ZoneHull[] {
  return [...t.deepZones, ...t.underneathZones].map((z) => ({
    ...z,
    corners: z.corners.map((c) => absVec(los, c)),
  }))
}

export function templateToAbsoluteMan(los: number, t: DefensiveVisualTemplate): ManCoverageEdge[] {
  return t.manAssignments.map((m) => ({
    ...m,
    from: absVec(los, m.from),
    to: absVec(los, m.to),
  }))
}

export function templateToAbsoluteBlitz(los: number, t: DefensiveVisualTemplate): BlitzArrow[] {
  return t.blitzArrows.map((b) => ({
    ...b,
    from: absVec(los, b.from),
    to: absVec(los, b.to),
  }))
}

export function templateToAbsoluteRunFits(los: number, t: DefensiveVisualTemplate): RunFitIndicator[] {
  return t.runFits.map((r) => ({
    ...r,
    position: absVec(los, r.position),
  }))
}
