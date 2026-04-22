import type { DefensiveCall, OffensiveFormationId, PlayCategory } from '../footballTypes'
import type { FieldPolyline } from './geometryTypes'
import {
  buildScrimmageLines,
  getDefensiveVisualTemplate,
  templateToAbsoluteBlitz,
  templateToAbsoluteMan,
  templateToAbsoluteRunFits,
  templateToAbsoluteZones,
} from './defensiveVisuals'
import { buildOffensivePreviewLines } from './playRouteGeometry'

export type PreSnapPreviewPayload = {
  offensePolylines: FieldPolyline[]
  zoneHulls: ReturnType<typeof templateToAbsoluteZones>
  manEdges: ReturnType<typeof templateToAbsoluteMan>
  blitzArrows: ReturnType<typeof templateToAbsoluteBlitz>
  runFits: ReturnType<typeof templateToAbsoluteRunFits>
  lineOfScrimmageX: number
  firstDownX: number | null
  labels: { offense?: string; defense?: string }
}

export function buildPreSnapPreview(opts: {
  los: number
  yardsToGo: number
  offenseFormationId: OffensiveFormationId
  offensePlayId: string
  offenseCategory: PlayCategory
  /** When null, defensive overlays are omitted (user picking offense). */
  defenseCall: DefensiveCall | null
  /** When false, skip receiver/run preview polylines (user is picking defense; offense concept hidden). */
  includeOffenseRoutePreview?: boolean
  labels?: { offense?: string; defense?: string }
}): PreSnapPreviewPayload {
  const firstDownX = Math.min(99, opts.los + opts.yardsToGo)
  const scrim = buildScrimmageLines(opts.los, firstDownX)
  const includeRoutes = opts.includeOffenseRoutePreview !== false
  const routes = includeRoutes
    ? buildOffensivePreviewLines(
        opts.los,
        opts.offenseFormationId,
        opts.offensePlayId,
        opts.offenseCategory,
      )
    : []

  const empty = {
    zoneHulls: [] as PreSnapPreviewPayload['zoneHulls'],
    manEdges: [] as PreSnapPreviewPayload['manEdges'],
    blitzArrows: [] as PreSnapPreviewPayload['blitzArrows'],
    runFits: [] as PreSnapPreviewPayload['runFits'],
  }

  if (!opts.defenseCall) {
    return {
      offensePolylines: [...scrim, ...routes],
      ...empty,
      lineOfScrimmageX: opts.los,
      firstDownX,
      labels: opts.labels ?? {},
    }
  }

  const t = getDefensiveVisualTemplate(opts.defenseCall.visualTemplateId)
  return {
    offensePolylines: [...scrim, ...routes],
    zoneHulls: templateToAbsoluteZones(opts.los, t),
    manEdges: templateToAbsoluteMan(opts.los, t),
    blitzArrows: templateToAbsoluteBlitz(opts.los, t),
    runFits: templateToAbsoluteRunFits(opts.los, t),
    lineOfScrimmageX: opts.los,
    firstDownX,
    labels: opts.labels ?? {},
  }
}
