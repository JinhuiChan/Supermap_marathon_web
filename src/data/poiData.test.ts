import { describe, expect, test } from "vitest";
import { addEdge, addNode, createEmptyGraph } from "../domain/roadNetwork";
import { snapPoisToEdges } from "./poiData";

describe("poiData", () => {
  test("adds POI scores to the nearest road edge", () => {
    const graph = createEmptyGraph();
    addNode(graph, { id: "a", coordinate: [114.3, 30.6] });
    addNode(graph, { id: "b", coordinate: [114.31, 30.6] });
    addEdge(graph, {
      id: "edge-1",
      fromNodeId: "a",
      toNodeId: "b",
      lengthKm: 1,
      roadLevel: "primary",
      isBridge: false,
      isTunnel: false,
      competitionSuitable: true,
      baselineCost: 1
    });

    snapPoisToEdges(graph, [
      {
        id: "supply-1",
        name: "补给点",
        category: "supply",
        coordinate: [114.305, 30.6001],
        weight: 1
      }
    ]);

    expect(graph.edges.get("edge-1")?.poiScores?.supply).toBeGreaterThan(0.9);
  });
});
