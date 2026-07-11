import { describe, expect, it } from "vitest";
import { addEdge, addNode, createEmptyGraph, type RoadGraph } from "./roadNetwork";
import { searchMarathonRoutes } from "./routeSearch";
import type { Coordinate } from "./routeMetrics";

function cycleGraph(edgeKm = 1.005): RoadGraph {
  const graph = createEmptyGraph();
  const coordinates: Coordinate[] = [];
  for (let index = 0; index < 42; index++) {
    const angle = (Math.PI * 2 * index) / 42;
    const coordinate: Coordinate = [114.3 + Math.cos(angle) * 0.06, 30.6 + Math.sin(angle) * 0.06];
    coordinates.push(coordinate);
    addNode(graph, { id: `n${index}`, coordinate });
  }

  for (let index = 0; index < 42; index++) {
    const next = (index + 1) % 42;
    addEdge(graph, {
      id: `cycle-${String(index).padStart(2, "0")}`,
      physicalEdgeId: `cycle-${String(index).padStart(2, "0")}`,
      fromNodeId: `n${index}`,
      toNodeId: `n${next}`,
      lengthKm: edgeKm,
      roadLevel: "primary",
      isBridge: false,
      isTunnel: false,
      competitionSuitable: true,
      baselineCost: edgeKm,
      slopeMean: 1,
      terrainMeasured: true,
      surfaceSuitable: true,
      coordinates: [coordinates[index], coordinates[next]]
    });
  }

  addEdge(graph, {
    id: "steep-shortcut",
    physicalEdgeId: "steep-shortcut",
    fromNodeId: "n0",
    toNodeId: "n20",
    lengthKm: 2,
    roadLevel: "primary",
    isBridge: false,
    isTunnel: false,
    competitionSuitable: true,
    baselineCost: 2,
    slopeMean: 6,
    terrainMeasured: true,
    surfaceSuitable: true,
    coordinates: [coordinates[0], coordinates[20]]
  });
  return graph;
}

describe("searchMarathonRoutes", () => {
  it("finds a deterministic simple marathon loop without repeated physical roads", () => {
    const graph = cycleGraph();
    const start = graph.nodes.get("n0")!.coordinate;
    const first = searchMarathonRoutes(graph, {
      startPoint: start,
      endPoint: start,
      objective: "race-fast",
      maxRoutes: 1,
      maxExpandedStates: 20_000
    });
    const second = searchMarathonRoutes(graph, {
      startPoint: start,
      endPoint: start,
      objective: "race-fast",
      maxRoutes: 1,
      maxExpandedStates: 20_000
    });

    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    if (!first.ok) return;
    expect(first.routes).toHaveLength(1);
    expect(first.routes[0].totalLengthKm).toBeGreaterThanOrEqual(42.195);
    expect(first.routes[0].totalLengthKm).toBeLessThanOrEqual(42.237);
    expect(new Set(first.routes[0].physicalEdgeIds).size).toBe(first.routes[0].physicalEdgeIds.length);
    expect(first.routes[0].physicalEdgeIds).not.toContain("steep-shortcut");
  });

  it("rejects endpoints farther apart than half the marathon distance before searching", () => {
    const graph = cycleGraph();
    const result = searchMarathonRoutes(graph, {
      startPoint: [114, 30.6],
      endPoint: [114.3, 30.6],
      objective: "operations"
    });

    expect(result).toMatchObject({ ok: false, code: "endpoint-separation", expandedStates: 0 });
  });

  it("returns a structured failure when no simple path can reach marathon distance", () => {
    const graph = createEmptyGraph();
    addNode(graph, { id: "a", coordinate: [114.3, 30.6] });
    addNode(graph, { id: "b", coordinate: [114.31, 30.6] });
    addEdge(graph, {
      id: "short",
      fromNodeId: "a",
      toNodeId: "b",
      lengthKm: 1,
      roadLevel: "primary",
      isBridge: false,
      isTunnel: false,
      competitionSuitable: true,
      baselineCost: 1,
      slopeMean: 1
    });

    const result = searchMarathonRoutes(graph, {
      startPoint: [114.3, 30.6],
      endPoint: [114.3, 30.6],
      objective: "city-experience",
      maxExpandedStates: 1_000
    });

    expect(result).toMatchObject({ ok: false, code: "no-compliant-route" });
  });
});
