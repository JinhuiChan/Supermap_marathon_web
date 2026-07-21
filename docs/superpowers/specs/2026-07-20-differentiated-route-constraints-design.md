# Differentiated Route Constraints Design

## Goal

Update the three visible Wuhan route plans so their metadata, target distances, control points, and planning constraints match the requested East Lake, Riverside, and City Scenic marathon scenarios while preserving the current route quality.

## Design

The control points are treated as route theme and corridor guidance, not as hard sequential path vertices. Hard waypoint stitching previously produced visible triangular shortcuts and repeated-road artifacts, so the route generator should continue to prefer quality-gated OSM routes and use plan-specific seed points to keep each plan spatially distinct.

The Riverside route is treated as a full marathon with target distance `42.195 km` so its riverfront control-point corridor has enough distance budget to remain quality-gated. Route quality evaluation still supports target-specific thresholds for future shorter routes while retaining road-alignment, repeated-road, self-intersection, backtrack, and topology gates.

Plan data stores each route's positioning, audience, features, and ordered control points. Tests verify the requested route metadata, target distances, control point coverage metadata, visible route distinctness, and quality-gated real-road generation.

## Acceptance

- East Lake, Riverside, and City Scenic plans target `42.195 km`.
- The East Lake plan includes the province library half-marathon split control point.
- Each plan exposes positioning, audience, and feature text for UI/export use.
- Visible generated routes remain quality-gated and spatially distinct.
- Tests and production build pass.
