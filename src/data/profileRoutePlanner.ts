import { buildOsmMarathonCandidateRoutes } from "./osmMarathonRoute";
import type { Coordinate, MarathonRoute, RouteSelectionProfile } from "../domain/routeMetrics";
import { compareRoutes, scoreRouteForProfile } from "../domain/routeMetrics";
import { haversineKm } from "../domain/roadAttributes";

interface ProfileRoutePlan {
  id: string;
  name: string;
  color: string;
  targetDistanceKm: number;
  seedPoints: Coordinate[];
  preferredCandidateIds?: string[];
  note: string;
}

const referenceCorridorPoints: Coordinate[] = [
  [114.302, 30.604],
  [114.29, 30.585],
  [114.286, 30.545],
  [114.34, 30.558],
  [114.407, 30.548],
  [114.46, 30.571],
  [114.395, 30.635]
];

export const profileRoutePlans: Record<RouteSelectionProfile, ProfileRoutePlan> = {
  balanced: {
    id: "profile-balanced",
    name: "综合平衡最优路线",
    color: "#005bbb",
    targetDistanceKm: 42.195,
    seedPoints: [[114.302, 30.604], [114.34, 30.558], [114.434059, 30.596715], [114.365, 30.548]],
    preferredCandidateIds: ["osm-balanced", "osm-main-road", "osm-scenic", "osm-river-scenic"],
    note: "综合平衡目标同时考虑通行条件、保障能力、景观体验和赛事组织可行性。"
  },
  "pb-friendly": {
    id: "profile-pb-friendly",
    name: "PB 竞速最优路线",
    color: "#0f766e",
    targetDistanceKm: 42.195,
    seedPoints: [[114.302, 30.604], [114.34, 30.558], [114.365, 30.548], [114.434059, 30.596715]],
    preferredCandidateIds: ["osm-main-road", "osm-balanced", "osm-scenic"],
    note: "PB 竞速目标优先降低爬升、直角转弯、急转弯、窄路和长坡阻力。"
  },
  "mass-finish": {
    id: "profile-mass-finish",
    name: "大众完赛最优路线",
    color: "#2563eb",
    targetDistanceKm: 42.195,
    seedPoints: [[114.302, 30.604], [114.34, 30.558], [114.434059, 30.596715], [114.365, 30.548]],
    preferredCandidateIds: ["osm-balanced", "osm-main-road", "osm-scenic", "osm-river-scenic"],
    note: "大众完赛目标优先保障稳定通行、补给覆盖和低风险完赛体验。"
  },
  "support-first": {
    id: "profile-support-first",
    name: "保障优先最优路线",
    color: "#d97706",
    targetDistanceKm: 42.195,
    seedPoints: [[114.302, 30.604], [114.34, 30.558], [114.434059, 30.596715], [114.365, 30.548]],
    preferredCandidateIds: ["osm-main-road", "osm-balanced", "osm-river-scenic", "osm-scenic"],
    note: "保障优先目标强化医疗、轨道交通、补给与赛后集散可达性。"
  },
  scenic: {
    id: "profile-scenic",
    name: "城市体验最优路线",
    color: "#16a34a",
    targetDistanceKm: 42.195,
    seedPoints: [[114.434059, 30.596715], [114.365, 30.548], [114.34, 30.558], [114.302, 30.604]],
    preferredCandidateIds: ["osm-scenic", "osm-balanced", "osm-main-road"],
    note: "城市体验目标优先靠近武汉地标、东湖绿道、公园绿地和滨水空间，不要求为桥梁放宽合规规则。"
  },
  "river-scenic": {
    id: "profile-river-scenic",
    name: "跨江风景最优路线",
    color: "#0891b2",
    targetDistanceKm: 42.195,
    seedPoints: [[114.2955, 30.5488], [114.302, 30.604], [114.29, 30.585], [114.34, 30.558], [114.395, 30.635]],
    preferredCandidateIds: ["osm-river-scenic", "osm-scenic", "osm-balanced", "osm-main-road"],
    note: "跨江风景目标优先通过长江桥梁、滨江廊道和城市地标展示段，同时保持赛事通行安全。"
  }
};

export function buildBestRouteForSelectionProfile(
  geojson: unknown,
  profile: RouteSelectionProfile,
  options: { targetDistanceKm?: number; seedPoints?: Coordinate[] } = {}
): MarathonRoute | null {
  const plan = profileRoutePlans[profile];
  const candidates: MarathonRoute[] = [];
  const targetDistanceKm = options.targetDistanceKm ?? plan.targetDistanceKm;
  const seedPoints = options.seedPoints ?? plan.seedPoints;

  for (const seedPoint of seedPoints) {
    const routes = buildOsmMarathonCandidateRoutes(geojson, {
      targetDistanceKm,
      startPoint: seedPoint,
      maxRoutes: 1,
      profileIds: plan.preferredCandidateIds
    });
    candidates.push(...routes);
    if (candidates.length > 0) break;
  }

  const scoredCandidates = orderedPreferredCandidates(candidates, plan.preferredCandidateIds);
  const bestRoute = chooseBestProfileRoute(scoredCandidates.length > 0 ? scoredCandidates : candidates, profile);
  if (!bestRoute) return null;

  return {
    ...bestRoute,
    id: plan.id,
    name: plan.name,
    color: plan.color,
    lineage: {
      source: "osm-generated",
      roadAligned: true,
      note: `${plan.note} 候选线由原 OSM 道路生成算法产生，并用公开比赛路线的关键廊道特征进行相似度校核；坐标仍来自道路矢量边，不采用错误的官方道路级矢量路线。`
    }
  };
}

function chooseBestProfileRoute(routes: MarathonRoute[], profile: RouteSelectionProfile): MarathonRoute | null {
  const eligibleRoutes = profile === "river-scenic"
    ? routes.filter((route) => route.metrics.wuhanYangtzeBridgePassed === true)
    : routes;
  if (eligibleRoutes.length === 0) return null;

  const ranked = [...eligibleRoutes]
    .map((route) => ({
      route,
      score: scoreRouteForProfile(route, profile).profileScore + corridorSimilarityScore(route) * corridorWeight(profile)
    }))
    .sort((a, b) => b.score - a.score || compareRoutes([a.route, b.route], profile)[0].id.localeCompare(a.route.id));

  return ranked[0].route;
}

function corridorWeight(profile: RouteSelectionProfile): number {
  if (profile === "scenic") return 0.5;
  if (profile === "river-scenic") return 0.46;
  if (profile === "pb-friendly") return 0.22;
  return 0.34;
}

function corridorSimilarityScore(route: MarathonRoute): number {
  if (route.coordinates.length < 2) return 0;

  const covered = referenceCorridorPoints.filter((point) => distanceFromPointToRouteKm(point, route.coordinates) <= 1.6).length;
  const startBonus = haversineKm(route.coordinates[0], referenceCorridorPoints[0]) <= 1.6 ? 1 : 0;
  return Math.round(((covered + startBonus) / (referenceCorridorPoints.length + 1)) * 100);
}

function distanceFromPointToRouteKm(point: Coordinate, coordinates: Coordinate[]): number {
  return coordinates.reduce((nearest, coordinate) => Math.min(nearest, haversineKm(point, coordinate)), Number.POSITIVE_INFINITY);
}

function orderedPreferredCandidates(routes: MarathonRoute[], preferredIds: string[] | undefined): MarathonRoute[] {
  if (!preferredIds || preferredIds.length === 0) return [];

  const output: MarathonRoute[] = [];
  for (const preferredId of preferredIds) {
    output.push(...routes.filter((route) => route.id === preferredId));
  }
  return output;
}
