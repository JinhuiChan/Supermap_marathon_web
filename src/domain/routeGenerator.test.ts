import { describe, expect, it } from "vitest";
import { buildTestGraph } from "../data/testGraph";
import { addEdge, addNode, createEmptyGraph } from "./roadNetwork";
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

  it("uses road-edge slope fields when reconstructing route metrics", () => {
    const graph = createEmptyGraph();
    addNode(graph, { id: "a", coordinate: [114.3, 30.6] });
    addNode(graph, { id: "b", coordinate: [114.31, 30.6] });
    addNode(graph, { id: "c", coordinate: [114.32, 30.6] });
    addEdge(graph, {
      id: "edge-a",
      fromNodeId: "a",
      toNodeId: "b",
      lengthKm: 1,
      roadLevel: "primary",
      isBridge: false,
      isTunnel: false,
      competitionSuitable: true,
      baselineCost: 1.48,
      slopeMean: 6
    });
    addEdge(graph, {
      id: "edge-b",
      fromNodeId: "b",
      toNodeId: "c",
      lengthKm: 1,
      roadLevel: "primary",
      isBridge: false,
      isTunnel: false,
      competitionSuitable: true,
      baselineCost: 1.04,
      slopeMean: 2
    });

    const route = pathToMarathonRoute({ nodeIds: ["a", "b", "c"], edgeIds: ["edge-a", "edge-b"], totalLengthKm: 2 }, graph, 0);

    expect(route.metrics.avgSlopePercent).toBe(0.9);
    expect(route.metrics.maxSlopePercent).toBe(1.3);
    expect(route.metrics.longSteepRatio).toBe(0);
  });

  it("reconstructs display coordinates only from real road edges", () => {
    const graph = createEmptyGraph();
    addNode(graph, { id: "a", coordinate: [114.3, 30.6] });
    addNode(graph, { id: "b", coordinate: [114.31, 30.6] });
    addNode(graph, { id: "c", coordinate: [114.5, 30.8] });
    addEdge(graph, {
      id: "ab",
      fromNodeId: "a",
      toNodeId: "b",
      lengthKm: 1,
      roadLevel: "primary",
      isBridge: false,
      isTunnel: false,
      competitionSuitable: true,
      baselineCost: 1
    });

    const route = pathToMarathonRoute({ nodeIds: ["a", "b", "c"], edgeIds: ["ab"], totalLengthKm: 1 }, graph, 0);

    expect(route.coordinates).toEqual([[114.3, 30.6], [114.31, 30.6]]);
    expect(route.coordinates).not.toContainEqual([114.5, 30.8]);
  });

  it("uses original edge geometry for display when graph nodes are topology-snapped", () => {
    const graph = createEmptyGraph();
    addNode(graph, { id: "a", coordinate: [114.3, 30.6] });
    addNode(graph, { id: "b", coordinate: [114.31, 30.61] });
    addEdge(graph, {
      id: "snapped-ab",
      fromNodeId: "a",
      toNodeId: "b",
      lengthKm: 1,
      roadLevel: "primary",
      isBridge: false,
      isTunnel: false,
      competitionSuitable: true,
      baselineCost: 1,
      coordinates: [[114.3004, 30.6002], [114.3097, 30.6004]]
    });

    const route = pathToMarathonRoute({ nodeIds: ["a", "b"], edgeIds: ["snapped-ab"], totalLengthKm: 1 }, graph, 0);

    expect(route.coordinates).toEqual([[114.3004, 30.6002], [114.3097, 30.6004]]);
  });

  it("counts reverse-edge lengths when generating routes against bidirectional roads", () => {
    const graph = createEmptyGraph();
    addNode(graph, { id: "a", coordinate: [114.3, 30.6] });
    addNode(graph, { id: "b", coordinate: [114.309, 30.6] });
    addEdge(graph, {
      id: "ab",
      fromNodeId: "a",
      toNodeId: "b",
      lengthKm: 1,
      roadLevel: "primary",
      isBridge: false,
      isTunnel: false,
      competitionSuitable: true,
      baselineCost: 1
    });

    const paths = generateRoutes(
      graph,
      {
        startPoint: [114.309, 30.6],
        endPoint: [114.3, 30.6],
        mustPassPoints: [],
        avoidZones: [],
        targetDistanceKm: 1
      },
      { count: 1, seed: 7, maxIterations: 4, lengthToleranceKm: 0.05 }
    );

    expect(paths).toHaveLength(1);
    expect(paths[0].edgeIds).toEqual(["ab_rev"]);
    expect(paths[0].totalLengthKm).toBe(1);
  });
});
