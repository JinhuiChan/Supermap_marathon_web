# Real Road Network Integration Design

## Goal

Upgrade the route generation pipeline from the built-in simulated Wuhan graph to a real OpenStreetMap road network file, while keeping the current demo stable if the local data file is missing.

## Scope

This phase focuses on data ingestion and graph construction only. It does not attempt to perfect the 42.195 km search algorithm, publish the road network to iServer, or add a full route-planning wizard.

## Inputs

- Preferred local data: `E:\SuperMap\data\wuhan_roads\wuhan-roads-overpass.geojson`
- Format: GeoJSON FeatureCollection
- Geometry support: `LineString` and `MultiLineString`
- Useful OSM properties: `highway`, `bridge`, `tunnel`, `name`

Large source files stay outside GitHub. The repo should contain import code, tests, and documentation, not the downloaded OSM data.

## Architecture

Add a small GeoJSON parser under `src/data/roadNetworkGeoJson.ts`. It converts road features into the existing `RoadGraph` model by creating nodes at line vertices and edges between adjacent coordinates. The existing `routeGenerator` continues to operate on `RoadGraph`, so the algorithm does not need a rewrite in this phase.

The browser can load the local road GeoJSON from `public/data` when available, but the first implementation should also expose pure functions that can be tested without network or browser APIs.

## Data Mapping

- OSM `highway=motorway|trunk` maps to high-capacity route levels.
- OSM `primary`, `secondary`, `tertiary`, `residential`, `service`, `track` map directly where possible.
- OSM `footway`, `path`, `cycleway`, `pedestrian`, `living_street`, and unknown minor roads map to `greenway` or `residential` depending on marathon usefulness.
- `bridge=yes` and `tunnel=yes` become graph edge flags.
- Edge length is computed from coordinate pairs using the existing haversine function.

## Error Handling

Invalid or unsupported features are skipped. Empty feature collections produce an empty graph rather than throwing. Malformed coordinate arrays are ignored at the segment level.

## Testing

Tests should cover:

- Building a graph from a simple LineString.
- Splitting a MultiLineString into multiple connected edge chains.
- Mapping common OSM road levels into `RoadLevel`.
- Skipping malformed features without breaking the full import.

## Next Phase

After the graph import is stable, generate routes from the real graph and add UI controls for start/end/required points. The route-length accuracy problem should be solved after the data import, because real road segment lengths and density change the search behavior substantially.
