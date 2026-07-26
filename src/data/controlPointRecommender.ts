import type { CityRoutingProfile } from "../config/cityRoutingProfiles";
import type { Coordinate, RouteSelectionProfile } from "../domain/routeMetrics";
import { haversineKm } from "../domain/roadAttributes";
import type { MapPoiLabel } from "../map/layers/PoiLabelLayer";
import type { SupportPoint } from "./supportPoints";
import type { WaypointRoutePlan } from "./profileRoutePlanner";

export interface ControlPointRecommendationInput {
  cityId: string;
  manualRoutePlans: WaypointRoutePlan[];
  landmarks: MapPoiLabel[];
  supportPoints: SupportPoint[];
  routingProfile: CityRoutingProfile;
  selectionProfile?: RouteSelectionProfile;
}

type ControlPointSource = "required-bridge" | "landmark" | "support-point";

interface ControlPointCandidate {
  label: string;
  coordinate: Coordinate;
  source: ControlPointSource;
  score: number;
  reason: string;
}

const autoRouteId = "waypoint-auto-recommended";

export function recommendAutoControlPointRoutePlan(input: ControlPointRecommendationInput): WaypointRoutePlan {
  const anchorPlan = input.manualRoutePlans[0];
  const start = anchorPlan?.waypoints[0];
  const finish = anchorPlan?.waypoints.at(-1);
  if (!start || !finish) {
    throw new Error("At least one manual route plan with start and finish waypoints is required.");
  }

  const selected = selectRecommendedControlPoints(input, start.coordinate, finish.coordinate);
  const ordered = orderByReferenceCorridor(selected, anchorPlan.waypoints.map((waypoint) => waypoint.coordinate));
  const waypoints = [
    { label: start.label, coordinate: cloneCoordinate(start.coordinate) },
    ...ordered.map((candidate) => ({
      label: candidate.label,
      coordinate: cloneCoordinate(candidate.coordinate)
    })),
    { label: finish.label, coordinate: cloneCoordinate(finish.coordinate) }
  ];

  const basis = selected
    .slice()
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "zh-CN"))
    .slice(0, 5)
    .map((candidate) => `${candidate.label}: ${candidate.reason}`);

  return {
    id: autoRouteId,
    name: "自动推荐线",
    color: "#7c3aed",
    targetDistanceKm: 42.195,
    controlPointMode: "auto-recommended",
    controlPointSourceLabel: "系统自动推荐控制点",
    selectionProfile: input.selectionProfile ?? "balanced",
    seedPoints: selected.slice(0, 4).map((candidate) => cloneCoordinate(candidate.coordinate)),
    candidateProfileIds: ["osm-balanced", "osm-scenic", "osm-main-road", "osm-river-scenic"],
    recommendationBasis: basis,
    description: "控制点自动推荐 / 综合保障与城市展示",
    positioning: "由城市包中的地标、保障点和必要过江通道自动推荐控制点，再交给路网生成模型形成候选路线。",
    audience: "评审展示、方案初筛、换城快速出线",
    waypoints,
    note: "自动推荐线用于展示通用选线能力：先推荐控制点，再按综合平衡模式搜索可达路网路线。",
    features: [
      "控制点由城市包数据自动推荐，适合换城后快速生成第一版候选路线",
      "综合考虑城市地标、A级保障点与必要过江通道",
      "保留人工复核入口，生成结果仍进入质量闸门与风险清单"
    ]
  };
}

function selectRecommendedControlPoints(
  input: ControlPointRecommendationInput,
  start: Coordinate,
  finish: Coordinate
): ControlPointCandidate[] {
  const candidates = [
    ...requiredBridgeCandidates(input),
    ...landmarkCandidates(input.landmarks),
    ...supportPointCandidates(input.supportPoints)
  ].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "zh-CN"));

  const selected: ControlPointCandidate[] = [];
  for (const candidate of dedupeCandidates(candidates)) {
    if (selected.length >= 7) break;
    if (haversineKm(candidate.coordinate, start) < 0.7) continue;
    if (haversineKm(candidate.coordinate, finish) < 0.7) continue;
    if (selected.some((point) => haversineKm(point.coordinate, candidate.coordinate) < 0.85)) continue;
    selected.push(candidate);
  }

  return selected;
}

function requiredBridgeCandidates(input: ControlPointRecommendationInput): ControlPointCandidate[] {
  return input.routingProfile.requiredRiverBridges.flatMap((bridge) =>
    input.landmarks
      .filter((landmark) => bridge.namePattern.test(landmark.name) || idTokensMatch(bridge.id, landmark.id))
      .map((landmark) => ({
        label: landmark.name,
        coordinate: landmark.coordinate,
        source: "required-bridge" as const,
        score: 150 + (landmark.priority ?? 0),
        reason: "满足城市跨江赛道的必要通道约束"
      }))
  );
}

function landmarkCandidates(landmarks: MapPoiLabel[]): ControlPointCandidate[] {
  return landmarks.map((landmark) => ({
    label: landmark.name,
    coordinate: landmark.coordinate,
    source: "landmark",
    score: 80 + (landmark.priority ?? 0),
    reason: "城市展示价值高，可增强路线叙事"
  }));
}

function supportPointCandidates(points: SupportPoint[]): ControlPointCandidate[] {
  const serviceBonus: Record<string, number> = { A: 30, B: 18, C: 8 };
  return points.map((point) => ({
    label: point.name,
    coordinate: point.coordinate,
    source: "support-point",
    score: 70 + (serviceBonus[point.serviceLevel] ?? 0),
    reason: `${point.serviceLevel}级保障点，可提升赛事组织可行性`
  }));
}

function dedupeCandidates(candidates: ControlPointCandidate[]): ControlPointCandidate[] {
  const seen = new Set<string>();
  const output: ControlPointCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.coordinate[0].toFixed(4)},${candidate.coordinate[1].toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
  }
  return output;
}

function orderByReferenceCorridor(candidates: ControlPointCandidate[], reference: Coordinate[]): ControlPointCandidate[] {
  return [...candidates].sort((a, b) =>
    nearestReferenceIndex(a.coordinate, reference) - nearestReferenceIndex(b.coordinate, reference) ||
    b.score - a.score
  );
}

function nearestReferenceIndex(coordinate: Coordinate, reference: Coordinate[]): number {
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < reference.length; index++) {
    const currentDistance = haversineKm(coordinate, reference[index]);
    if (currentDistance < distance) {
      nearest = index;
      distance = currentDistance;
    }
  }
  return nearest;
}

function idTokensMatch(ruleId: string, landmarkId: string): boolean {
  const landmark = landmarkId.toLocaleLowerCase();
  const tokens = ruleId.toLocaleLowerCase().split("-").filter((token) =>
    token.length > 3 && token !== "river"
  );
  return tokens.length > 0 && tokens.every((token) => landmark.includes(token));
}

function cloneCoordinate(coordinate: Coordinate): Coordinate {
  return [coordinate[0], coordinate[1]];
}
