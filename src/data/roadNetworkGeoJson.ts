import { haversineKm } from "../domain/roadAttributes";
import {
  addEdge,
  addNode,
  createEmptyGraph,
  type RoadGraph,
  type RoadLevel
} from "../domain/roadNetwork";
import type { Coordinate } from "../domain/routeMetrics";

type GeoJsonFeature = {
  type?: string;
  properties?: Record<string, unknown> | null;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
};

export interface GeoJsonBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface RoadGeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export const WUHAN_MARATHON_AREA_BOUNDS: GeoJsonBounds = {
  minLon: 114.235,
  minLat: 30.525,
  maxLon: 114.475,
  maxLat: 30.652
};

export const WUHAN_MARATHON_ROUTE_CORRIDOR_KM = 1.5;
const MIN_MARATHON_ROAD_WIDTH_M = 6;
const LONG_TUNNEL_KM = 0.8;
const ROAD_NODE_SNAP_DECIMALS = 5;

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

export function isCompetitionSuitableRoadLevel(roadLevel: RoadLevel): boolean {
  return roadLevel === "trunk" || roadLevel === "primary" || roadLevel === "secondary" || roadLevel === "tertiary";
}

export function buildRoadGraphFromGeoJson(geojson: unknown): RoadGraph {
  const graph = createEmptyGraph();
  const features = getFeatures(geojson);

  features.forEach((feature, featureIndex) => {
    const properties = feature.properties ?? {};
    const lines = extractLines(feature.geometry);

    lines.forEach((line, lineIndex) => {
      addLineToGraph(graph, line, properties, featureIndex, lineIndex);
    });
  });

  return graph;
}

export function filterRoadGeoJsonByBounds(
  geojson: unknown,
  bounds: GeoJsonBounds
): RoadGeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: getFeatures(geojson).filter((feature) =>
      extractLines(feature.geometry).some((line) =>
        line.some((coordinate) => coordinateInBounds(coordinate, bounds))
      )
    )
  };
}

export function filterRoadGeoJsonByRouteCorridor(
  geojson: unknown,
  routeCoordinates: Coordinate[],
  maxDistanceKm: number
): RoadGeoJsonFeatureCollection {
  if (routeCoordinates.length < 2 || maxDistanceKm <= 0) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: getFeatures(geojson).filter((feature) =>
      extractLines(feature.geometry).some((line) =>
        line.some((coordinate) =>
          distanceToRouteKm(coordinate, routeCoordinates) <= maxDistanceKm
        )
      )
    )
  };
}

function getFeatures(geojson: unknown): GeoJsonFeature[] {
  if (!geojson || typeof geojson !== "object") return [];
  const maybeCollection = geojson as { features?: unknown };
  if (!Array.isArray(maybeCollection.features)) return [];
  return maybeCollection.features.filter((feature): feature is GeoJsonFeature =>
    Boolean(feature && typeof feature === "object")
  );
}

function extractLines(geometry: GeoJsonFeature["geometry"]): Coordinate[][] {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];

  if (geometry.type === "LineString") {
    const line = normalizeLine(geometry.coordinates);
    return line.length > 1 ? [line] : [];
  }

  if (geometry.type === "MultiLineString") {
    return geometry.coordinates
      .filter(Array.isArray)
      .map((line) => normalizeLine(line))
      .filter((line) => line.length > 1);
  }

  return [];
}

function normalizeLine(rawCoordinates: unknown[]): Coordinate[] {
  return rawCoordinates
    .map((coordinate) => normalizeCoordinate(coordinate))
    .filter((coordinate): coordinate is Coordinate => coordinate !== null);
}

function normalizeCoordinate(value: unknown): Coordinate | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = value[0];
  const lat = value[1];
  if (typeof lon !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [lon, lat];
}

function coordinateInBounds(coordinate: Coordinate, bounds: GeoJsonBounds): boolean {
  const [lon, lat] = coordinate;
  return (
    lon >= bounds.minLon &&
    lon <= bounds.maxLon &&
    lat >= bounds.minLat &&
    lat <= bounds.maxLat
  );
}

function distanceToRouteKm(coordinate: Coordinate, routeCoordinates: Coordinate[]): number {
  let shortest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < routeCoordinates.length - 1; index++) {
    shortest = Math.min(
      shortest,
      distanceToSegmentKm(coordinate, routeCoordinates[index], routeCoordinates[index + 1])
    );
  }
  return shortest;
}

function distanceToSegmentKm(point: Coordinate, start: Coordinate, end: Coordinate): number {
  const originLat = point[1];
  const p = projectToLocalKm(point, originLat);
  const a = projectToLocalKm(start, originLat);
  const b = projectToLocalKm(end, originLat);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  const nearest = {
    x: a.x + t * dx,
    y: a.y + t * dy
  };

  return Math.hypot(p.x - nearest.x, p.y - nearest.y);
}

function projectToLocalKm(coordinate: Coordinate, originLat: number): { x: number; y: number } {
  const kmPerDegreeLat = 110.574;
  const kmPerDegreeLon = 111.32 * Math.cos((originLat * Math.PI) / 180);
  return {
    x: coordinate[0] * kmPerDegreeLon,
    y: coordinate[1] * kmPerDegreeLat
  };
}

function addLineToGraph(
  graph: RoadGraph,
  line: Coordinate[],
  properties: Record<string, unknown>,
  featureIndex: number,
  lineIndex: number
): void {
  for (const coordinate of line) {
    const nodeId = nodeIdForCoordinate(coordinate);
    if (!graph.nodes.has(nodeId)) {
      addNode(graph, { id: nodeId, coordinate });
    }
  }

  for (let index = 0; index < line.length - 1; index++) {
    const from = line[index];
    const to = line[index + 1];
    const lengthKm = haversineKm(from, to);
    if (lengthKm <= 0) continue;

    const roadLevel = mapOsmHighwayToRoadLevel(properties.highway ?? properties.road_level ?? properties.fclass);
    const impedance = normalizeNumber(properties.impedance);
    const baseImpedance = normalizeNumber(properties.base_impedance);
    const slopeImpedance = normalizeNumber(properties.slope_impedance);
    const constraintImpedance = normalizeNumber(properties.constraint_impedance);
    const suitabilityScore = normalizeNumber(properties.suitability);
    const slopeMean = normalizeNumber(properties.slope_mean);
    const slopeMax = normalizeNumber(properties.slope_max);
    const explicitControlOk = normalizeControlFlag(properties.control_ok);
    const isBridge = isOsmTagTrue(properties.bridge);
    const isTunnel = isOsmTagTrue(properties.tunnel);
    const isElevated = detectElevatedRoad(properties, isBridge);
    const roadName = resolveRoadName(properties);
    const isRequiredRiverBridge = isNamedWuhanYangtzeBridge(roadName, isBridge);
    const roadWidthM = resolveRoadWidthM(properties, roadLevel);
    const surfaceSuitable = isSuitableRoadSurface(properties.surface);
    const terrainMeasured = slopeMean !== null;
    const baseCompetitionSuitable = explicitControlOk ?? (isCompetitionSuitableRoadLevel(roadLevel) || roadLevel === "greenway");
    const slopeTooSteepForMarathon = !isRequiredRiverBridge && slopeMean !== null && Math.abs(slopeMean) > 5;
    const competitionSuitable =
      (isRequiredRiverBridge || baseCompetitionSuitable) &&
      roadWidthM >= MIN_MARATHON_ROAD_WIDTH_M &&
      surfaceSuitable &&
      !isElevated &&
      !(isTunnel && lengthKm >= LONG_TUNNEL_KM) &&
      !slopeTooSteepForMarathon;
    const hasDecomposedImpedance =
      baseImpedance !== null || slopeImpedance !== null || constraintImpedance !== null || typeof properties.slope_source === "string";
    const slopePenalty = hasDecomposedImpedance
      ? Math.max(0, slopeImpedance ?? 0)
      : slopeMean === null ? 0 : slopeResistancePenalty(slopeMean);
    const constraintPenalty = hasDecomposedImpedance
      ? Math.max(0, constraintImpedance ?? (competitionSuitable ? 0 : 80))
      : competitionSuitable ? 0 : 80;
    const explicitPenalty = hasDecomposedImpedance
      ? Math.max(0, baseImpedance ?? ((impedance ?? 0) - slopePenalty - constraintPenalty))
      : Math.max(0, impedance ?? 0);
    const totalPenalty = hasDecomposedImpedance && impedance !== null
      ? Math.max(0, impedance)
      : explicitPenalty + slopePenalty + constraintPenalty;
    const edgeId = `osm-${featureIndex}-${lineIndex}-${index}`;
    addEdge(graph, {
      id: edgeId,
      physicalEdgeId: edgeId,
      fromNodeId: nodeIdForCoordinate(from),
      toNodeId: nodeIdForCoordinate(to),
      lengthKm,
      roadLevel,
      isBridge,
      isTunnel,
      isElevated,
      competitionSuitable,
      baselineCost: lengthKm * (1 + totalPenalty / 100),
      roadWidthM,
      roadName,
      isRequiredRiverBridge,
      slopeFiltered: slopeTooSteepForMarathon,
      coordinates: [from, to],
      surfaceSuitable,
      terrainMeasured,
      ...(suitabilityScore === null ? {} : { suitabilityScore }),
      ...(slopeMean === null ? {} : { slopeMean }),
      ...(slopeMax === null ? {} : { slopeMax }),
      impedanceBreakdown: {
        base: lengthKm,
        explicit: explicitPenalty,
        slope: slopePenalty,
        constraint: constraintPenalty
      }
    });
  }
}

function slopeResistancePenalty(slopeMean: number): number {
  const slope = Math.abs(slopeMean);
  if (slope <= 1.5) return 0;
  if (slope <= 3) return Math.round((slope - 1.5) * 8);
  if (slope <= 6) return Math.round(12 + (slope - 3) * 12);
  return Math.round(48 + Math.min(52, (slope - 6) * 10));
}

function isSuitableRoadSurface(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() === "") return true;
  const surface = value.trim().toLocaleLowerCase();
  return !new Set([
    "grass",
    "ground",
    "dirt",
    "earth",
    "mud",
    "sand",
    "gravel",
    "fine_gravel",
    "unpaved"
  ]).has(surface);
}

function resolveRoadName(properties: Record<string, unknown>): string {
  return String(properties.name ?? properties.road_name ?? properties.NAME ?? "").trim();
}

function isNamedWuhanYangtzeBridge(name: string, isBridge: boolean): boolean {
  return isBridge && /武汉长江大桥/.test(name);
}

function resolveRoadWidthM(properties: Record<string, unknown>, roadLevel: RoadLevel): number {
  const explicitWidth =
    normalizeNumber(properties.width_m) ??
    normalizeNumber(properties.width) ??
    normalizeNumber(properties.road_width) ??
    normalizeNumber(properties.carriageway_width);
  if (explicitWidth !== null) return explicitWidth;

  const lanes = normalizeNumber(properties.lanes);
  if (lanes !== null && lanes > 0) return lanes * 3.25;

  switch (roadLevel) {
    case "motorway":
    case "trunk":
      return 12;
    case "primary":
      return 10;
    case "secondary":
      return 8;
    case "tertiary":
      return 6.5;
    case "greenway":
      return properties.highway === "cycleway" || isNamedScenicGreenway(properties) ? 6 : 4;
    case "residential":
      return 5;
    case "service":
      return 4.5;
    case "track":
      return 3.5;
    default:
      return 4;
  }
}

function isNamedScenicGreenway(properties: Record<string, unknown>): boolean {
  const name = String(properties.name ?? properties.road_name ?? properties.NAME ?? "");
  return /绿道|江滩|公园|湖山道|郊野道|湖中道|东湖东路/.test(name);
}

function detectElevatedRoad(properties: Record<string, unknown>, isBridge: boolean): boolean {
  const layer = normalizeNumber(properties.layer);
  const name = String(properties.name ?? properties.road_name ?? properties.NAME ?? "").toLocaleLowerCase();
  const structure = String(properties.structure ?? properties.road_structure ?? "").toLocaleLowerCase();
  const explicitElevated = isOsmTagTrue(properties.elevated) || isOsmTagTrue(properties.viaduct) || structure.includes("elevated") || structure.includes("viaduct");
  const namedElevated = name.includes("高架") || name.includes("匝道") || name.includes("viaduct") || name.includes("elevated");
  return explicitElevated || namedElevated || (!isBridge && (layer ?? 0) > 0);
}

function nodeIdForCoordinate(coordinate: Coordinate): string {
  return `${coordinate[0].toFixed(ROAD_NODE_SNAP_DECIMALS)},${coordinate[1].toFixed(ROAD_NODE_SNAP_DECIMALS)}`;
}

function isOsmTagTrue(value: unknown): boolean {
  return value === true || value === "yes" || value === "true" || value === "1" || value === "T" || value === "t";
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeControlFlag(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "yes" || value === "1" || value === 1) return true;
  if (value === false || value === "false" || value === "no" || value === "0" || value === 0) return false;
  return null;
}
