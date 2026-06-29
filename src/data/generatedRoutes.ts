import type { MarathonRoute } from "../domain/routeMetrics";
import type { RouteConstraints } from "../domain/routeConstraints";
import { generateRoutes } from "../domain/routeGenerator";
import { pathToMarathonRoute } from "../domain/routeReconstruct";
import { buildTestGraph } from "./testGraph";

let cachedGraph: ReturnType<typeof buildTestGraph> | null = null;
let cachedRoutes: MarathonRoute[] | null = null;
let cachedSeed = -1;

function getGraph() {
  if (!cachedGraph) cachedGraph = buildTestGraph();
  return cachedGraph;
}

const defaultConstraints: RouteConstraints = {
  startPoint: [114.302, 30.604], // 沿江大道三阳路口
  endPoint: [114.395, 30.635],   // 青山江滩
  mustPassPoints: [],
  avoidZones: [],
  targetDistanceKm: 42.195
};

export function getOrGenerateRoutes(seed = 42): MarathonRoute[] {
  if (cachedRoutes && cachedSeed === seed) return cachedRoutes;

  const graph = getGraph();
  const paths = generateRoutes(graph, defaultConstraints, {
    count: 4,
    seed,
    maxIterations: 60,
    lengthToleranceKm: 5
  });

  cachedRoutes = paths.map((path, i) => pathToMarathonRoute(path, graph, i));
  cachedSeed = seed;

  return cachedRoutes;
}

export function clearGeneratedRoutesCache(): void {
  cachedRoutes = null;
  cachedSeed = -1;
}
