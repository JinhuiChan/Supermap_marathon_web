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
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  for (const bundle of CANDIDATES) {
    const url = `${normalizedBase}${bundle.scriptUrl}`;
    try {
      const response = await fetch(url, {
        method: "HEAD",
        cache: "no-store",
        signal: AbortSignal.timeout(5000)
      });
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
 *
 * Note: `baseUrl` is empty here because the script and CSS URLs are
 * absolute CDN URLs. Consumers should check `baseUrl` before using it
 * for resolving relative resources (workers, fonts, icons, etc.).
 */
export function getCDNFallback(): iClientBundle {
  return {
    variant: "leaflet",
    scriptUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    cssUrl: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    baseUrl: ""
  };
}
