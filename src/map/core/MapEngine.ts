import type { MarathonRoute } from "../../domain/routeMetrics";

export interface MapEngineOptions {
  container: HTMLElement;
  wmsUrl: string;
  wmsLayerName: string;
  center: [number, number];
  zoom: number;
}

export class MapEngine {
  private map: unknown = null;
  private routeLayers: Map<string, unknown> = new Map();
  private onRouteClickCb: ((id: string) => void) | null = null;
  private container: HTMLElement;
  private wmsUrl: string;
  private wmsLayerName: string;
  private center: [number, number];
  private zoom: number;
  private destroyed = false;

  constructor(options: MapEngineOptions) {
    this.container = options.container;
    this.wmsUrl = options.wmsUrl;
    this.wmsLayerName = options.wmsLayerName;
    this.center = options.center;
    this.zoom = options.zoom;
  }

  initialize(): void {
    if (this.destroyed) return;

    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) {
      this.showFallback("Leaflet 库未加载");
      return;
    }

    const mapDiv = document.createElement("div");
    mapDiv.style.width = "100%";
    mapDiv.style.height = "100%";
    this.container.appendChild(mapDiv);

    const mapOptions: Record<string, unknown> = {
      center: [this.center[1], this.center[0]],
      zoom: this.zoom,
      attributionControl: true
    };

    const map = (L.map as (el: HTMLElement, opts?: Record<string, unknown>) => unknown)(mapDiv, mapOptions);
    this.map = map;

    // Use WMS tile layer — confirmed working with SuperMap iServer
    const wmsLayer = (L.tileLayer as { wms: (url: string, opts: Record<string, unknown>) => unknown }).wms(
      this.wmsUrl,
      {
        layers: this.wmsLayerName,
        format: "image/png",
        transparent: true,
        attribution: "SuperMap iServer WMS"
      }
    );
    (wmsLayer as { addTo: (m: unknown) => unknown }).addTo(map);

    // Click → find nearest route
    (map as { on: (event: string, cb: (e: Record<string, unknown>) => void) => void }).on("click", (e: Record<string, unknown>) => {
      const latlng = e.latlng as { lat: number; lng: number } | undefined;
      if (!latlng || !this.onRouteClickCb) return;
      const clickedId = this.findNearestRoute([latlng.lng, latlng.lat]);
      if (clickedId) this.onRouteClickCb(clickedId);
    });
  }

  private showFallback(message: string): void {
    const fallbackDiv = document.createElement("div");
    fallbackDiv.className = "map-fallback-message";
    fallbackDiv.style.display = "flex";
    fallbackDiv.style.alignItems = "center";
    fallbackDiv.style.justifyContent = "center";
    fallbackDiv.style.height = "100%";
    fallbackDiv.style.color = "#687789";
    fallbackDiv.style.fontSize = "14px";
    fallbackDiv.style.padding = "2rem";
    fallbackDiv.style.textAlign = "center";
    fallbackDiv.textContent = message;
    this.container.appendChild(fallbackDiv);
  }

  setRoutes(routes: MarathonRoute[]): void {
    if (this.destroyed || !this.map) return;
    this.clearRouteLayers();
    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) return;

    const polyline = L.polyline as (latlngs: [number, number][], opts?: Record<string, unknown>) => unknown;

    for (const route of routes) {
      const latlngs: [number, number][] = route.coordinates.map(([lon, lat]) => [lat, lon]);
      const layer = polyline(latlngs, {
        color: route.color,
        weight: 3,
        opacity: 0.8
      });
      (layer as { addTo: (m: unknown) => unknown }).addTo(this.map);
      this.routeLayers.set(route.id, layer);
    }
  }

  highlightRoute(activeRouteId: string, comparedRouteIds: string[]): void {
    if (this.destroyed || !this.map) return;
    for (const [id, layer] of this.routeLayers) {
      const isActive = id === activeRouteId;
      const isCompared = comparedRouteIds.includes(id);
      const leafletLayer = layer as { setStyle?: (s: Record<string, unknown>) => void };
      if (leafletLayer.setStyle) {
        leafletLayer.setStyle({
          weight: isActive ? 5 : isCompared ? 3.5 : 2,
          opacity: isActive || isCompared ? 1 : 0.42
        });
      }
    }
  }

  fitBounds(coordinates: [number, number][]): void {
    if (this.destroyed || !this.map || coordinates.length === 0) return;
    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) return;

    const latlngs = coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
    const bounds = (L.latLngBounds as (latlngs: [number, number][]) => unknown)(latlngs);
    const mapWithFit = this.map as { fitBounds?: (b: unknown, opts?: Record<string, unknown>) => void };
    if (mapWithFit.fitBounds) {
      mapWithFit.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  onRouteClick(callback: (id: string) => void): void {
    if (this.destroyed) return;
    this.onRouteClickCb = callback;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.map) {
      const mapWithRemove = this.map as { remove?: () => void };
      if (mapWithRemove.remove) mapWithRemove.remove();
      this.map = null;
    }
    this.routeLayers.clear();
    this.container.innerHTML = "";
  }

  private clearRouteLayers(): void {
    for (const layer of this.routeLayers.values()) {
      if (this.map) {
        const mapWithRemove = this.map as { removeLayer?: (l: unknown) => void };
        if (mapWithRemove.removeLayer) mapWithRemove.removeLayer(layer);
      }
    }
    this.routeLayers.clear();
  }

  private findNearestRoute(coord: [number, number]): string | null {
    const threshold = 0.008;
    let closest: string | null = null;
    let closestDist = Infinity;

    for (const [id, layer] of this.routeLayers) {
      const latlngs = (layer as { getLatLngs?: () => unknown[] }).getLatLngs?.() ?? [];
      for (const ll of latlngs) {
        const pt = ll as { lat: number; lng: number };
        const d = Math.hypot(coord[0] - pt.lng, coord[1] - pt.lat);
        if (d < threshold && d < closestDist) {
          closestDist = d;
          closest = id;
        }
      }
    }
    return closest;
  }
}
