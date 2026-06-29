import type { Coordinate, MarathonRoute } from "../domain/routeMetrics";

function densifyRoute(coordinates: Coordinate[], maxStepDegrees = 0.003): Coordinate[] {
  const dense: Coordinate[] = [];

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    const segmentSteps = Math.max(
      1,
      Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / maxStepDegrees)
    );

    for (let step = 0; step < segmentSteps; step += 1) {
      const t = step / segmentSteps;
      dense.push([
        Number((start[0] + (end[0] - start[0]) * t).toFixed(6)),
        Number((start[1] + (end[1] - start[1]) * t).toFixed(6))
      ]);
    }
  }

  dense.push(coordinates[coordinates.length - 1]);
  return dense;
}

const officialWuhanMarathon2026: MarathonRoute = {
  id: "wuhan-marathon-2026",
  name: "2026武汉马拉松官方路线（道路级矢量）",
  color: "#005bbb",
  lengthKm: 42.195,
  closedLoop: false,
  coordinates: densifyRoute([
    [114.302, 30.604],
    [114.298, 30.599],
    [114.294, 30.592],
    [114.289, 30.584],
    [114.281, 30.579],
    [114.272, 30.574],
    [114.263, 30.568],
    [114.257, 30.56],
    [114.254, 30.552],
    [114.26, 30.547],
    [114.272, 30.546],
    [114.286, 30.545],
    [114.299, 30.545],
    [114.306, 30.541],
    [114.312, 30.546],
    [114.323, 30.551],
    [114.336, 30.557],
    [114.348, 30.562],
    [114.357, 30.559],
    [114.365, 30.552],
    [114.374, 30.544],
    [114.389, 30.543],
    [114.407, 30.548],
    [114.427, 30.555],
    [114.448, 30.563],
    [114.46, 30.571],
    [114.45, 30.578],
    [114.434, 30.588],
    [114.41, 30.582],
    [114.419, 30.598],
    [114.406, 30.611],
    [114.398, 30.623],
    [114.395, 30.635]
  ]),
  elevationProfile: [
    { km: 0, elevation: 24, slope: 0.2 },
    { km: 5, elevation: 25, slope: 0.3 },
    { km: 10, elevation: 31, slope: 0.8 },
    { km: 15, elevation: 42, slope: 1.4 },
    { km: 20, elevation: 33, slope: -0.7 },
    { km: 25, elevation: 45, slope: 1.1 },
    { km: 30, elevation: 51, slope: 1.0 },
    { km: 35, elevation: 38, slope: -0.9 },
    { km: 42.195, elevation: 28, slope: -0.3 }
  ],
  metrics: {
    totalClimbM: 138,
    avgSlopePercent: 1.1,
    maxSlopePercent: 4.0,
    longSteepRatio: 0.09,
    sharpTurnRatio: 0.14,
    narrowRoadRatio: 0.08,
    supplyCoverageRatio: 0.94,
    medicalAvgIntervalKm: 3.8,
    parkingServiceScore: 86,
    shadeCoverageRatio: 0.58
  }
};

const planningRoutes: MarathonRoute[] = [
  {
    id: "river-loop",
    name: "两江四岸平缓备选线",
    color: "#1f77b4",
    lengthKm: 42.195,
    closedLoop: true,
    coordinates: [
      [114.292, 30.584],
      [114.305, 30.598],
      [114.328, 30.61],
      [114.35, 30.594],
      [114.333, 30.57],
      [114.305, 30.563],
      [114.292, 30.584]
    ],
    elevationProfile: [
      { km: 0, elevation: 24, slope: 0.2 },
      { km: 5, elevation: 26, slope: 0.4 },
      { km: 10, elevation: 28, slope: 0.3 },
      { km: 15, elevation: 30, slope: 0.6 },
      { km: 20, elevation: 27, slope: -0.4 },
      { km: 25, elevation: 25, slope: -0.2 },
      { km: 30, elevation: 29, slope: 0.5 },
      { km: 35, elevation: 27, slope: -0.3 },
      { km: 42.195, elevation: 24, slope: -0.2 }
    ],
    metrics: {
      totalClimbM: 96,
      avgSlopePercent: 0.8,
      maxSlopePercent: 2.7,
      longSteepRatio: 0.05,
      sharpTurnRatio: 0.1,
      narrowRoadRatio: 0.07,
      supplyCoverageRatio: 0.93,
      medicalAvgIntervalKm: 4.1,
      parkingServiceScore: 88,
      shadeCoverageRatio: 0.62
    }
  },
  {
    id: "east-lake",
    name: "东湖绿道景观备选线",
    color: "#2ca02c",
    lengthKm: 42.195,
    closedLoop: true,
    coordinates: [
      [114.365, 30.548],
      [114.395, 30.56],
      [114.43, 30.575],
      [114.45, 30.555],
      [114.418, 30.528],
      [114.382, 30.532],
      [114.365, 30.548]
    ],
    elevationProfile: [
      { km: 0, elevation: 32, slope: 0.3 },
      { km: 5, elevation: 45, slope: 1.8 },
      { km: 10, elevation: 66, slope: 2.4 },
      { km: 15, elevation: 51, slope: -1.6 },
      { km: 20, elevation: 58, slope: 1.2 },
      { km: 25, elevation: 72, slope: 2.1 },
      { km: 30, elevation: 47, slope: -2.3 },
      { km: 35, elevation: 40, slope: -1.1 },
      { km: 42.195, elevation: 32, slope: -0.5 }
    ],
    metrics: {
      totalClimbM: 258,
      avgSlopePercent: 2.1,
      maxSlopePercent: 5.9,
      longSteepRatio: 0.21,
      sharpTurnRatio: 0.16,
      narrowRoadRatio: 0.11,
      supplyCoverageRatio: 0.81,
      medicalAvgIntervalKm: 5.6,
      parkingServiceScore: 78,
      shadeCoverageRatio: 0.76
    }
  },
  {
    id: "urban-core",
    name: "城市核心保障备选线",
    color: "#d62728",
    lengthKm: 42.195,
    closedLoop: true,
    coordinates: [
      [114.27, 30.59],
      [114.292, 30.612],
      [114.322, 30.62],
      [114.35, 30.604],
      [114.345, 30.576],
      [114.31, 30.555],
      [114.276, 30.566],
      [114.27, 30.59]
    ],
    elevationProfile: [
      { km: 0, elevation: 26, slope: 0.2 },
      { km: 5, elevation: 29, slope: 0.5 },
      { km: 10, elevation: 37, slope: 1.2 },
      { km: 15, elevation: 35, slope: -0.3 },
      { km: 20, elevation: 42, slope: 1.3 },
      { km: 25, elevation: 39, slope: -0.6 },
      { km: 30, elevation: 31, slope: -0.7 },
      { km: 35, elevation: 28, slope: -0.4 },
      { km: 42.195, elevation: 26, slope: -0.2 }
    ],
    metrics: {
      totalClimbM: 148,
      avgSlopePercent: 1.2,
      maxSlopePercent: 4.1,
      longSteepRatio: 0.1,
      sharpTurnRatio: 0.23,
      narrowRoadRatio: 0.18,
      supplyCoverageRatio: 0.96,
      medicalAvgIntervalKm: 3.2,
      parkingServiceScore: 92,
      shadeCoverageRatio: 0.48
    }
  }
];

export const demoRoutes: MarathonRoute[] = [officialWuhanMarathon2026, ...planningRoutes];
