# Marathon Route Quality and Web UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate only road-aligned, non-overlapping, non-self-intersecting 42.195 km marathon routes that satisfy start/finish and terrain rules, then present them through a clearer three-objective GIS workflow.

**Architecture:** A deterministic constraint-aware search produces raw paths, a separate quality gate decides whether a path may be shown, and objective scoring only ranks routes that pass. React owns interaction state, while focused presentation components render endpoint validity, generation phases, route quality evidence, and structured failures.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Vitest 3, Leaflet/SuperMap map adapters, local OSM/GeoJSON road data.

---

## File map

- Create `src/domain/routeQuality.ts`: shared thresholds, hard-gate evaluation, issue codes, and display-ready quality facts.
- Create `src/domain/routeQuality.test.ts`: unit coverage for every hard route rule.
- Create `src/domain/routeSearch.ts`: deterministic Beam Search, lower-bound pruning, no-repeat/no-intersection expansion, and structured search failures.
- Create `src/domain/routeSearch.test.ts`: synthetic-graph tests for closure, pruning, repeat prevention, and determinism.
- Modify `src/domain/routeMetrics.ts`: reduce public selection goals to three and add the metrics needed by the quality gate.
- Modify `src/domain/roadNetwork.ts` and `src/data/roadNetworkGeoJson.ts`: preserve physical edge identity, source geometry, surface suitability, and slope coverage.
- Modify `src/domain/routeReconstruct.ts`: reconstruct only from edge geometry and measure continuity gaps.
- Modify `src/data/osmMarathonRoute.ts`: replace fallback/review-path behavior with search + hard-gate integration.
- Modify `src/data/profileRoutePlanner.ts`: map three objectives to weights and reject failed routes.
- Modify `src/App.tsx`: endpoint validation, phased generation, structured failures, and quality report state.
- Modify `src/components/GisSelectionPanel.tsx`: three-step simplified planning form.
- Create `src/components/RouteQualityPanel.tsx`: hard-gate evidence and certification disclaimer.
- Modify `src/components/CandidateRouteDrawer.tsx`: prioritize compliance metrics and never label review connectors as candidates.
- Modify `src/map/components/SuperMapMap.tsx`, `src/map/core/MapEngine.ts`, and `src/styles.css`: clearer single-route focus, endpoint feedback, and responsive three-column layout.
- Extend existing tests beside every modified module; store final visual evidence under `artifacts/route-qa/`.

### Task 1: Establish the existing-work baseline

**Files:**
- Inspect: all modified and untracked files shown by `git status --short`
- Test: existing Vitest suite and TypeScript/Vite build

- [ ] **Step 1: Record the exact branch and working-tree scope**

Run:

```powershell
git status --short --branch
git diff --stat
git ls-files --others --exclude-standard
```

Expected: branch `feat/marathon-route-quality-ui`; the pre-existing application changes remain present; the committed design and plan are not mixed into an unrelated reset.

- [ ] **Step 2: Run the current test baseline**

Run:

```powershell
npm.cmd test
```

Expected: either all tests pass or each failure is recorded by exact test name before any production change.

- [ ] **Step 3: Run the current build baseline**

Run:

```powershell
npm.cmd run build
```

Expected: either exit code 0 or an exact TypeScript/build error list that can be reproduced.

- [ ] **Step 4: Classify baseline failures before fixing them**

For each failure, write one line in the execution notes using this format:

```text
<test or compiler error> | existing dirty change / new design gap | root-cause evidence
```

Expected: no failure is “fixed” by deleting a test or relaxing an assertion.

### Task 2: Add a single hard route-quality gate

**Files:**
- Create: `src/domain/routeQuality.ts`
- Create: `src/domain/routeQuality.test.ts`
- Modify: `src/domain/routeMetrics.ts`

- [ ] **Step 1: Write failing tests for official distance and endpoint rules**

Add tests equivalent to:

```ts
expect(evaluateRouteQuality(route({ lengthKm: 42.194 }))).toMatchObject({ passed: false });
expect(issueCodes(route({ lengthKm: 42.238 }))).toContain("distance");
expect(issueCodes(routeWithEndpoints([114, 30], [114.25, 30]))).toContain("endpoint-separation");
expect(issueCodes(route({ metrics: { netElevationDropM: 43 } }))).toContain("net-drop");
```

- [ ] **Step 2: Write failing tests for topology, continuity, terrain, and data coverage**

Add explicit cases asserting these issue codes:

```ts
"repeated-road"
"backtrack"
"self-intersection"
"local-knot"
"continuity-gap"
"total-climb"
"max-grade"
"continuous-steep"
"terrain-coverage"
"road-suitability"
"road-alignment"
```

- [ ] **Step 3: Run only the new tests and verify RED**

Run:

```powershell
npx.cmd vitest run src/domain/routeQuality.test.ts
```

Expected: FAIL because `routeQuality` and the new metric fields do not exist.

- [ ] **Step 4: Implement the threshold and report types**

Implement this public shape:

```ts
export const marathonQualityThresholds = {
  minDistanceKm: 42.195,
  maxDistanceKm: 42.237,
  maxEndpointSeparationKm: 21.0975,
  maxNetDropM: 42.195,
  maxTotalClimbM: 180,
  maxAbsGradePercent: 5,
  maxContinuousSteepKm: 1,
  maxContinuityGapM: 10,
  minTerrainCoverageRatio: 0.95
} as const;

export type RouteQualityIssueCode =
  | "distance" | "endpoint-separation" | "net-drop" | "total-climb"
  | "max-grade" | "continuous-steep" | "terrain-coverage"
  | "repeated-road" | "backtrack" | "self-intersection" | "local-knot"
  | "continuity-gap" | "road-suitability" | "road-alignment";

export interface RouteQualityReport {
  passed: boolean;
  issues: Array<{ code: RouteQualityIssueCode; label: string; actual: number | boolean; limit: number | boolean }>;
  endpointSeparationKm: number;
}

export function evaluateRouteQuality(route: MarathonRoute): RouteQualityReport;
```

Add to `RouteMetrics`: `netElevationDropM`, `terrainCoverageRatio`, `maxContinuityGapM`, `unsuitableEdgeCount`, and `roadAlignedRatio`.

- [ ] **Step 5: Run the quality tests and verify GREEN**

Run:

```powershell
npx.cmd vitest run src/domain/routeQuality.test.ts
```

Expected: all route-quality cases pass.

- [ ] **Step 6: Commit the hard-gate unit**

```powershell
git add src/domain/routeQuality.ts src/domain/routeQuality.test.ts src/domain/routeMetrics.ts
git commit -m "feat: add marathon route quality gate"
```

### Task 3: Preserve real road geometry and measurable provenance

**Files:**
- Modify: `src/domain/roadNetwork.ts`
- Modify: `src/data/roadNetworkGeoJson.ts`
- Modify: `src/data/roadNetworkGeoJson.test.ts`
- Modify: `src/domain/routeReconstruct.ts`
- Modify or create: `src/domain/routeReconstruct.test.ts`

- [ ] **Step 1: Write failing parsing tests**

Use a `LineString` with three coordinates and assert that every directed edge exposes:

```ts
expect(edge.physicalEdgeId).toBe(reverse.physicalEdgeId);
expect(edge.geometry).toEqual([[114, 30], [114.001, 30.001]]);
expect(edge.surfaceSuitable).toBe(true);
expect(edge.terrainMeasured).toBe(true);
```

Also assert that `surface: "grass"`, motorway ramps, tracks, and unknown unpaved paths are not competition-suitable.

- [ ] **Step 2: Write failing reconstruction tests**

Assert that reconstruction concatenates edge geometry in travel direction, removes only the shared endpoint, records the largest real endpoint gap, and never interpolates a direct connector:

```ts
expect(route.coordinates).toEqual([[114, 30], [114.001, 30], [114.002, 30.001]]);
expect(route.metrics.maxContinuityGapM).toBeLessThanOrEqual(10);
expect(route.metrics.roadAlignedRatio).toBe(1);
```

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
npx.cmd vitest run src/data/roadNetworkGeoJson.test.ts src/domain/routeReconstruct.test.ts
```

Expected: failures for missing provenance/geometry fields.

- [ ] **Step 4: Implement the road-edge fields and exact reconstruction**

Extend `RoadEdge` with:

```ts
physicalEdgeId: string;
geometry: Coordinate[];
surfaceSuitable: boolean;
terrainMeasured: boolean;
```

Derive the reverse edge from `geometry.toReversed()` and keep a shared `physicalEdgeId`. Compute terrain coverage as measured edge length divided by route length; compute continuity gaps between actual adjacent edge geometries.

- [ ] **Step 5: Run focused and neighboring tests**

```powershell
npx.cmd vitest run src/data/roadNetworkGeoJson.test.ts src/domain/routeReconstruct.test.ts src/domain/roadNetwork.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit road provenance**

```powershell
git add src/domain/roadNetwork.ts src/data/roadNetworkGeoJson.ts src/data/roadNetworkGeoJson.test.ts src/domain/routeReconstruct.ts src/domain/routeReconstruct.test.ts
git commit -m "feat: preserve road geometry in generated routes"
```

### Task 4: Replace random walking with constraint-aware search

**Files:**
- Create: `src/domain/routeSearch.ts`
- Create: `src/domain/routeSearch.test.ts`
- Modify: `src/domain/routeGenerator.ts`
- Modify: `src/domain/routeGenerator.test.ts`

- [ ] **Step 1: Write a synthetic graph that has one valid 42.2 km simple path and several tempting invalid paths**

The fixture must include a reverse edge, a self-crossing shortcut, a steep shortcut, and a dead end. Assert:

```ts
const result = searchMarathonRoutes(graph, request);
expect(result.routes).toHaveLength(1);
expect(new Set(result.routes[0].physicalEdgeIds).size).toBe(result.routes[0].physicalEdgeIds.length);
expect(result.routes[0].totalLengthKm).toBeGreaterThanOrEqual(42.195);
expect(result.routes[0].totalLengthKm).toBeLessThanOrEqual(42.237);
```

- [ ] **Step 2: Add failure and determinism tests**

Assert that an endpoint separation over 21.0975 km returns `endpoint-separation`, an impossible graph returns `no-compliant-route`, and two identical searches return identical edge IDs and diagnostics.

- [ ] **Step 3: Run the search tests and verify RED**

```powershell
npx.cmd vitest run src/domain/routeSearch.test.ts
```

Expected: FAIL because `searchMarathonRoutes` is missing.

- [ ] **Step 4: Implement lower bounds and search state**

Expose:

```ts
export interface MarathonSearchRequest {
  startPoint: Coordinate;
  endPoint: Coordinate;
  objective: "race-fast" | "operations" | "city-experience";
  maxRoutes?: number;
  maxExpandedStates?: number;
}

export type MarathonSearchResult =
  | { ok: true; routes: GeneratedPath[]; expandedStates: number }
  | { ok: false; code: "endpoint-separation" | "snap-distance" | "no-compliant-route"; message: string; expandedStates: number };
```

Use reverse Dijkstra distance to the end as the closure lower bound. Each state stores used `physicalEdgeId`s, recent coordinates, length, climb, steep run, and objective score.

- [ ] **Step 5: Implement hard expansion filters and bounded Beam selection**

Reject before scoring when an edge repeats, reverses the prior physical edge, is unsuitable, lacks terrain data, exceeds terrain limits, creates a non-adjacent intersection/local knot, or cannot finish in the distance window. Deduplicate states by node, 100 m length bucket, and used-edge fingerprint; retain a deterministic beam ordered by feasibility, objective score, and edge ID.

- [ ] **Step 6: Run search and generator tests**

```powershell
npx.cmd vitest run src/domain/routeSearch.test.ts src/domain/routeGenerator.test.ts
```

Expected: PASS with deterministic output and no random retry dependency.

- [ ] **Step 7: Commit search implementation**

```powershell
git add src/domain/routeSearch.ts src/domain/routeSearch.test.ts src/domain/routeGenerator.ts src/domain/routeGenerator.test.ts
git commit -m "feat: generate routes with constrained beam search"
```

### Task 5: Integrate search, quality gating, and three objectives

**Files:**
- Modify: `src/data/osmMarathonRoute.ts`
- Modify: `src/data/osmMarathonRoute.test.ts`
- Modify: `src/data/osmMarathonRoute.realdata.test.ts`
- Modify: `src/data/profileRoutePlanner.ts`
- Modify: `src/data/profileRoutePlanner.test.ts`
- Modify: `src/domain/routeMetrics.ts`
- Modify: `src/domain/routeMetrics.test.ts`

- [ ] **Step 1: Write failing integration tests that forbid review/fallback routes**

Assert that an impossible request returns no route rather than a connector, and that every returned route satisfies:

```ts
expect(evaluateRouteQuality(route).passed).toBe(true);
expect(route.lineage?.roadAligned).toBe(true);
expect(route.metrics.repeatedRoadRatio).toBe(0);
expect(route.metrics.selfIntersectionCount).toBe(0);
```

- [ ] **Step 2: Write failing objective tests**

Replace the six public choices with:

```ts
type RouteSelectionProfile = "race-fast" | "operations" | "city-experience";
```

Assert that all three rank only passed routes and that changing the objective never changes `evaluateRouteQuality(route).passed`.

- [ ] **Step 3: Run focused integration tests and verify RED**

```powershell
npx.cmd vitest run src/data/osmMarathonRoute.test.ts src/data/profileRoutePlanner.test.ts src/domain/routeMetrics.test.ts
```

Expected: failures showing old fallback paths and six-profile assumptions.

- [ ] **Step 4: Integrate the new search and remove false candidates**

`buildOsmMarathonCandidateRoutes` must call `searchMarathonRoutes`, reconstruct each path, evaluate it, and return only routes for which `evaluateRouteQuality(route).passed === true`. Remove `buildFallbackReviewPaths`, direct bridge connectors, straight-line interpolations, and any naming that presents a diagnostic connector as a marathon route.

- [ ] **Step 5: Add compatibility parsing without preserving obsolete UI choices**

Map stored legacy IDs as follows:

```ts
balanced -> operations
pb-friendly -> race-fast
mass-finish -> operations
support-first -> operations
scenic -> city-experience
river-scenic -> city-experience
```

New UI and exported reports use only the three new labels.

- [ ] **Step 6: Run unit and real-data integration tests**

```powershell
npx.cmd vitest run src/data/osmMarathonRoute.test.ts src/data/osmMarathonRoute.realdata.test.ts src/data/profileRoutePlanner.test.ts src/domain/routeMetrics.test.ts
```

Expected: each returned real-data route passes the shared quality gate; if the real dataset cannot produce a compliant route, the test asserts the structured reason rather than accepting an invalid line.

- [ ] **Step 7: Commit integration**

```powershell
git add src/data/osmMarathonRoute.ts src/data/osmMarathonRoute.test.ts src/data/osmMarathonRoute.realdata.test.ts src/data/profileRoutePlanner.ts src/data/profileRoutePlanner.test.ts src/domain/routeMetrics.ts src/domain/routeMetrics.test.ts
git commit -m "feat: gate all marathon candidates by shared rules"
```

### Task 6: Simplify the planning workflow and show compliance evidence

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/GisSelectionPanel.tsx`
- Modify: `src/components/GisSelectionPanel.test.tsx`
- Create: `src/components/RouteQualityPanel.tsx`
- Create: `src/components/RouteQualityPanel.test.tsx`
- Modify: `src/components/CandidateRouteDrawer.tsx`
- Modify: `src/components/RouteLibrary.test.tsx` if labels are shared

- [ ] **Step 1: Write failing endpoint and objective UI tests**

Assert that the selection panel renders exactly three objectives, defaults the finish to the start when requested, displays current/maximum endpoint separation, and disables generation with `起终点直线距离超过 21.0975 km`.

- [ ] **Step 2: Write failing quality-panel tests**

For a passing report, assert the panel renders distance, zero repeated road, zero self-intersection, continuity, climb, steep section, and the certification disclaimer. For a failed report, assert the failing rows use accessible text and the route cannot be marked recommended.

- [ ] **Step 3: Write failing phased-generation tests**

Use fake timers and assert the status sequence is represented by the state values `searching`, `closing`, `validating`, and `complete` or `failed`; the UI must not claim a route count until validation completes.

- [ ] **Step 4: Run component tests and verify RED**

```powershell
npx.cmd vitest run src/App.test.tsx src/components/GisSelectionPanel.test.tsx src/components/RouteQualityPanel.test.tsx
```

Expected: failures for missing three-objective UI and quality panel.

- [ ] **Step 5: Implement the simplified left panel**

Render sections in this order: endpoint tools and separation, three objective cards, one primary generate button. Move raw POI/impedance sliders behind a collapsed `高级参数` disclosure or remove them when they no longer affect the new search request.

- [ ] **Step 6: Implement phased state and structured errors in `App`**

Use this state model:

```ts
type GenerationPhase = "idle" | "searching" | "closing" | "validating" | "complete" | "failed";
interface GenerationFeedback { phase: GenerationPhase; message: string; failureCode?: string }
```

Only insert routes returned by the passed quality gate. Clear obsolete routes when endpoints change.

- [ ] **Step 7: Implement the quality evidence panel and candidate summaries**

Show hard rules first, objective score second. A candidate card displays `42.xxx km`, climb, repeated-road ratio, self-intersection count, and continuity gap. The right panel always states that planning output requires certified course measurement.

- [ ] **Step 8: Run component tests and commit**

```powershell
npx.cmd vitest run src/App.test.tsx src/components/GisSelectionPanel.test.tsx src/components/RouteQualityPanel.test.tsx
git add src/App.tsx src/App.test.tsx src/components/GisSelectionPanel.tsx src/components/GisSelectionPanel.test.tsx src/components/RouteQualityPanel.tsx src/components/RouteQualityPanel.test.tsx src/components/CandidateRouteDrawer.tsx
git commit -m "feat: simplify compliant route planning workflow"
```

Expected: tests pass and commit succeeds.

### Task 7: Refine map focus and responsive styling

**Files:**
- Modify: `src/map/components/SuperMapMap.tsx`
- Modify: `src/map/components/SuperMapMap.test.ts`
- Modify: `src/map/core/MapEngine.ts`
- Modify: `src/map/layers/RouteLayer.ts`
- Modify: `src/map/layers/RouteLayer.test.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing map behavior tests**

Assert that only selected/compared passed routes are visible, the active route has the strongest style, inactive candidates remain legible but subdued, and endpoint markers/status persist through route updates.

- [ ] **Step 2: Run map tests and verify RED**

```powershell
npx.cmd vitest run src/map/components/SuperMapMap.test.ts src/map/layers/RouteLayer.test.ts
```

Expected: at least one assertion fails against the existing multi-route presentation.

- [ ] **Step 3: Implement map focus behavior**

Fit bounds only when the active route ID or generated route set changes, not on every comparison toggle. Draw route casing beneath the active colored stroke so it remains distinguishable from roads. Do not create geometry in the map layer; it receives the exact reconstructed coordinates.

- [ ] **Step 4: Implement the responsive workspace styling**

Desktop: `320px minmax(520px, 1fr) 300px`. Medium widths collapse the right quality panel into a drawer. Mobile order is map, planning controls, results/quality. Add visible focus states, disabled explanations, reduced-motion handling, and avoid fixed heights that clip generated results.

- [ ] **Step 5: Run map tests and build**

```powershell
npx.cmd vitest run src/map/components/SuperMapMap.test.ts src/map/layers/RouteLayer.test.ts
npm.cmd run build
```

Expected: PASS and build exit code 0.

- [ ] **Step 6: Commit map and visual changes**

```powershell
git add src/map/components/SuperMapMap.tsx src/map/components/SuperMapMap.test.ts src/map/core/MapEngine.ts src/map/layers/RouteLayer.ts src/map/layers/RouteLayer.test.ts src/styles.css
git commit -m "feat: refine route map focus and responsive layout"
```

### Task 8: Real-data and browser screenshot correction loop

**Files:**
- Modify as failures demand: route search, quality, reconstruction, map, and component files from Tasks 2–7
- Create: `artifacts/route-qa/race-fast-desktop.png`
- Create: `artifacts/route-qa/operations-desktop.png`
- Create: `artifacts/route-qa/city-experience-desktop.png`
- Create: `artifacts/route-qa/mobile-workflow.png`
- Test: matching regression test for every discovered defect

- [ ] **Step 1: Start the app with the actual local road dataset**

Run:

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

Expected: Vite reports a local URL and the road dataset loads without console errors.

- [ ] **Step 2: Generate and inspect `竞速平坦`**

Use the browser at 1440×1000. Check road alignment, endpoint placement, distance, no repeated segment, no backtrack, no self-crossing/knot, terrain facts, loading state, and panel consistency. Save the screenshot only after all checks pass.

- [ ] **Step 3: Generate and inspect `组织保障`**

Repeat the same checks. Confirm its objective evidence differs without relaxing any hard rule. Save the passing screenshot.

- [ ] **Step 4: Generate and inspect `城市体验`**

Repeat the same checks. A bridge or landmark is optional when it would violate the hard gate. Save the passing screenshot.

- [ ] **Step 5: Inspect mobile layout**

Use a 390×844 viewport and verify map → controls → results order, usable controls, no horizontal overflow, and readable failure/quality rows. Save the passing screenshot.

- [ ] **Step 6: Convert every visual defect into a failing automated regression**

For each defect, first add the smallest failing unit/component test, run it to confirm RED, implement the fix, run it to GREEN, regenerate the affected route, and replace the screenshot. Continue until all four screenshots pass inspection.

- [ ] **Step 7: Commit verified screenshot-loop fixes**

```powershell
git add src artifacts/route-qa
git commit -m "fix: eliminate route overlap drift and visual regressions"
```

Expected: only verified source/test changes and final evidence images are staged.

### Task 9: Full verification, GitHub publication, and main merge

**Files:**
- Inspect: complete branch diff and GitHub PR/check state

- [ ] **Step 1: Run final automated verification from a clean process**

```powershell
npm.cmd test
npm.cmd run build
git diff --check main...HEAD
```

Expected: all tests pass, build succeeds, and no whitespace errors.

- [ ] **Step 2: Verify repository hygiene and intended scope**

```powershell
git status --short
git diff --stat main...HEAD
git log --oneline main..HEAD
```

Expected: no temporary server files, debug scripts, `node_modules`, or unreviewed generated data are included; all intended source, test, documentation, and evidence files are committed.

- [ ] **Step 3: Push the feature branch**

```powershell
git push -u origin feat/marathon-route-quality-ui
```

Expected: remote branch is created or updated successfully.

- [ ] **Step 4: Create a pull request**

Create a PR titled `feat: enforce marathon route quality and improve planning UX` with a body summarizing the shared quality gate, three objectives, test results, build result, and screenshot evidence.

- [ ] **Step 5: Wait for GitHub checks and resolve only evidence-backed failures**

Expected: required checks are green. For a failing check, inspect its exact log, reproduce locally where possible, add a regression test, fix, verify, commit, and push.

- [ ] **Step 6: Merge the PR and update main**

Merge through GitHub using the repository's permitted method. Then run:

```powershell
git fetch origin
git -C E:\SuperMap\超图\Supermap_marathon_web switch main
git -C E:\SuperMap\超图\Supermap_marathon_web pull --ff-only origin main
git -C E:\SuperMap\超图\Supermap_marathon_web log -1 --oneline --decorate
```

Expected: local `main` and `origin/main` point to the merged result.
