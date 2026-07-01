import type { BasemapMode } from "../../config/supermap";
import type { SupportPoint } from "../../data/supportPoints";
import type { MarathonRoute } from "../../domain/routeMetrics";
import { roadNetworkStyle } from "../layers/RoadNetworkLayer";
import { computeRouteStyle, findNearestRouteId, toLeafletLatLngs } from "../layers/RouteLayer";
import { computeSupportPointStyle, formatSupportPointLabel, toLeafletLatLng } from "../layers/SupportPointLayer";

export interface MapEngineOptions {
  container: HTMLElement;
  wmsUrl: string;
  wmsLayerName: string;
  onlineTileUrl: string;
  onlineAttribution: string;
  defaultBasemap: BasemapMode;
  center: [number, number];
  zoom: number;
}

export class MapEngine {
  private map: unknown = null;
  private routeLayers: Map<string, unknown> = new Map();
  private supportPointLayers: unknown[] = [];
  private roadNetworkLayers: unknown[] = [];
  private roadNetworkLines: [number, number][][] = [];
  private basemapLayers: Partial<Record<BasemapMode, unknown>> = {};
  private activeBasemapLayer: unknown = null;
  private onRouteClickCb: ((id: string) => void) | null = null;
  private container: HTMLElement;
  private wmsUrl: string;
  private wmsLayerName: string;
  private onlineTileUrl: string;
  private onlineAttribution: string;
  private basemapMode: BasemapMode;
  private center: [number, number];
  private zoom: number;
  private destroyed = false;
  private routes: MarathonRoute[] = [];
  private supportPoints: SupportPoint[] = [];
  private activeRouteId = "";
  private comparedRouteIds: string[] = [];
  private routesVisible = true;
  private supportPointsVisible = true;
  private roadNetworkVisible = true;

  constructor(options: MapEngineOptions) {
    this.container = options.container;
    this.wmsUrl = options.wmsUrl;
    this.wmsLayerName = options.wmsLayerName;
    this.onlineTileUrl = options.onlineTileUrl;
    this.onlineAttribution = options.onlineAttribution;
    this.basemapMode = options.defaultBasemap;
    this.center = options.center;
    this.zoom = options.zoom;
  }

  initialize(): void {
    if (this.destroyed) return;

    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) {
      this.showFallback("Leaflet 地图库未加载");
      return;
    }

    const mapDiv = document.createElement("div");
    mapDiv.style.width = "100%";
    mapDiv.style.height = "100%";
    this.container.appendChild(mapDiv);

    const map = (L.map as (el: HTMLElement, opts?: Record<string, unknown>) => unknown)(mapDiv, {
      center: [this.center[1], this.center[0]],
      zoom: this.zoom,
      zoomControl: false,
      attributionControl: true
    });
    this.map = map;

    const tileLayer = L.tileLayer as ((url: string, opts?: Record<string, unknown>) => unknown) & {
      wms: (url: string, opts: Record<string, unknown>) => unknown;
    };

    this.basemapLayers.online = tileLayer(this.onlineTileUrl, {
      attribution: this.onlineAttribution,
      maxZoom: 19
    });
    this.basemapLayers.supermapDem = tileLayer.wms(this.wmsUrl, {
      layers: this.wmsLayerName,
      format: "image/png",
      transparent: false,
      attribution: "SuperMap iServer DEM WMS"
    });
    this.setBasemap(this.basemapMode);

    (map as { on: (event: string, cb: (e: Record<string, unknown>) => void) => void }).on("click", (e) => {
      const latlng = e.latlng as { lat: number; lng: number } | undefined;
      if (!latlng || !this.onRouteClickCb || !this.routesVisible) return;
      const clickedId = this.findNearestRoute([latlng.lng, latlng.lat]);
      if (clickedId) this.onRouteClickCb(clickedId);
    });
  }

  setBasemap(mode: BasemapMode): void {
    if (this.destroyed || !this.map) return;
    const nextLayer = this.basemapLayers[mode];
    if (!nextLayer) return;

    const mapWithLayers = this.map as { removeLayer?: (l: unknown) => void };
    if (this.activeBasemapLayer && mapWithLayers.removeLayer) {
      mapWithLayers.removeLayer(this.activeBasemapLayer);
    }

    (nextLayer as { addTo: (m: unknown) => unknown }).addTo(this.map);
    this.activeBasemapLayer = nextLayer;
    this.basemapMode = mode;
  }

  setRoutes(routes: MarathonRoute[]): void {
    if (this.destroyed || !this.map) return;
    this.routes = routes;
    this.clearRouteLayers();
    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) return;

    const polyline = L.polyline as (latlngs: [number, number][], opts?: Record<string, unknown>) => unknown;

    for (const route of routes) {
      const layer = polyline(toLeafletLatLngs(route.coordinates), this.computeVisibleRouteStyle(route, false, true));
      (layer as { addTo: (m: unknown) => unknown }).addTo(this.map);
      this.routeLayers.set(route.id, layer);
    }
  }

  highlightRoute(activeRouteId: string, comparedRouteIds: string[]): void {
    if (this.destroyed || !this.map) return;
    this.activeRouteId = activeRouteId;
    this.comparedRouteIds = comparedRouteIds;
    for (const [id, layer] of this.routeLayers) {
      const isActive = id === activeRouteId;
      const isCompared = comparedRouteIds.includes(id);
      const route = this.routes.find((item) => item.id === id);
      const leafletLayer = layer as { setStyle?: (s: Record<string, unknown>) => void };
      if (leafletLayer.setStyle && route) {
        leafletLayer.setStyle(this.computeVisibleRouteStyle(route, isActive, isCompared));
      }
    }
    this.renderSupportPoints();
  }

  setSupportPoints(points: SupportPoint[]): void {
    if (this.destroyed || !this.map) return;
    this.supportPoints = points;
    this.renderSupportPoints();
  }

  setRoadNetwork(lines: [number, number][][]): void {
    if (this.destroyed || !this.map) return;
    this.roadNetworkLines = lines;
    this.renderRoadNetwork();
  }

  private renderRoadNetwork(): void {
    if (this.destroyed || !this.map) return;
    this.clearRoadNetworkLayers();
    if (!this.roadNetworkVisible) return;

    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) return;

    const polyline = L.polyline as (latlngs: [number, number][], opts?: Record<string, unknown>) => unknown;
    const style = roadNetworkStyle();

    for (const line of this.roadNetworkLines) {
      const layer = polyline(line, style);
      const orderedLayer = layer as {
        addTo: (m: unknown) => unknown;
        bringToBack?: () => unknown;
      };
      orderedLayer.addTo(this.map);
      orderedLayer.bringToBack?.();
      this.roadNetworkLayers.push(layer);
    }
  }

  setLayerVisibility(visibility: { routes?: boolean; supportPoints?: boolean; roadNetwork?: boolean }): void {
    if (typeof visibility.routes === "boolean") {
      this.routesVisible = visibility.routes;
      this.highlightRoute(this.activeRouteId, this.comparedRouteIds);
    }
    if (typeof visibility.supportPoints === "boolean") {
      this.supportPointsVisible = visibility.supportPoints;
      this.renderSupportPoints();
    }
    if (typeof visibility.roadNetwork === "boolean") {
      this.roadNetworkVisible = visibility.roadNetwork;
      this.renderRoadNetwork();
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

  whenReady(callback: () => void): void {
    if (this.destroyed || !this.map) return;
    const mapWithReady = this.map as { whenReady?: (cb: () => void) => void };
    if (mapWithReady.whenReady) {
      mapWithReady.whenReady(callback);
    } else {
      callback();
    }
  }

  invalidateSize(): void {
    if (this.destroyed || !this.map) return;
    const mapWithInvalidate = this.map as { invalidateSize?: () => void };
    if (mapWithInvalidate.invalidateSize) mapWithInvalidate.invalidateSize();
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
    this.clearSupportPointLayers();
    this.clearRoadNetworkLayers();
    this.basemapLayers = {};
    this.activeBasemapLayer = null;
    this.container.innerHTML = "";
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

  private clearRouteLayers(): void {
    for (const layer of this.routeLayers.values()) {
      if (this.map) {
        const mapWithRemove = this.map as { removeLayer?: (l: unknown) => void };
        if (mapWithRemove.removeLayer) mapWithRemove.removeLayer(layer);
      }
    }
    this.routeLayers.clear();
  }

  private renderSupportPoints(): void {
    if (this.destroyed || !this.map) return;
    this.clearSupportPointLayers();
    if (!this.supportPointsVisible) return;

    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) return;

    const circleMarker = L.circleMarker as (latlng: [number, number], opts?: Record<string, unknown>) => unknown;

    for (const point of this.supportPoints) {
      const isHighlighted = point.routeId === this.activeRouteId || this.comparedRouteIds.includes(point.routeId);
      const layer = circleMarker(toLeafletLatLng(point), computeSupportPointStyle(point, isHighlighted));
      const marker = layer as {
        addTo?: (m: unknown) => unknown;
        bindTooltip?: (label: string, opts?: Record<string, unknown>) => unknown;
        on?: (event: string, cb: () => void) => void;
      };
      marker.bindTooltip?.(formatSupportPointLabel(point), {
        direction: "top",
        sticky: true
      });
      marker.on?.("click", () => this.onRouteClickCb?.(point.routeId));
      marker.addTo?.(this.map);
      this.supportPointLayers.push(layer);
    }
  }

  private clearSupportPointLayers(): void {
    for (const layer of this.supportPointLayers) {
      if (this.map) {
        const mapWithRemove = this.map as { removeLayer?: (l: unknown) => void };
        if (mapWithRemove.removeLayer) mapWithRemove.removeLayer(layer);
      }
    }
    this.supportPointLayers = [];
  }

  private clearRoadNetworkLayers(): void {
    for (const layer of this.roadNetworkLayers) {
      if (this.map) {
        const mapWithRemove = this.map as { removeLayer?: (l: unknown) => void };
        if (mapWithRemove.removeLayer) mapWithRemove.removeLayer(layer);
      }
    }
    this.roadNetworkLayers = [];
  }

  private computeVisibleRouteStyle(route: MarathonRoute, isActive: boolean, isCompared: boolean): Record<string, unknown> {
    const style = computeRouteStyle(route, isActive, isCompared);
    if (!this.routesVisible) {
      return {
        ...style,
        opacity: 0,
        weight: 0
      };
    }
    return style;
  }

  private findNearestRoute(coord: [number, number]): string | null {
    return findNearestRouteId(this.routes, coord);
  }
}
