import type { Coordinate } from "../domain/routeMetrics";

export type SupportPointType = "起终点" | "补给" | "医疗" | "停车";
export type ServiceLevel = "A" | "B" | "C";

export interface SupportPoint {
  id: string;
  name: string;
  type: SupportPointType;
  routeId: string;
  serviceLevel: ServiceLevel;
  coordinate: Coordinate;
}

export interface SupportPointSummary {
  total: number;
  byType: Partial<Record<SupportPointType, number>>;
  topServiceLevel: ServiceLevel | "无";
}

const serviceLevelRank: Record<ServiceLevel, number> = {
  A: 3,
  B: 2,
  C: 1
};

export const supportPoints: SupportPoint[] = [
  {
    id: "start-river-loop",
    name: "两江四岸起终点",
    type: "起终点",
    routeId: "river-loop",
    serviceLevel: "A",
    coordinate: [114.292, 30.584]
  },
  {
    id: "supply-river-01",
    name: "汉口江滩补给点",
    type: "补给",
    routeId: "river-loop",
    serviceLevel: "A",
    coordinate: [114.31, 30.602]
  },
  {
    id: "medical-river-01",
    name: "两江四岸医疗点",
    type: "医疗",
    routeId: "river-loop",
    serviceLevel: "A",
    coordinate: [114.338, 30.589]
  },
  {
    id: "start-east-lake",
    name: "东湖绿道起终点",
    type: "起终点",
    routeId: "east-lake",
    serviceLevel: "A",
    coordinate: [114.365, 30.548]
  },
  {
    id: "supply-east-01",
    name: "东湖绿道补给点",
    type: "补给",
    routeId: "east-lake",
    serviceLevel: "B",
    coordinate: [114.414, 30.569]
  },
  {
    id: "parking-east-01",
    name: "东湖绿道停车保障点",
    type: "停车",
    routeId: "east-lake",
    serviceLevel: "B",
    coordinate: [114.381, 30.534]
  },
  {
    id: "start-urban-core",
    name: "城市核心起终点",
    type: "起终点",
    routeId: "urban-core",
    serviceLevel: "A",
    coordinate: [114.265, 30.565]
  },
  {
    id: "medical-urban-01",
    name: "城市核心医疗点",
    type: "医疗",
    routeId: "urban-core",
    serviceLevel: "A",
    coordinate: [114.285, 30.592]
  },
  {
    id: "parking-urban-01",
    name: "城市核心停车保障点",
    type: "停车",
    routeId: "urban-core",
    serviceLevel: "A",
    coordinate: [114.298, 30.561]
  },
  {
    id: "start-wuhan-2026",
    name: "沿江大道三阳路口起点",
    type: "起终点",
    routeId: "wuhan-marathon-2026",
    serviceLevel: "A",
    coordinate: [114.302, 30.604]
  },
  {
    id: "supply-wuhan-2026-hankou",
    name: "汉口沿江补给点",
    type: "补给",
    routeId: "wuhan-marathon-2026",
    serviceLevel: "A",
    coordinate: [114.289, 30.584]
  },
  {
    id: "medical-wuhan-2026-bridge",
    name: "长江大桥医疗保障点",
    type: "医疗",
    routeId: "wuhan-marathon-2026",
    serviceLevel: "A",
    coordinate: [114.286, 30.545]
  },
  {
    id: "supply-wuhan-2026-east-lake",
    name: "东湖绿道补给点",
    type: "补给",
    routeId: "wuhan-marathon-2026",
    serviceLevel: "A",
    coordinate: [114.407, 30.548]
  },
  {
    id: "parking-wuhan-2026-qingshan",
    name: "青山终点停车接驳点",
    type: "停车",
    routeId: "wuhan-marathon-2026",
    serviceLevel: "B",
    coordinate: [114.398, 30.623]
  },
  {
    id: "finish-wuhan-2026",
    name: "青山江滩终点",
    type: "起终点",
    routeId: "wuhan-marathon-2026",
    serviceLevel: "A",
    coordinate: [114.395, 30.635]
  }
];

export function getSupportPointsForRoute(routeId: string, points = supportPoints): SupportPoint[] {
  return points.filter((point) => point.routeId === routeId);
}

export function getSupportPointSummary(routeId: string, points = supportPoints): SupportPointSummary {
  const routePoints = getSupportPointsForRoute(routeId, points);
  const byType = routePoints.reduce<Partial<Record<SupportPointType, number>>>((summary, point) => {
    summary[point.type] = (summary[point.type] ?? 0) + 1;
    return summary;
  }, {});
  const topServiceLevel = routePoints
    .map((point) => point.serviceLevel)
    .sort((a, b) => serviceLevelRank[b] - serviceLevelRank[a])[0] ?? "无";

  return {
    total: routePoints.length,
    byType,
    topServiceLevel
  };
}
