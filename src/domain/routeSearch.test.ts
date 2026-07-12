import { describe, expect, it } from "vitest";
import { addEdge, addNode, createEmptyGraph, type RoadGraph } from "./roadNetwork";
import { objectiveEdgeScore, searchMarathonRoutes } from "./routeSearch";
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
  it("scores road quality per kilometre instead of rewarding fragmented short edges", () => {
    const graph = cycleGraph();
    const oneKilometre = graph.edges.get("cycle-00")!;
    const oneHundredMetres = { ...oneKilometre, id: "short", lengthKm: 0.1, baselineCost: 0.1 };

    expect(objectiveEdgeScore(oneKilometre, "operations") / oneKilometre.lengthKm)
      .toBeCloseTo(objectiveEdgeScore(oneHundredMetres, "operations") / oneHundredMetres.lengthKm, 6);
  });

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

    expect(result).toMatchObject({
      ok: false,
      code: "no-compliant-route",
      diagnostics: { maxReachedKm: 1, maxReachedNodeId: "b" }
    });
  });

  it("may pass through an articulation junction twice without reusing a physical road", () => {
    const graph = createEmptyGraph();
    const junction: Coordinate = [114.3, 30.6];
    addNode(graph, { id: "x", coordinate: junction });

    let previous = "x";
    for (let index = 1; index <= 20; index++) {
      const angle = (Math.PI * 2 * index) / 21;
      const nodeId = `a${index}`;
      const coordinate: Coordinate = [114.29 + Math.cos(angle) * 0.008, 30.6 + Math.sin(angle) * 0.008];
      addNode(graph, { id: nodeId, coordinate });
      addEligibleEdge(graph, `a-edge-${index}`, previous, nodeId, 1.005);
      previous = nodeId;
    }
    addEligibleEdge(graph, "a-edge-21", previous, "x", 1.005);

    previous = "x";
    for (let index = 1; index <= 21; index++) {
      const nodeId = `b${index}`;
      addNode(graph, { id: nodeId, coordinate: [114.3 + index * 0.001, 30.6] });
      addEligibleEdge(graph, `b-edge-${index}`, previous, nodeId, 1.005);
      previous = nodeId;
    }

    const result = searchMarathonRoutes(graph, {
      startPoint: junction,
      endPoint: graph.nodes.get("b21")!.coordinate,
      objective: "operations",
      maxRoutes: 1,
      maxExpandedStates: 20_000
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.routes[0].nodeIds.filter((nodeId) => nodeId === "x")).toHaveLength(2);
    expect(new Set(result.routes[0].physicalEdgeIds).size).toBe(result.routes[0].physicalEdgeIds.length);
  });

  it("keeps raster-slope filtered roads when their calibrated race grade remains acceptable", () => {
    const graph = cycleGraph();
    for (const edges of graph.adjacency.values()) {
      for (const edge of edges) {
        if (edge.physicalEdgeId !== "cycle-10") continue;
        edge.competitionSuitable = false;
        edge.slopeFiltered = true;
        edge.slopeMean = 6;
      }
    }
    const physical = graph.edges.get("cycle-10")!;
    physical.competitionSuitable = false;
    physical.slopeFiltered = true;
    physical.slopeMean = 6;
    const start = graph.nodes.get("n0")!.coordinate;

    const result = searchMarathonRoutes(graph, {
      startPoint: start,
      endPoint: start,
      objective: "race-fast",
      maxRoutes: 1,
      maxExpandedStates: 20_000
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.routes[0].physicalEdgeIds).toContain("cycle-10");
  });

  it("allows a paved five-metre residential road that can be fully closed for the event", () => {
    const graph = cycleGraph();
    for (const edges of graph.adjacency.values()) {
      for (const edge of edges) {
        if (edge.physicalEdgeId !== "cycle-10") continue;
        edge.competitionSuitable = false;
        edge.slopeFiltered = false;
        edge.roadLevel = "residential";
        edge.roadWidthM = 5;
      }
    }
    Object.assign(graph.edges.get("cycle-10")!, {
      competitionSuitable: false,
      slopeFiltered: false,
      roadLevel: "residential",
      roadWidthM: 5
    });
    const start = graph.nodes.get("n0")!.coordinate;

    const result = searchMarathonRoutes(graph, {
      startPoint: start,
      endPoint: start,
      objective: "operations",
      maxRoutes: 1,
      maxExpandedStates: 20_000
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.routes[0].physicalEdgeIds).toContain("cycle-10");
  });

  it("selects a compliant finish dynamically when no finish point is prescribed", () => {
    const graph = createEmptyGraph();
    for (let index = 0; index <= 42; index++) {
      addNode(graph, { id: `n${index}`, coordinate: [114.3 + index * 0.001, 30.6] });
      if (index > 0) addEligibleEdge(graph, `edge-${index}`, `n${index - 1}`, `n${index}`, 1.005);
    }

    const result = searchMarathonRoutes(graph, {
      startPoint: graph.nodes.get("n0")!.coordinate,
      objective: "city-experience",
      maxRoutes: 1,
      maxExpandedStates: 20_000
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.routes[0].nodeIds.at(-1)).toBe("n42");
  });

  it("rejects a compact local knot even when its roads are unique", () => {
    const graph = createEmptyGraph();
    const coordinates: Coordinate[] = [
      [114.3, 30.6],
      [114.303, 30.6],
      [114.303, 30.601],
      [114.3005, 30.601],
      [114.3005, 30.602]
    ];
    while (coordinates.length <= 42) {
      coordinates.push([114.3005 + (coordinates.length - 4) * 0.001, 30.602]);
    }
    coordinates.forEach((coordinate, index) => {
      addNode(graph, { id: `n${index}`, coordinate });
      if (index > 0) addEligibleEdge(graph, `edge-${index}`, `n${index - 1}`, `n${index}`, 1.005);
    });

    const result = searchMarathonRoutes(graph, {
      startPoint: coordinates[0],
      objective: "city-experience",
      maxRoutes: 1,
      maxExpandedStates: 20_000
    });

    expect(result).toMatchObject({ ok: false, code: "no-compliant-route" });
  });
});

function addEligibleEdge(graph: RoadGraph, id: string, fromNodeId: string, toNodeId: string, lengthKm: number) {
  addEdge(graph, {
    id,
    physicalEdgeId: id,
    fromNodeId,
    toNodeId,
    lengthKm,
    roadLevel: "primary",
    isBridge: false,
    isTunnel: false,
    competitionSuitable: true,
    baselineCost: lengthKm,
    slopeMean: 1,
    terrainMeasured: true,
    surfaceSuitable: true,
    coordinates: [graph.nodes.get(fromNodeId)!.coordinate, graph.nodes.get(toNodeId)!.coordinate]
  });
}
