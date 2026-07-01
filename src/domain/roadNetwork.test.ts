import { describe, expect, it } from "vitest";
import { addEdge, addNode, createEmptyGraph, graphStats } from "./roadNetwork";

describe("roadNetwork", () => {
  it("creates an empty graph", () => {
    const g = createEmptyGraph();
    expect(g.nodes.size).toBe(0);
    expect(g.edges.size).toBe(0);
    expect(g.adjacency.size).toBe(0);
  });

  it("adds nodes and builds adjacency entries", () => {
    const g = createEmptyGraph();
    addNode(g, { id: "n1", coordinate: [114.3, 30.6] });
    addNode(g, { id: "n2", coordinate: [114.31, 30.61] });

    expect(g.nodes.size).toBe(2);
    expect(g.adjacency.get("n1")).toEqual([]);
    expect(g.adjacency.get("n2")).toEqual([]);
  });

  it("adds bidirectional edges", () => {
    const g = createEmptyGraph();
    addNode(g, { id: "n1", coordinate: [114.3, 30.6] });
    addNode(g, { id: "n2", coordinate: [114.31, 30.61] });

    addEdge(g, {
      id: "e1",
      fromNodeId: "n1",
      toNodeId: "n2",
      lengthKm: 1.2,
      roadLevel: "primary",
      isBridge: false,
      isTunnel: false,
      competitionSuitable: true,
      baselineCost: 1.2
    });

    expect(g.edges.size).toBe(1);
    // forward direction
    const n1Out = g.adjacency.get("n1")!;
    expect(n1Out).toHaveLength(1);
    expect(n1Out[0].fromNodeId).toBe("n1");
    expect(n1Out[0].toNodeId).toBe("n2");

    // reverse direction auto-added
    const n2Out = g.adjacency.get("n2")!;
    expect(n2Out).toHaveLength(1);
    expect(n2Out[0].fromNodeId).toBe("n2");
    expect(n2Out[0].toNodeId).toBe("n1");
    expect(n2Out[0].id).toBe("e1_rev");
  });

  it("computes graph stats", () => {
    const g = createEmptyGraph();
    addNode(g, { id: "a", coordinate: [114.3, 30.6] });
    addNode(g, { id: "b", coordinate: [114.31, 30.61] });
    addEdge(g, {
      id: "e1",
      fromNodeId: "a",
      toNodeId: "b",
      lengthKm: 2.5,
      roadLevel: "trunk",
      isBridge: false,
      isTunnel: false,
      competitionSuitable: true,
      baselineCost: 2.5
    });

    const stats = graphStats(g);
    expect(stats.nodeCount).toBe(2);
    expect(stats.edgeCount).toBe(1);
    expect(stats.totalKm).toBeCloseTo(2.5);
  });
});
