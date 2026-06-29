import type { Coordinate } from "./routeMetrics";
import type { RoadLevel } from "./roadNetwork";

// ---- Haversine distance (km) ----

export function haversineKm(a: Coordinate, b: Coordinate): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ---- Road quality multiplier ----

const levelOrder: RoadLevel[] = [
  "greenway",
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "service",
  "track"
];

const qualityMap: Record<RoadLevel, number> = {
  greenway: 0.55,
  motorway: 0.85,
  trunk: 0.88,
  primary: 0.92,
  secondary: 1.0,
  tertiary: 1.25,
  residential: 1.8,
  service: 2.2,
  track: 2.5
};

export function qualityMultiplier(level: RoadLevel, isTunnel: boolean): number {
  let m = qualityMap[level] ?? 1.0;
  if (isTunnel) m *= 2.0;
  return m;
}

// ---- Synthetic elevation (stub — replace with DEM lookup) ----

/**
 * STUB: Gaussian-bump elevation model for Wuhan.
 * Replace with rasterio DEM lookup when real data is available.
 */
export function getElevation(coord: Coordinate): number {
  const [lon, lat] = coord;
  let e = 24; // base elevation for Wuhan

  // East Lake hills
  e += 55 * Math.exp(-((lon - 114.4) ** 2 + (lat - 30.55) ** 2) / 0.0003);
  // Hanyang rise
  e += 28 * Math.exp(-((lon - 114.25) ** 2 + (lat - 30.58) ** 2) / 0.0004);
  // Qingshan slight elevation
  e += 12 * Math.exp(-((lon - 114.38) ** 2 + (lat - 30.62) ** 2) / 0.0005);

  return Math.round(e);
}

// ---- Slope between two coordinates ----

export function slopePercent(from: Coordinate, to: Coordinate): number {
  const distKm = haversineKm(from, to);
  if (distKm < 0.001) return 0;
  const elevDiffM = getElevation(to) - getElevation(from);
  return (elevDiffM / (distKm * 1000)) * 100;
}

// ---- Turn angle (degrees, 0-180) between three points ----

export function turnAngle(a: Coordinate, b: Coordinate, c: Coordinate): number {
  const v1: [number, number] = [b[0] - a[0], b[1] - a[1]];
  const v2: [number, number] = [c[0] - b[0], c[1] - b[1]];
  const dot = v1[0] * v2[0] + v1[1] * v2[1];
  const mag1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2);
  const mag2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2);
  if (mag1 < 1e-12 || mag2 < 1e-12) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}
