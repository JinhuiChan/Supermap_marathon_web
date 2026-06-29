# Marathon Analysis Enhancement Design

## Goal

Build the next competition-ready layer on top of the published SuperMap WMS map. The app should explain why a route is recommended, not only display candidate lines. The added work must stay fully local, rely on the already published `map-wuhan-marathon` service, and keep the demo stable even if optional 3D services are unavailable.

## Recommended Approach

Use the current React app as the main delivery surface and add business analysis overlays:

1. Show support points from `public/data/wuhan-marathon-support-points.geojson` as map markers.
2. Add compact layer controls for routes, support points, DEM/WMS status, and analysis overlays.
3. Add an analysis narrative panel that explains each route across terrain, passage, supply, medical, parking, and shade dimensions.
4. Upgrade the exported report from a score list into a competition-style decision memo.

This is better than building a separate backend service now because the project already has verified iServer WMS publishing and a working frontend. The fastest path to a convincing entry is to make that published GIS result visibly useful.

## User Experience

The first screen remains the working WebGIS dashboard. The central map shows the published Wuhan DEM/WMS map, candidate routes, and optional support point markers. The left side keeps route selection and single-route metrics. The right side gains stronger decision support:

- SuperMap status confirms iServer, WMS, and published map readiness.
- 3D panel remains visible but optional.
- Comparison panel ranks selected routes and explains the winner.
- New or upgraded analysis content describes the reasons behind the score.
- Export panel produces a readable organizer-facing route selection report.

No landing page or marketing screen is added.

## Data Model

Add a small `SupportPoint` domain model loaded from the existing GeoJSON file. Points have:

- `id`
- `name`
- `type`
- `routeId`
- `serviceLevel`
- `coordinate`

Derived analysis should stay deterministic and testable. Route scoring continues to use `RouteMetrics`, but helper functions will expose per-dimension scores and explanatory text.

## Components

Add or update these pieces:

- `src/data/supportPoints.ts`: static typed support point data derived from GeoJSON.
- `src/domain/routeAnalysis.ts`: dimension scoring, route explanations, and report text helpers.
- `src/map/layers/SupportPointLayer.ts`: marker style helpers for Leaflet support points.
- `src/map/core/MapEngine.ts`: support point rendering and toggles.
- `src/map/components/SuperMapMap.tsx`: receives support points and layer visibility state.
- `src/components/LayerControlPanel.tsx`: compact toggles for map overlays.
- `src/components/RouteAnalysisPanel.tsx`: human-readable recommendation rationale.
- `src/components/ExportPanel.tsx`: decision memo style export.

## Error Handling

If Leaflet or WMS fails, the existing SVG fallback remains. If support point rendering fails, routes and WMS should still render. Analysis panels must work from local typed data and not depend on network calls.

## Testing

Add unit tests for:

- support point parsing/model helpers,
- route analysis dimension scoring,
- export report content.

Keep existing tests for route scoring, WMS health checks, and map route click detection.

## Out Of Scope

- Real network-based route generation.
- Full iServer spatial analysis process service.
- 3D scene publication.
- Authentication or account changes.

These can come later after the main WebGIS demo reads as complete.
