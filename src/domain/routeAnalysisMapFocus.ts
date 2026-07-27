import type { RouteRiskLocationNote } from "./routeAnalysis";
import type { Coordinate, MarathonRoute } from "./routeMetrics";

export interface AnalysisMapFocus {
  routeId: string;
  issueId: string;
  label: string;
  coordinate: Coordinate;
  mileageLabel: string;
}

export function buildAnalysisMapFocus(route: MarathonRoute, note: RouteRiskLocationNote): AnalysisMapFocus {
  const coordinate = route.coordinates[getCoordinateIndexForIssue(route, note.id)] ?? route.coordinates[0] ?? [0, 0];
  return {
    routeId: route.id,
    issueId: note.id,
    label: `${note.issue} · ${route.name}`,
    coordinate,
    mileageLabel: note.mileageHint
  };
}

function getCoordinateIndexForIssue(route: MarathonRoute, issueId: string): number {
  if (route.coordinates.length <= 1) return 0;
  const ratioByIssue: Record<string, number> = {
    distance: 0.5,
    "max-grade": 0.75,
    "total-climb": 0.7,
    "continuous-steep": 0.75,
    "repeated-road": 0.88,
    backtrack: 0.86,
    "self-intersection": 0.55,
    "local-knot": 0.58,
    "node-revisit": 0.6,
    "parallel-backtrack": 0.72,
    "hairpin-turn": 0.9,
    "sharp-turn-density": 0.28,
    "continuity-gap": 0.5,
    "road-alignment": 0.46,
    "road-suitability": 0.35
  };
  const ratio = ratioByIssue[issueId] ?? 0.5;
  return Math.max(0, Math.min(route.coordinates.length - 1, Math.round((route.coordinates.length - 1) * ratio)));
}
