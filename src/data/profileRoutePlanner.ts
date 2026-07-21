import { buildOsmMarathonCandidateRoutes, buildWaypointMarathonRoute } from "./osmMarathonRoute";
import type { Coordinate, MarathonRoute, RouteSelectionProfile } from "../domain/routeMetrics";
import { compareRoutes, scoreRouteForProfile } from "../domain/routeMetrics";
import { evaluateRouteQuality } from "../domain/routeQuality";
import { haversineKm } from "../domain/roadAttributes";

export const waypointHitRadiusKm = 2;

export interface WaypointRoutePlan {
  id: string;
  name: string;
  color: string;
  targetDistanceKm: number;
  waypoints: Array<{ label: string; coordinate: Coordinate }>;
  note: string;
  description: string;
  positioning: string;
  audience: string;
  features: string[];
}

export const waypointRoutePlans: WaypointRoutePlan[] = [
  {
    id: "waypoint-east-lake",
    name: "东湖线",
    color: "#00a86b",
    targetDistanceKm: 42.195,
    description: "竞速PB赛道 · 东湖绿道平缓环湖",
    positioning: "全马竞技冲PB专用，后半程14km东湖绿道平缓环湖，坡少、树荫足、视野开阔，汉马官方全马核心赛段。",
    audience: "专业跑者、破PB选手",
    waypoints: [
      { label: "起点：三阳路沿江大道", coordinate: [114.30230, 30.60287] },
      { label: "江汉路步行街", coordinate: [114.2916, 30.6062] },
      { label: "武胜路·江汉一桥", coordinate: [114.2685, 30.5971] },
      { label: "龟山南路·长江大桥上桥口", coordinate: [114.2701, 30.5583] },
      { label: "黄鹤楼南门·汉阳门江滩", coordinate: [114.3044, 30.5462] },
      { label: "半程分流点·省图书馆书卷路", coordinate: [114.3317, 30.5615] },
      { label: "凌波门·东湖栈道", coordinate: [114.3586, 30.5682] },
      { label: "东湖绿道·湖中道湖心岛", coordinate: [114.3864, 30.5896] },
      { label: "华侨城白马道·湿地公园", coordinate: [114.4012, 30.6018] },
      { label: "仁和路主干道交叉口", coordinate: [114.4163, 30.6105] },
      { label: "终点：青山江滩", coordinate: [114.30933, 30.60991] }
    ],
    note: "22.5~36.5km 完整东湖环湖绿道，路面平整、长缓坡极少，后半程弯道少冲刺友好",
    features: [
      "22.5~36.5km完整东湖环湖绿道，路面平整、长缓坡极少，大量樱花、湖面景观",
      "后半程弯道少，34km后全程平直主干道，冲刺友好",
      "湖风降温，遮阳充足，长距离耐力赛体感更佳"
    ]
  },
  {
    id: "waypoint-riverside",
    name: "滨江线",
    color: "#2563eb",
    targetDistanceKm: 42.195,
    description: "休闲全马 · 两江四岸滨水观光",
    positioning: "全马42.195km观光休闲路线，全程沿长江、汉江两岸江滩主干道，主打江景、城市滨江风光，不进入东湖。",
    audience: "新手、休闲观光跑者、观光游客",
    waypoints: [
      { label: "起点：三阳路沿江大道", coordinate: [114.30230, 30.60287] },
      { label: "汉口江滩·武汉科技馆", coordinate: [114.3061, 30.6103] },
      { label: "江汉关钟楼", coordinate: [114.2892, 30.6074] },
      { label: "南岸嘴·两江交汇观景台", coordinate: [114.2667, 30.5921] },
      { label: "龟山·晴川阁", coordinate: [114.2690, 30.5647] },
      { label: "武汉长江大桥·桥面观景段", coordinate: [114.2845, 30.5542] },
      { label: "户部巷·汉阳门码头", coordinate: [114.3038, 30.5470] },
      { label: "武昌临江大道·江滩折返点", coordinate: [114.3195, 30.5524] },
      { label: "沙湖大桥", coordinate: [114.3276, 30.5578] },
      { label: "终点：湖北省图书馆·书卷路", coordinate: [114.3317, 30.5615] }
    ],
    note: "全马滨江观光线，长江+汉江双江景视野，串联三大江滩，难度适中",
    features: [
      "长距离路段临江，长江+汉江双江景视野，无长距离环湖",
      "串联汉口、汉阳、武昌三大江滩，城市滨水天际线尽收眼底",
      "难度适中，主要爬坡集中在跨江桥梁段，适合新手、观光游客"
    ]
  },
  {
    id: "waypoint-city-scenic",
    name: "城市景观线",
    color: "#e85d04",
    targetDistanceKm: 42.195,
    description: "全域文旅 · 三镇地标全覆盖",
    positioning: "文旅打卡专用全马路线，串联武汉历史、工业、自然、现代地标，兼顾老城街巷、大桥、东湖、青山工业滨江。",
    audience: "游客、城市宣传展示、文旅打卡跑者",
    waypoints: [
      { label: "起点：三阳路沿江大道", coordinate: [114.30230, 30.60287] },
      { label: "中山大道·老汉口里份街区", coordinate: [114.2840, 30.6048] },
      { label: "汉正街·商贸老街", coordinate: [114.2725, 30.5943] },
      { label: "晴川阁·知音文化地标", coordinate: [114.2682, 30.5650] },
      { label: "黄鹤楼景区正门", coordinate: [114.2860, 30.5526] },
      { label: "楚河汉街中心栈道", coordinate: [114.3368, 30.5601] },
      { label: "凌波门·东湖网红打卡点", coordinate: [114.3586, 30.5682] },
      { label: "东湖樱花园·磨山景区", coordinate: [114.3742, 30.5830] },
      { label: "欢乐谷·生态湿地", coordinate: [114.3987, 30.5985] },
      { label: "青山红房子·工业文创街区", coordinate: [114.4132, 30.6130] },
      { label: "终点：青山江滩滨江广场", coordinate: [114.30933, 30.60991] }
    ],
    note: "一城两江三镇四桥五湖全覆盖，历史、自然、工业、现代景观分层呈现",
    features: [
      "一城两江三镇四桥五湖全部覆盖，历史、自然、工业、现代景观分层呈现",
      "打卡点位密度最高，兼顾老城烟火、湖光山色、长江天际、工业滨江",
      "起伏均衡，兼具观赏性与赛事完整性，适合城市宣传可视化展示"
    ]
  }
];

export type WaypointRouteId = typeof waypointRoutePlans[number]["id"];

const waypointProfileMap: Record<WaypointRouteId, RouteSelectionProfile> = {
  "waypoint-east-lake": "scenic",
  "waypoint-riverside": "support-first",
  "waypoint-city-scenic": "mass-finish"
};

const waypointProfileSeedPoints: Partial<Record<WaypointRouteId, Coordinate[]>> = {
  "waypoint-east-lake": [
    [114.3044, 30.5462],
    [114.3317, 30.5615],
    [114.4012, 30.6018]
  ],
  "waypoint-riverside": [
    [114.3038, 30.5470]
  ],
  "waypoint-city-scenic": [
    [114.2860, 30.5526]
  ]
};

const waypointCandidateProfileIds: Partial<Record<WaypointRouteId, string[]>> = {
  "waypoint-riverside": ["osm-balanced"],
  "waypoint-city-scenic": ["osm-scenic"]
};

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
    seedPoints: [[114.365, 30.548], [114.34, 30.558], [114.302, 30.604], [114.434059, 30.596715]],
    preferredCandidateIds: ["osm-balanced", "osm-main-road", "osm-river-scenic", "osm-scenic"],
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
  options: { targetDistanceKm?: number; seedPoints?: Coordinate[]; profileIds?: string[]; waypointGuidance?: Coordinate[] } = {}
): MarathonRoute | null {
  const plan = profileRoutePlans[profile];
  const candidates: MarathonRoute[] = [];
  const targetDistanceKm = options.targetDistanceKm ?? plan.targetDistanceKm;
  const seedPoints = options.seedPoints ?? plan.seedPoints;

  for (const seedPoint of seedPoints) {
    const routes = buildOsmMarathonCandidateRoutes(geojson, {
      targetDistanceKm,
      startPoint: seedPoint,
      maxRoutes: options.waypointGuidance ? 4 : 1,
      profileIds: options.profileIds ?? plan.preferredCandidateIds,
      waypointGuidance: options.waypointGuidance
        ? {
            points: options.waypointGuidance,
            hitRadiusKm: waypointHitRadiusKm,
            influenceRadiusKm: 4,
            minHits: 0
          }
        : undefined
    });
    candidates.push(...routes);
    if (candidates.length > 0 && !options.waypointGuidance) break;
  }

  const scoredCandidates = orderedPreferredCandidates(candidates, plan.preferredCandidateIds);
  const bestRoute = chooseBestProfileRoute(scoredCandidates.length > 0 ? scoredCandidates : candidates, profile, options.waypointGuidance);
  if (!bestRoute) return null;

  return {
    ...bestRoute,
    id: plan.id,
    name: plan.name,
    color: plan.color,
    targetDistanceKm,
    lineage: {
      source: "osm-generated",
      roadAligned: true,
      note: `${plan.note} 候选线由原 OSM 道路生成算法产生，并用公开比赛路线的关键廊道特征进行相似度校核；坐标仍来自道路矢量边，不采用错误的官方道路级矢量路线。`
    }
  };
}

function chooseBestProfileRoute(
  routes: MarathonRoute[],
  profile: RouteSelectionProfile,
  waypointGuidance?: Coordinate[]
): MarathonRoute | null {
  const eligibleRoutes = profile === "river-scenic"
    ? routes.filter((route) => route.metrics.wuhanYangtzeBridgePassed === true)
    : routes;
  if (eligibleRoutes.length === 0) return null;

  const ranked = [...eligibleRoutes]
    .map((route) => ({
      route,
      score:
        scoreRouteForProfile(route, profile).profileScore +
        corridorSimilarityScore(route) * corridorWeight(profile) +
        waypointCoverageScore(route, waypointGuidance) * 1.8
    }))
    .sort((a, b) => b.score - a.score || compareRoutes([a.route, b.route], profile)[0].id.localeCompare(a.route.id));

  return ranked[0].route;
}

function waypointCoverageScore(route: MarathonRoute, waypointGuidance: Coordinate[] | undefined): number {
  if (!waypointGuidance?.length) return 0;

  let hitCount = 0;
  let orderedHitCount = 0;
  let lastAlongKm = -Infinity;
  for (const waypoint of waypointGuidance) {
    const hit = nearestRouteHit(waypoint, route.coordinates);
    if (hit.distanceKm > waypointHitRadiusKm) continue;
    hitCount += 1;
    if (hit.alongKm >= lastAlongKm) {
      orderedHitCount += 1;
      lastAlongKm = hit.alongKm;
    }
  }

  return hitCount * 100 + orderedHitCount * 40;
}

function nearestRouteHit(point: Coordinate, coordinates: Coordinate[]): { distanceKm: number; alongKm: number } {
  let nearest = { distanceKm: Number.POSITIVE_INFINITY, alongKm: 0 };
  let walkedKm = 0;

  for (let index = 1; index < coordinates.length; index++) {
    const from = coordinates[index - 1];
    const to = coordinates[index];
    const segmentKm = haversineKm(from, to);
    const projected = projectPointToSegment(point, from, to);
    const distanceKm = haversineKm(point, projected);
    if (distanceKm < nearest.distanceKm) {
      nearest = { distanceKm, alongKm: walkedKm + segmentKm * projectionFraction(point, from, to) };
    }
    walkedKm += segmentKm;
  }

  return nearest;
}

function projectPointToSegment(point: Coordinate, from: Coordinate, to: Coordinate): Coordinate {
  const fraction = projectionFraction(point, from, to);
  return [
    from[0] + (to[0] - from[0]) * fraction,
    from[1] + (to[1] - from[1]) * fraction
  ];
}

function projectionFraction(point: Coordinate, from: Coordinate, to: Coordinate): number {
  const latitude = point[1];
  const pointKm = toPlanarKm(point, latitude);
  const fromKm = toPlanarKm(from, latitude);
  const toKm = toPlanarKm(to, latitude);
  const vectorX = toKm[0] - fromKm[0];
  const vectorY = toKm[1] - fromKm[1];
  const pointX = pointKm[0] - fromKm[0];
  const pointY = pointKm[1] - fromKm[1];
  const denominator = vectorX * vectorX + vectorY * vectorY;
  return denominator === 0
    ? 0
    : Math.max(0, Math.min(1, (pointX * vectorX + pointY * vectorY) / denominator));
}

function toPlanarKm(coordinate: Coordinate, latitude: number): [number, number] {
  const kmPerDegree = 111.32;
  return [
    coordinate[0] * kmPerDegree * Math.cos(latitude * Math.PI / 180),
    coordinate[1] * kmPerDegree
  ];
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

export function buildWaypointRoute(
  geojson: unknown,
  plan: WaypointRoutePlan,
  options: { maxAttempts?: number } = {}
): MarathonRoute | null {
  const seedPoints = [
    ...(waypointProfileSeedPoints[plan.id] ?? profileRoutePlans[waypointProfileMap[plan.id]].seedPoints)
  ];
  const profileRoute = buildBestRouteForSelectionProfile(geojson, waypointProfileMap[plan.id], {
    targetDistanceKm: plan.targetDistanceKm,
    seedPoints,
    profileIds: waypointCandidateProfileIds[plan.id],
    waypointGuidance: plan.waypoints.map((waypoint) => waypoint.coordinate)
  }) ?? buildBestRouteForSelectionProfile(geojson, waypointProfileMap[plan.id], {
    targetDistanceKm: plan.targetDistanceKm,
    seedPoints
  });
  if (profileRoute && evaluateRouteQuality(profileRoute, { targetDistanceKm: plan.targetDistanceKm }).passed) {
    return {
      ...profileRoute,
      id: plan.id,
      name: plan.name,
      color: plan.color,
      targetDistanceKm: plan.targetDistanceKm,
      lineage: {
        ...profileRoute.lineage,
        source: "osm-generated",
        roadAligned: true,
        note: `${plan.note} 路线由严格质量门禁的 OSM 路网搜索生成，途经点仅作为方案主题与走廊提示。`
      }
    };
  }

  const maxAttempts = options.maxAttempts ?? 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const route = buildWaypointMarathonRoute(geojson, {
      waypoints: plan.waypoints.map((wp) => wp.coordinate),
      targetDistanceKm: plan.targetDistanceKm,
      salt: attempt,
      id: plan.id,
      name: plan.name,
      color: plan.color,
      note: plan.note
    });
    if (route) {
      return {
        ...route,
        targetDistanceKm: plan.targetDistanceKm
      };
    }
  }

  return null;
}
