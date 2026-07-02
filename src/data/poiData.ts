import type { RoadGraph } from "../domain/roadNetwork";
import { haversineKm } from "../domain/roadAttributes";
import type { PoiCategory } from "../domain/poiTypes";
import { ZERO_POI_SCORE } from "../domain/poiTypes";
import { supportPoints } from "./supportPoints";

export interface PoiPoint {
  id: string;
  name: string;
  category: PoiCategory;
  coordinate: [number, number];
  weight: number;
}

const serviceLevelWeight: Record<string, number> = { A: 1, B: 0.8, C: 0.6 };

const supportTypeToPoiCategory: Record<string, PoiCategory> = {
  补给: "supply",
  医疗: "medical",
  停车: "transit"
};

export function buildPoiPointsFromSupportPoints(): PoiPoint[] {
  return supportPoints
    .filter((point) => point.type !== "起终点")
    .map((point) => ({
      id: point.id,
      name: point.name,
      category: supportTypeToPoiCategory[point.type] ?? "supply",
      coordinate: point.coordinate,
      weight: serviceLevelWeight[point.serviceLevel] ?? 0.5
    }));
}

export function snapPoisToEdges(graph: RoadGraph, pois: PoiPoint[], sigmaKm = 0.5): void {
  const twoSigmaSquared = 2 * sigmaKm * sigmaKm;

  for (const poi of pois) {
    let bestEdgeId: string | null = null;
    let bestDistanceKm = Number.POSITIVE_INFINITY;

    for (const [edgeId, edge] of graph.edges) {
      const fromNode = graph.nodes.get(edge.fromNodeId);
      const toNode = graph.nodes.get(edge.toNodeId);
      if (!fromNode || !toNode) continue;

      const midpoint: [number, number] = [
        (fromNode.coordinate[0] + toNode.coordinate[0]) / 2,
        (fromNode.coordinate[1] + toNode.coordinate[1]) / 2
      ];
      const distanceKm = haversineKm(poi.coordinate, midpoint);
      if (distanceKm < bestDistanceKm) {
        bestDistanceKm = distanceKm;
        bestEdgeId = edgeId;
      }
    }

    const bestEdge = bestEdgeId ? graph.edges.get(bestEdgeId) : null;
    if (!bestEdge) continue;

    const decay = Math.exp(-(bestDistanceKm * bestDistanceKm) / twoSigmaSquared);
    const score = poi.weight * decay;
    bestEdge.poiScores = bestEdge.poiScores ?? { ...ZERO_POI_SCORE };
    bestEdge.poiScores[poi.category] = Math.min(1, bestEdge.poiScores[poi.category] + score);
  }
}

export function augmentGraphWithSupportPois(graph: RoadGraph): void {
  snapPoisToEdges(graph, buildPoiPointsFromSupportPoints());
}
