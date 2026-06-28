import type { MarathonRoute } from "../../domain/routeMetrics";
import type { iClientBundle } from "./iClientDiscovery";

export interface MapEngineOptions {
  container: HTMLElement;
  bundle: iClientBundle;
  baseLayerUrl: string;
  center: [number, number];
  zoom: number;
}

export class MapEngine {
  private map: unknown = null;
  private routeLayers: Map<string, unknown> = new Map();
  private onRouteClickCb: ((id: string) => void) | null = null;
  private container: HTMLElement;
  private bundle: iClientBundle;
  private baseLayerUrl: string;
  private center: [number, number];
  private zoom: number;
  private destroyed = false;

  constructor(options: MapEngineOptions) {
    this.container = options.container;
    this.bundle = options.bundle;
    this.baseLayerUrl = options.baseLayerUrl;
    this.center = options.center;
    this.zoom = options.zoom;
  }

  initialize(): void {
    if (this.destroyed) return;

    const mapDiv = document.createElement("div");
    mapDiv.style.width = "100%";
    mapDiv.style.height = "100%";
    this.container.appendChild(mapDiv);

    if (this.bundle.variant === "leaflet") {
      this.initLeafletMap(mapDiv);
    } else {
      this.initGenericMap(mapDiv);
    }
  }

  private initLeafletMap(container: HTMLElement): void {
    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) {
      console.warn("Leaflet (L) not found on window — iClient script may not have loaded correctly");
      return;
    }

    const mapOptions: Record<string, unknown> = {
      center: [this.center[1], this.center[0]],
      zoom: this.zoom,
      attributionControl: true
    };

    const map = (L.map as (el: string | HTMLElement, opts?: Record<string, unknown>) => unknown)(container, mapOptions);
    this.map = map;

    const tiledMapLayer = this.createLeafletTileLayer(L);
    if (tiledMapLayer) {
      (tiledMapLayer as { addTo: (m: unknown) => unknown }).addTo(map);
    }

    (map as { on: (event: string, cb: (e: Record<string, unknown>) => void) => void }).on("click", (e: Record<string, unknown>) => {
      const latlng = e.latlng as { lat: number; lng: number } | undefined;
      if (!latlng || !this.onRouteClickCb) return;
      const clickedId = this.findNearestRoute([latlng.lng, latlng.lat]);
      if (clickedId) this.onRouteClickCb(clickedId);
    });
  }

  private createLeafletTileLayer(L: Record<string, unknown>): unknown {
    const supermap = L.supermap as Record<string, unknown> | undefined;
    if (supermap && typeof supermap.tiledMapLayer === "function") {
      return (supermap.tiledMapLayer as (url: string, opts?: Record<string, unknown>) => unknown)(
        this.baseLayerUrl,
        { noWrap: true }
      );
    }

    const TileLayer = L.tileLayer as (urlTemplate: string, opts?: Record<string, unknown>) => unknown;
    const tileUrl = `${this.baseLayerUrl}/tile/{z}/{y}/{x}`;
    return TileLayer(tileUrl, {
      attribution: "SuperMap iServer",
      noWrap: true
    });
  }

  private initGenericMap(container: HTMLElement): void {
    const fallbackDiv = document.createElement("div");
    fallbackDiv.style.display = "flex";
    fallbackDiv.style.alignItems = "center";
    fallbackDiv.style.justifyContent = "center";
    fallbackDiv.style.height = "100%";
    fallbackDiv.style.color = "#687789";
    fallbackDiv.textContent = `iClient ${this.bundle.variant} variant — map loading requires Leaflet variant.`;
    container.appendChild(fallbackDiv);
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
    for (const [id, layer] of this.routeLayers) {
      const isActive = id === activeRouteId;
      const isCompared = comparedRouteIds.includes(id);
      const leafletLayer = layer as {
        setStyle?: (s: Record<string, unknown>) => void;
      };
      if (leafletLayer.setStyle) {
        leafletLayer.setStyle({
          weight: isActive ? 5 : isCompared ? 3.5 : 2,
          opacity: isActive || isCompared ? 1 : 0.42
        });
      }
    }
  }

  setCenter(center: [number, number], zoom?: number): void {
    if (this.destroyed || !this.map) return;
    const mapWithView = this.map as { setView?: (c: [number, number], z: number) => void };
    if (mapWithView.setView) {
      mapWithView.setView([center[1], center[0]], zoom ?? this.zoom);
    }
  }

  onRouteClick(callback: (id: string) => void): void {
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
    const threshold = 0.005;
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
