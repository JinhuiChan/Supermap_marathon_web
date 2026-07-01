import { describe, expect, it } from "vitest";
import { buildTestGraph } from "../data/testGraph";
import { generateRoutes } from "./routeGenerator";
import { pathToMarathonRoute } from "./routeReconstruct";
import { compareRoutes } from "./routeMetrics";
import type { RouteConstraints } from "./routeConstraints";

const constraints: RouteConstraints = {
  startPoint: [114.302, 30.604],
  endPoint: [114.302, 30.604],
  mustPassPoints: [
    [114.286, 30.545],
    [114.41, 30.56]
  ],
  avoidZones: [],
  targetDistanceKm: 42.195
};

describe("routeGenerator", () => {
  it("generates routes with valid MarathonRoute shape", () => {
    const graph = buildTestGraph();
    const paths = generateRoutes(graph, constraints, { count: 1, seed: 42, maxIterations: 10 });

    // Even if it can't find perfect 42km routes, it should not crash
    expect(Array.isArray(paths)).toBe(true);

    if (paths.length > 0) {
      const route = pathToMarathonRoute(paths[0], graph, 0);
      expect(route.id).toBeTruthy();
      expect(route.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(route.lengthKm).toBeGreaterThan(0);
      expect(route.metrics.totalClimbM).toBeGreaterThanOrEqual(0);
      expect(route.metrics.supplyCoverageRatio).toBeGreaterThan(0);
      expect(route.metrics.supplyCoverageRatio).toBeLessThanOrEqual(1);
    }
  });

  it("respects the same seed producing same routes", () => {
    const graph = buildTestGraph();
    const a = generateRoutes(graph, constraints, { count: 1, seed: 99, maxIterations: 5 });
    const b = generateRoutes(graph, constraints, { count: 1, seed: 99, maxIterations: 5 });

    expect(a.length).toBe(b.length);
    if (a.length > 0 && b.length > 0) {
      expect(a[0].totalLengthKm).toBeCloseTo(b[0].totalLengthKm, 1);
    }
  });

  it("generated routes pass through scoring pipeline", () => {
    const graph = buildTestGraph();
    const paths = generateRoutes(graph, constraints, { count: 4, seed: 42, maxIterations: 30 });

    if (paths.length >= 2) {
      const routes = paths.map((p, i) => pathToMarathonRoute(p, graph, i));
      const scores = compareRoutes(routes);
      expect(scores.length).toBe(routes.length);

      // best route should have a recommendation score
      expect(scores[0].recommendationScore).toBeGreaterThan(0);
      expect(scores[0].rank).toBe(1);
    }
  });

  it("graph has enough connectivity to search", () => {
    const graph = buildTestGraph();
    // graph should be large enough to theoretically find 42km paths
    const stats = { nodeCount: graph.nodes.size, edgeCount: graph.edges.size };
    expect(stats.nodeCount).toBeGreaterThan(50);
    expect(stats.edgeCount).toBeGreaterThan(80);
  });
});
