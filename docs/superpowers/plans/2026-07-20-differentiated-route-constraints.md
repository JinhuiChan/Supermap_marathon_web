# Differentiated Route Constraints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the requested Wuhan route constraints while preserving quality-gated route generation.

**Architecture:** Keep the current OSM route search as the source of line geometry. Extend route-plan metadata and target-distance-aware quality checks, with all three visible route plans currently targeting full marathon distance.

**Tech Stack:** React, TypeScript, Vitest, Vite.

---

### Task 1: Route Plan Metadata

**Files:**
- Modify: `src/data/profileRoutePlanner.ts`
- Test: `src/data/profileRoutePlanner.test.ts`

- [ ] **Step 1: Write metadata tests**

Add tests asserting East Lake, Riverside, and City Scenic target `42.195`, East Lake has 11 ordered waypoints including `[114.3317, 30.5615]`, and each plan has `positioning`, `audience`, and `features`.

- [ ] **Step 2: Verify tests fail**

Run: `npm.cmd test -- src/data/profileRoutePlanner.test.ts`

- [ ] **Step 3: Extend plan type and data**

Add `positioning`, `audience`, and `features: string[]` to `WaypointRoutePlan`. Update the three route plans with the requested text and control points.

- [ ] **Step 4: Verify tests pass**

Run: `npm.cmd test -- src/data/profileRoutePlanner.test.ts`

### Task 2: Target-Specific Quality Gates

**Files:**
- Modify: `src/domain/routeQuality.ts`
- Test: `src/domain/routeQuality.test.ts`

- [ ] **Step 1: Write half-marathon quality tests**

Add a test proving a `21.0975 km` road-aligned route passes when evaluated with a half-marathon target and fails under the default full-marathon target.

- [ ] **Step 2: Verify tests fail**

Run: `npm.cmd test -- src/domain/routeQuality.test.ts -t "half marathon"`

- [ ] **Step 3: Add quality options**

Change `evaluateRouteQuality(route)` to accept optional `{ targetDistanceKm?: number }`. Compute distance min/max from the target, preserving the full-marathon threshold defaults.

- [ ] **Step 4: Verify tests pass**

Run: `npm.cmd test -- src/domain/routeQuality.test.ts -t "half marathon"`

### Task 3: Target-Aware Route Generation

**Files:**
- Modify: `src/data/profileRoutePlanner.ts`
- Modify: `src/data/osmMarathonRoute.realdata.waypoints.test.ts`

- [ ] **Step 1: Write real-data tests**

Assert each visible route returns a route near its plan target distance, passes `evaluateRouteQuality(route, { targetDistanceKm: plan.targetDistanceKm })`, and remains spatially distinct.

- [ ] **Step 2: Verify tests fail for Riverside**

Run: `npm.cmd test -- src/data/osmMarathonRoute.realdata.waypoints.test.ts`

- [ ] **Step 3: Pass plan target into profile route generation**

Call `buildBestRouteForSelectionProfile` with `targetDistanceKm: plan.targetDistanceKm`. Keep plan-specific seed points so the three visible routes remain distinct.

- [ ] **Step 4: Verify waypoint tests pass**

Run: `npm.cmd test -- src/data/osmMarathonRoute.realdata.waypoints.test.ts`

### Task 4: Final Verification

**Files:**
- No production file changes.

- [ ] **Step 1: Run the full test suite**

Run: `npm.cmd test`

- [ ] **Step 2: Run production build**

Run: `npm.cmd run build`

- [ ] **Step 3: Report status**

Report test counts, build result, and any remaining trade-offs.
