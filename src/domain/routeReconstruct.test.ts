import { describe, expect, it } from "vitest";
import { addEdge, addNode, createEmptyGraph, type RoadEdge } from "./roadNetwork";
import { pathToMarathonRoute } from "./routeReconstruct";

function edge(overrides: Partial<RoadEdge> & Pick<RoadEdge, "id" | "fromNodeId" | "toNodeId">): RoadEdge {
  return {
    lengthKm: 21.1,
    roadLevel: "primary",
    isBridge: false,
    isTunnel: false,
    competitionSuitable: true,
    baselineCost: 21.1,
    physicalEdgeId: overrides.id,
    coordinates: [],
    surfaceSuitable: true,
    terrainMeasured: true,
    slopeMean: 1,
    ...overrides
  };
}

describe("pathToMarathonRoute provenance", () => {
  it("reconstructs only from directed edge geometry and measures its continuity", () => {
    const graph = createEmptyGraph();
    addNode(graph, { id: "a", coordinate: [114.3, 30.6] });
    addNode(graph, { id: "b", coordinate: [114.31, 30.6] });
    addNode(graph, { id: "c", coordinate: [114.32, 30.6] });
    addEdge(graph, edge({
      id: "ab",
      fromNodeId: "a",
      toNodeId: "b",
      coordinates: [[114.3, 30.6], [114.31, 30.6]]
    }));
    addEdge(graph, edge({
      id: "bc",
      fromNodeId: "b",
      toNodeId: "c",
      coordinates: [[114.31, 30.6], [114.32, 30.6]]
    }));

    const route = pathToMarathonRoute({
      nodeIds: ["a", "b", "c"],
      edgeIds: ["ab", "bc"],
      totalLengthKm: 42.2
    }, graph, 0);

    expect(route.coordinates).toEqual([[114.3, 30.6], [114.31, 30.6], [114.32, 30.6]]);
    expect(route.metrics.maxContinuityGapM).toBe(0);
    expect(route.metrics.roadAlignedRatio).toBe(1);
    expect(route.metrics.terrainCoverageRatio).toBe(1);
    expect(route.metrics.unsuitableEdgeCount).toBe(0);
  });

  it("reports a real gap between consecutive source geometries instead of inserting a connector", () => {
    const graph = createEmptyGraph();
    addNode(graph, { id: "a", coordinate: [114.3, 30.6] });
    addNode(graph, { id: "b", coordinate: [114.31, 30.6] });
    addNode(graph, { id: "c", coordinate: [114.32, 30.6] });
    addEdge(graph, edge({
      id: "ab",
      fromNodeId: "a",
      toNodeId: "b",
      coordinates: [[114.3, 30.6], [114.309, 30.6]]
    }));
    addEdge(graph, edge({
      id: "bc",
      fromNodeId: "b",
      toNodeId: "c",
      coordinates: [[114.311, 30.6], [114.32, 30.6]]
    }));

    const route = pathToMarathonRoute({
      nodeIds: ["a", "b", "c"],
      edgeIds: ["ab", "bc"],
      totalLengthKm: 42.2
    }, graph, 0);

    expect(route.coordinates).toEqual([
      [114.3, 30.6], [114.309, 30.6], [114.311, 30.6], [114.32, 30.6]
    ]);
    expect(route.metrics.maxContinuityGapM).toBeGreaterThan(10);
    expect(route.metrics.roadAlignedRatio).toBeLessThan(1);
  });
});
