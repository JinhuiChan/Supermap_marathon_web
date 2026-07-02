# Real Road Network Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tested GeoJSON-to-road-graph importer so the project can use real Wuhan OSM road data instead of only the simulated graph.

**Architecture:** Keep the existing `RoadGraph` and `routeGenerator` interfaces. Add a focused data adapter that reads GeoJSON features, normalizes OSM tags, and creates graph nodes and edges for adjacent road vertices.

**Tech Stack:** TypeScript, Vitest, existing React/Vite project.

---

## File Structure

- Create `src/data/roadNetworkGeoJson.ts`: pure parser and graph builder for GeoJSON road data.
- Create `src/data/roadNetworkGeoJson.test.ts`: unit tests for parser behavior.
- Modify `docs/data-sources.md`: document the downloaded local OSM data paths and how to refresh them.
- Modify `.gitignore`: ignore large local OSM exports under `public/data/local-*` if temporary copies are needed.

### Task 1: GeoJSON Graph Builder

**Files:**
- Create: `src/data/roadNetworkGeoJson.test.ts`
- Create: `src/data/roadNetworkGeoJson.ts`

- [ ] **Step 1: Write the failing LineString test**

```typescript
import { describe, expect, test } from "vitest";
import { buildRoadGraphFromGeoJson, mapOsmHighwayToRoadLevel } from "./roadNetworkGeoJson";

describe("roadNetworkGeoJson", () => {
  test("builds a graph from a LineString road feature", () => {
    const graph = buildRoadGraphFromGeoJson({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { highway: "primary", bridge: "yes" },
          geometry: {
            type: "LineString",
            coordinates: [
              [114.3, 30.6],
              [114.31, 30.61],
              [114.32, 30.62]
            ]
          }
        }
      ]
    });

    expect(graph.nodes.size).toBe(3);
    expect(graph.edges.size).toBe(2);
    expect([...graph.edges.values()].every((edge) => edge.roadLevel === "primary")).toBe(true);
    expect([...graph.edges.values()].every((edge) => edge.isBridge)).toBe(true);
  });

  test("maps OSM highway tags to route road levels", () => {
    expect(mapOsmHighwayToRoadLevel("motorway")).toBe("motorway");
    expect(mapOsmHighwayToRoadLevel("cycleway")).toBe("greenway");
    expect(mapOsmHighwayToRoadLevel("living_street")).toBe("residential");
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm.cmd test -- src/data/roadNetworkGeoJson.test.ts`

Expected: FAIL because `roadNetworkGeoJson` does not exist.

- [ ] **Step 3: Implement minimal parser**

Create `src/data/roadNetworkGeoJson.ts` with:

```typescript
import { haversineKm } from "../domain/roadAttributes";
import { addEdge, addNode, createEmptyGraph, type RoadGraph, type RoadLevel } from "../domain/roadNetwork";
import type { Coordinate } from "../domain/routeMetrics";

export function mapOsmHighwayToRoadLevel(value: unknown): RoadLevel {
  switch (value) {
    case "motorway":
      return "motorway";
    case "trunk":
      return "trunk";
    case "primary":
      return "primary";
    case "secondary":
      return "secondary";
    case "tertiary":
      return "tertiary";
    case "service":
      return "service";
    case "track":
      return "track";
    case "cycleway":
    case "footway":
    case "path":
    case "pedestrian":
      return "greenway";
    default:
      return "residential";
  }
}

export function buildRoadGraphFromGeoJson(geojson: unknown): RoadGraph {
  const graph = createEmptyGraph();
  const collection = geojson as { features?: unknown[] };
  const features = Array.isArray(collection.features) ? collection.features : [];

  features.forEach((feature, featureIndex) => {
    const typed = feature as {
      properties?: Record<string, unknown>;
      geometry?: { type?: string; coordinates?: unknown };
    };
    const lines = extractLines(typed.geometry);
    lines.forEach((line, lineIndex) => {
      addLine(graph, line, typed.properties ?? {}, featureIndex, lineIndex);
    });
  });

  return graph;
}
```

- [ ] **Step 4: Run focused test and verify it passes**

Run: `npm.cmd test -- src/data/roadNetworkGeoJson.test.ts`

Expected: PASS.

### Task 2: MultiLineString and malformed data

**Files:**
- Modify: `src/data/roadNetworkGeoJson.test.ts`
- Modify: `src/data/roadNetworkGeoJson.ts`

- [ ] **Step 1: Add tests for MultiLineString and bad geometry**

```typescript
test("builds separate chains from a MultiLineString", () => {
  const graph = buildRoadGraphFromGeoJson({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { highway: "cycleway", tunnel: "yes" },
        geometry: {
          type: "MultiLineString",
          coordinates: [
            [[114.3, 30.6], [114.31, 30.61]],
            [[114.4, 30.62], [114.41, 30.63]]
          ]
        }
      }
    ]
  });

  expect(graph.nodes.size).toBe(4);
  expect(graph.edges.size).toBe(2);
  expect([...graph.edges.values()].every((edge) => edge.roadLevel === "greenway")).toBe(true);
  expect([...graph.edges.values()].every((edge) => edge.isTunnel)).toBe(true);
});

test("skips malformed features", () => {
  const graph = buildRoadGraphFromGeoJson({
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: {}, geometry: null },
      { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [114.3, 30.6] } },
      { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[114.3], ["bad", 30.6]] } }
    ]
  });

  expect(graph.nodes.size).toBe(0);
  expect(graph.edges.size).toBe(0);
});
```

- [ ] **Step 2: Run focused test and verify it fails**

Run: `npm.cmd test -- src/data/roadNetworkGeoJson.test.ts`

Expected: FAIL until MultiLineString and validation helpers are implemented.

- [ ] **Step 3: Complete parser helpers**

Add helper functions for coordinate validation, line extraction, edge creation, and boolean tag parsing.

- [ ] **Step 4: Run focused test and verify it passes**

Run: `npm.cmd test -- src/data/roadNetworkGeoJson.test.ts`

Expected: PASS.

### Task 3: Documentation and Ignore Rules

**Files:**
- Modify: `.gitignore`
- Modify: `docs/data-sources.md`

- [ ] **Step 1: Document local data paths**

Add the downloaded OSM paths and explain that they are not committed to GitHub.

- [ ] **Step 2: Ignore temporary local public data exports**

Add `public/data/local-*` to `.gitignore`.

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm.cmd test
npm.cmd run build
```

Expected: all tests and build pass.
