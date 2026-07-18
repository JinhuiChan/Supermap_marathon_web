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

  it("reverses display geometry for reverse adjacency edges", () => {
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
      nodeIds: ["c", "b", "a"],
      edgeIds: ["bc_rev", "ab_rev"],
      totalLengthKm: 42.2
    }, graph, 0);

    expect(route.coordinates).toEqual([[114.32, 30.6], [114.31, 30.6], [114.3, 30.6]]);
    expect(route.metrics.maxContinuityGapM).toBe(0);
    expect(route.metrics.roadAlignedRatio).toBe(1);
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

  it("marks neighborhood streets as unsuitable for a full-marathon course", () => {
    const graph = createEmptyGraph();
    addNode(graph, { id: "a", coordinate: [114.3, 30.6] });
    addNode(graph, { id: "b", coordinate: [114.31, 30.6] });
    addEdge(graph, edge({
      id: "ab",
      fromNodeId: "a",
      toNodeId: "b",
      roadLevel: "residential",
      competitionSuitable: false,
      coordinates: [[114.3, 30.6], [114.31, 30.6]]
    }));

    const route = pathToMarathonRoute({
      nodeIds: ["a", "b"],
      edgeIds: ["ab"],
      totalLengthKm: 21.1
    }, graph, 0);

    expect(route.metrics.unsuitableEdgeCount).toBe(1);
  });

  it("ends on the selected final road geometry when the terminal edge is clipped", () => {
    const graph = createEmptyGraph();
    addNode(graph, { id: "a", coordinate: [114.3, 30.6] });
    addNode(graph, { id: "b", coordinate: [114.31, 30.6] });
    addNode(graph, { id: "c", coordinate: [114.32, 30.6] });
    addEdge(graph, edge({
      id: "ab",
      fromNodeId: "a",
      toNodeId: "b",
      lengthKm: 21.1,
      coordinates: [[114.3, 30.6], [114.31, 30.6]]
    }));
    addEdge(graph, edge({
      id: "bc",
      fromNodeId: "b",
      toNodeId: "c",
      lengthKm: 21.2,
      coordinates: [[114.31, 30.6], [114.32, 30.6]]
    }));
    const terminalEdgeFraction = (42.195 - 21.1) / 21.2;

    const route = pathToMarathonRoute({
      nodeIds: ["a", "b", "c"],
      edgeIds: ["ab", "bc"],
      totalLengthKm: 42.195,
      terminalEdgeFraction
    }, graph, 0);

    expect(route.coordinates.at(-1)?.[0]).toBeCloseTo(114.31 + 0.01 * terminalEdgeFraction, 8);
    expect(route.coordinates.at(-1)?.[1]).toBe(30.6);
    expect(route.metrics.roadAlignedRatio).toBe(1);
  });
});
