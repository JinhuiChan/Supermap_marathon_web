/**
 * Auto-discovers the available SuperMap iClient JavaScript library
 * variant and entry path on the running iServer.
 *
 * iClient 2025 ships three variants:
 *   - Leaflet   (lightest, preferred)
 *   - OpenLayers
 *   - MapboxGL
 *
 * This module probes known URL patterns and returns the first match.
 */

export type iClientVariant = "leaflet" | "openlayers" | "mapboxgl";

export interface iClientBundle {
  variant: iClientVariant;
  scriptUrl: string;
  cssUrl: string | null;
  baseUrl: string;
}

const CANDIDATES: iClientBundle[] = [
  {
    variant: "leaflet",
    scriptUrl: "/iserver/iClient/forJavaScript/dist/leaflet/iclient-leaflet.min.js",
    cssUrl: "/iserver/iClient/forJavaScript/dist/leaflet/iclient-leaflet.min.css",
    baseUrl: "/iserver/iClient/forJavaScript/dist/leaflet/"
  },
  {
    variant: "leaflet",
    scriptUrl: "/iserver/iClient/forJavaScript/web/dist/leaflet/iclient-leaflet.min.js",
    cssUrl: "/iserver/iClient/forJavaScript/web/dist/leaflet/iclient-leaflet.min.css",
    baseUrl: "/iserver/iClient/forJavaScript/web/dist/leaflet/"
  },
  {
    variant: "openlayers",
    scriptUrl: "/iserver/iClient/forJavaScript/dist/openlayers/iclient-openlayers.min.js",
    cssUrl: "/iserver/iClient/forJavaScript/dist/openlayers/iclient-openlayers.min.css",
    baseUrl: "/iserver/iClient/forJavaScript/dist/openlayers/"
  },
  {
    variant: "mapboxgl",
    scriptUrl: "/iserver/iClient/forJavaScript/dist/mapboxgl/iclient-mapboxgl.min.js",
    cssUrl: "/iserver/iClient/forJavaScript/dist/mapboxgl/iclient-mapboxgl.min.css",
    baseUrl: "/iserver/iClient/forJavaScript/dist/mapboxgl/"
  }
];

export async function discoveriClientBundle(baseUrl: string): Promise<iClientBundle | null> {
  for (const bundle of CANDIDATES) {
    const url = `${baseUrl}${bundle.scriptUrl}`;
    try {
      const response = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (response.ok) return bundle;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Fallback: try loading Leaflet from CDN if iServer bundle not found.
 * This covers the case where iClient is installed but at a non-standard path.
 */
export function getCDNFallback(): iClientBundle {
  return {
    variant: "leaflet",
    scriptUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    cssUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    baseUrl: ""
  };
}
