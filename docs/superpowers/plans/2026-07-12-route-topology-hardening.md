# Route Topology Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 42.195 km marathon routes only on visible event-suitable roads, without node revisits, self-crossing junction patterns, local rectangular detours, hairpins, or off-road connectors.

**Architecture:** Centralize strict event-road eligibility and topology diagnostics in domain helpers, enforce them during beam search, and recheck the reconstructed geometry in the shared quality gate. Remove endpoint-separation pruning and close distance by clipping the final selected road edge rather than adding a connector.

**Tech Stack:** TypeScript, React 19, Vitest, Vite, GeoJSON road graphs, Leaflet/SuperMap rendering.

---

## File structure

- `src/domain/roadNetwork.ts`: strict full-marathon road eligibility policy.
- `src/domain/routeTopology.ts`: reusable geometry/topology diagnostics for revisits, hairpins, parallel backtracks, and sharp-turn density.
- `src/domain/routeSearch.ts`: beam-search hard constraints and terminal edge clipping metadata.
- `src/domain/routeReconstruct.ts`: clipped final-edge reconstruction and topology metrics.
- `src/domain/routeMetrics.ts`: new auditable quality metric fields.
- `src/domain/routeQuality.ts`: shared hard quality thresholds.
- `src/data/osmMarathonRoute.ts`: enlarged search attempts and strict full-marathon candidate filtering.
- `src/components/GisSelectionPanel.tsx`: remove endpoint-separation copy.
- `src/components/RouteQualityPanel.tsx`: display new topology evidence.
- Corresponding `*.test.ts` / `*.test.tsx`: regression and UI coverage.

### Task 1: Strict event-road policy

**Files:**
- Modify: `src/domain/roadNetwork.ts`
- Modify: `src/domain/roadNetwork.test.ts`
- Modify: `src/domain/routeSearch.test.ts`

- [ ] **Step 1: Write failing tests for residential, service, track, ramp, and elevated roads**

Add a table-driven test asserting that full-marathon search eligibility accepts only `trunk`, `primary`, `secondary`, `tertiary`, and compliant `greenway` edges. Explicitly assert that a five-metre residential road is rejected even when closable.

```ts
expect(isFullMarathonRoadEdge(edge({ roadLevel: "primary", competitionSuitable: true }))).toBe(true);
expect(isFullMarathonRoadEdge(edge({ roadLevel: "residential", roadWidthM: 5 }))).toBe(false);
expect(isFullMarathonRoadEdge(edge({ roadLevel: "service" }))).toBe(false);
expect(isFullMarathonRoadEdge(edge({ roadLevel: "primary", isElevated: true }))).toBe(false);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm.cmd test -- --run src/domain/roadNetwork.test.ts src/domain/routeSearch.test.ts`

Expected: FAIL because `isFullMarathonRoadEdge` does not exist and residential roads are still accepted.

- [ ] **Step 3: Implement the strict predicate and use it in full-marathon search**

```ts
const fullMarathonLevels = new Set<RoadLevel>(["trunk", "primary", "secondary", "tertiary", "greenway"]);

export function isFullMarathonRoadEdge(edge: RoadEdge): boolean {
  return edge.competitionSuitable === true &&
    fullMarathonLevels.has(edge.roadLevel) &&
    edge.surfaceSuitable !== false &&
    edge.isElevated !== true &&
    edge.isTunnel !== true;
}
```

Replace `isEventUsableRoadEdge` with this predicate in `routeSearch.edgeIsEligible`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/domain/roadNetwork.ts src/domain/roadNetwork.test.ts src/domain/routeSearch.ts src/domain/routeSearch.test.ts
git commit -m "fix: restrict marathon search to event roads"
```

### Task 2: Node-simple search and real edge geometry checks

**Files:**
- Modify: `src/domain/routeSearch.ts`
- Modify: `src/domain/routeSearch.test.ts`

- [ ] **Step 1: Write failing reproductions for the screenshot shapes**

Create graph fixtures for a four-leaf center-node route and a shared-junction X route. Assert `searchMarathonRoutes` returns `no-compliant-route` when reaching the target requires revisiting the center node. Replace the old articulation-junction test that allowed the revisit.

```ts
expect(result).toMatchObject({ ok: false, code: "no-compliant-route" });
```

- [ ] **Step 2: Run the route-search test and verify RED**

Run: `npm.cmd test -- --run src/domain/routeSearch.test.ts`

Expected: FAIL because `visitedNodeIds` is recorded but never enforced.

- [ ] **Step 3: Reject node revisits and inspect full edge geometry**

Before expanding a candidate, reject `state.visitedNodeIds.has(nextNodeId)` unless it is the permitted fixed-finish closure. Build candidate geometry from `edge.coordinates` in traversal order and run every segment through self-intersection and local-knot checks instead of checking only the straight line from the current node to `nextNodeId`.

```ts
if (state.visitedNodeIds.has(nextNodeId) && !closesAtFinish) continue;
const candidateCoordinates = traversalCoordinates(edge);
if (createsGeometryConflict(state.coordinates, candidateCoordinates, closesAtFinish)) continue;
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: all route-search tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/domain/routeSearch.ts src/domain/routeSearch.test.ts
git commit -m "fix: prevent junction revisit route knots"
```

### Task 3: Remove endpoint separation and clip the terminal road edge

**Files:**
- Modify: `src/domain/routeSearch.ts`
- Modify: `src/domain/routeSearch.test.ts`
- Modify: `src/domain/routeReconstruct.ts`
- Modify: `src/domain/routeReconstruct.test.ts`
- Modify: `src/domain/routeQuality.ts`
- Modify: `src/domain/routeQuality.test.ts`

- [ ] **Step 1: Write failing endpoint and terminal-clipping tests**

Replace the endpoint-separation rejection test with one where endpoints are more than 21.0975 km apart but a valid path is searched. Add a path whose final eligible edge crosses 42.195 km and assert the result includes `terminalEdgeFraction` between 0 and 1, total length equals 42.195 km, and the reconstructed final coordinate lies on the final edge.

```ts
expect(result.ok).toBe(true);
expect(result.routes[0].totalLengthKm).toBe(42.195);
expect(result.routes[0].terminalEdgeFraction).toBeGreaterThan(0);
expect(result.routes[0].terminalEdgeFraction).toBeLessThan(1);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm.cmd test -- --run src/domain/routeSearch.test.ts src/domain/routeReconstruct.test.ts src/domain/routeQuality.test.ts`

Expected: FAIL because separation is rejected and terminal clipping metadata is absent.

- [ ] **Step 3: Remove separation pruning and add terminal clipping metadata**

Extend `SearchedPath`:

```ts
terminalEdgeFraction?: number;
```

When an eligible edge crosses 42.195 km, compute:

```ts
const remainingKm = marathonQualityThresholds.minDistanceKm - state.totalLengthKm;
const fraction = remainingKm / edge.lengthKm;
```

Complete the path at 42.195 km when the clipped edge geometry passes all topology checks. Remove `endpoint-separation` from failure codes and delete the separation precheck.

- [ ] **Step 4: Reconstruct the clipped final geometry**

Add `clipPolylineByFraction` that walks the final edge geometry by geodesic segment length, interpolates the terminal coordinate on the matching segment, and returns only the traversed portion. Use the clipped length for provenance and slope weighting.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/domain/routeSearch.ts src/domain/routeSearch.test.ts src/domain/routeReconstruct.ts src/domain/routeReconstruct.test.ts src/domain/routeQuality.ts src/domain/routeQuality.test.ts
git commit -m "feat: close marathon distance on final road edge"
```

### Task 4: Add auditable topology diagnostics

**Files:**
- Create: `src/domain/routeTopology.ts`
- Create: `src/domain/routeTopology.test.ts`
- Modify: `src/domain/routeMetrics.ts`
- Modify: `src/domain/routeReconstruct.ts`
- Modify: `src/domain/routeQuality.ts`
- Modify: `src/domain/routeQuality.test.ts`

- [ ] **Step 1: Write failing tests for revisit, rectangle, and hairpin metrics**

Define `analyzeRouteTopology(coordinates, nodeIds, totalKm)` and assert:

```ts
expect(analyzeRouteTopology(butterfly, repeatedNodes, 4).revisitedNodeCount).toBeGreaterThan(0);
expect(analyzeRouteTopology(thinRectangle, uniqueNodes, 4).parallelBacktrackCount).toBeGreaterThan(0);
expect(analyzeRouteTopology(hairpin, uniqueNodes, 2).hairpinTurnCount).toBeGreaterThan(0);
expect(analyzeRouteTopology(cleanCorridor, uniqueNodes, 10)).toMatchObject({
  revisitedNodeCount: 0,
  parallelBacktrackCount: 0,
  hairpinTurnCount: 0
});
```

- [ ] **Step 2: Run the topology tests and verify RED**

Run: `npm.cmd test -- --run src/domain/routeTopology.test.ts src/domain/routeQuality.test.ts`

Expected: FAIL because the module and metric fields do not exist.

- [ ] **Step 3: Implement diagnostics**

Return:

```ts
interface RouteTopologyDiagnostics {
  revisitedNodeCount: number;
  parallelBacktrackCount: number;
  hairpinTurnCount: number;
  sharpTurnDensityPerKm: number;
}
```

Count repeated node IDs, near-parallel reverse-direction segments within a 300 m walking window, turns of at least 150 degrees, and sharp turns per kilometre. Ignore adjacent segments that naturally share a vertex.

- [ ] **Step 4: Add metrics and quality thresholds**

Add the four fields to `RouteMetrics`. In `evaluateRouteQuality`, require all counts to equal 0 and require `sharpTurnDensityPerKm <= 1.5`. Missing values fail closed.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: all topology and quality tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/domain/routeTopology.ts src/domain/routeTopology.test.ts src/domain/routeMetrics.ts src/domain/routeReconstruct.ts src/domain/routeQuality.ts src/domain/routeQuality.test.ts
git commit -m "feat: gate marathon route topology"
```

### Task 5: Real-data search attempts and UI evidence

**Files:**
- Modify: `src/data/osmMarathonRoute.ts`
- Modify: `src/data/osmMarathonRoute.realdata.test.ts`
- Modify: `src/components/GisSelectionPanel.tsx`
- Modify: `src/components/GisSelectionPanel.test.tsx`
- Modify: `src/components/RouteQualityPanel.tsx`
- Modify: `src/components/RouteQualityPanel.test.tsx`

- [ ] **Step 1: Write failing real-data and UI tests**

For each visible profile assert the strict quality gate passes, route coordinates differ, and the new metrics are zero. In UI tests assert `21.0975` is absent and the topology evidence labels are present.

```ts
expect(route.metrics).toMatchObject({
  revisitedNodeCount: 0,
  parallelBacktrackCount: 0,
  hairpinTurnCount: 0
});
expect(screen.queryByText(/21\.0975/)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd test -- --run src/data/osmMarathonRoute.realdata.test.ts src/components/GisSelectionPanel.test.tsx src/components/RouteQualityPanel.test.tsx`

Expected: FAIL because real routes still use permissive edges and UI copy still shows endpoint separation.

- [ ] **Step 3: Expand strict search attempts without degrading rules**

Try the profile's seed points and a larger full-marathon envelope in deterministic order. Continue after a failed seed; only return routes that pass `evaluateRouteQuality`. Never call legacy fallback or permissive edge search for full-marathon targets.

- [ ] **Step 4: Update UI evidence**

Remove endpoint-separation text and add `交叉口复访`, `平行折返`, `发卡掉头`, and `急弯密度` rows to the rule and quality panels.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/data/osmMarathonRoute.ts src/data/osmMarathonRoute.realdata.test.ts src/components/GisSelectionPanel.tsx src/components/GisSelectionPanel.test.tsx src/components/RouteQualityPanel.tsx src/components/RouteQualityPanel.test.tsx
git commit -m "feat: expose strict route topology evidence"
```

### Task 6: Full verification and browser visual QA

**Files:**
- Modify: `artifacts/route-qa/race-flat.png`
- Modify: `artifacts/route-qa/organization-support.png`
- Modify: `artifacts/route-qa/city-experience.png`
- Create: `artifacts/route-qa/topology-detail-race.png`
- Create: `artifacts/route-qa/topology-detail-support.png`
- Create: `artifacts/route-qa/topology-detail-city.png`

- [ ] **Step 1: Run the complete automated suite**

Run: `npm.cmd test -- --run`

Expected: all test files and tests pass with zero failures.

- [ ] **Step 2: Build production assets**

Run: `npm.cmd run build`

Expected: TypeScript and Vite build exit 0.

- [ ] **Step 3: Generate each visible profile in the browser**

Open `http://127.0.0.1:5173/`, generate each profile independently, and record the displayed distance and topology evidence.

- [ ] **Step 4: Inspect full-route and zoomed-detail screenshots**

Reject and continue iterating if any route contains a butterfly, X-shaped revisit, thin rectangle, ramp star, hairpin, off-road connector, overlap, drift, or discontinuity.

- [ ] **Step 5: Commit verified screenshots**

```powershell
git add artifacts/route-qa
git commit -m "test: record topology-safe route screenshots"
```

- [ ] **Step 6: Publish and merge**

Push `feat/route-topology-hardening`, open a PR against `main`, merge after validation, pull `main`, and rerun `npm.cmd test -- --run` plus `npm.cmd run build` on the merged commit.
