import type { BasemapMode } from "../../config/supermap";
import type { SupportPoint } from "../../data/supportPoints";
import type { Coordinate } from "../../domain/routeMetrics";
import type { MarathonRoute } from "../../domain/routeMetrics";
import type { SupportPlanningMapPoint, SupportPlanningMapPointType } from "../../domain/routeSupportPlanningMap";
import {
  formatPoiLabel,
  formatPoiPopup,
  poiLabelDisplayMode,
  shouldShowPoiLabelAtZoom,
  sortPoiLabelsForDisplay,
  toPoiLeafletLatLng,
  visiblePoiLimitForZoom,
  type MapPoiLabel
} from "../layers/PoiLabelLayer";
import {
  formatRoadNetworkPopup,
  roadLabelKey,
  roadNetworkStyle,
  shouldShowRoadLabel,
  type RoadNetworkFeature
} from "../layers/RoadNetworkLayer";
import { buildRouteDirectionMarkers, buildRouteEndpointMarkers, computeRouteStyle, findNearestRouteId, toLeafletLatLngs } from "../layers/RouteLayer";
import {
  computeSupportPointStyle,
  formatSupportPointLabel,
  formatSupportPointPopup,
  toLeafletLatLng
} from "../layers/SupportPointLayer";
import type { VectorBasemapFeature } from "../layers/VectorBasemapLayer";

export interface MapEngineOptions {
  container: HTMLElement;
  wmsUrl: string;
  wmsLayerName: string;
  defaultBasemap: BasemapMode;
  center: [number, number];
  zoom: number;
}
export class MapEngine {
  private map: unknown = null;
  private routeLayers: Map<string, unknown> = new Map();
  private routeDirectionLayers: Map<string, unknown[]> = new Map();
  private routeEndpointLayers: unknown[] = [];
  private waypointMarkerLayers: unknown[] = [];
  private supportPointLayers: unknown[] = [];
  private poiLabelLayers: unknown[] = [];
  private vectorBasemapLayers: unknown[] = [];
  private roadNetworkLayers: unknown[] = [];
  private planningPointLayers: unknown[] = [];
  private supportPlanningPointLayers: unknown[] = [];
  private vectorBasemapFeatures: VectorBasemapFeature[] = [];
  private roadNetworkFeatures: RoadNetworkFeature[] = [];
  private basemapLayers: Partial<Record<BasemapMode, unknown>> = {};
  private activeBasemapLayer: unknown = null;
  private onRouteClickCb: ((id: string) => void) | null = null;
  private onMapClickCb: ((coordinate: Coordinate) => void) | null = null;
  private container: HTMLElement;
  private wmsUrl: string;
  private wmsLayerName: string;
  private basemapMode: BasemapMode;
  private center: [number, number];
  private zoom: number;
  private destroyed = false;
  private routes: MarathonRoute[] = [];
  private supportPoints: SupportPoint[] = [];
  private poiLabels: MapPoiLabel[] = [];
  private activeRouteId = "";
  private comparedRouteIds: string[] = [];
  private routesVisible = true;
  private supportPointsVisible = true;
  private roadNetworkVisible = true;
  private planningStartPoint: Coordinate | null = null;
  private planningEndPoint: Coordinate | null = null;

  constructor(options: MapEngineOptions) {
    this.container = options.container;
    this.wmsUrl = options.wmsUrl;
    this.wmsLayerName = options.wmsLayerName;
    this.basemapMode = options.defaultBasemap;
    this.center = options.center;
    this.zoom = options.zoom;
  }

  initialize(): void {
    if (this.destroyed) return;

    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) {
      this.showFallback("地图组件未加载");
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
      attributionControl: true,
      preferCanvas: true
    });
    this.map = map;
    this.createMapPane("vector-basemap-pane", 220, "none");
    this.createMapPane("road-network-pane", 340, "auto");
    this.createMapPane("route-overlay-pane", 460, "auto");
    this.createMapPane("support-point-pane", 520, "auto");
    this.createMapPane("planning-point-pane", 580, "auto");

    const tileLayer = L.tileLayer as ((url: string, opts?: Record<string, unknown>) => unknown) & {
      wms: (url: string, opts: Record<string, unknown>) => unknown;
    };
    this.basemapLayers.supermapDem = tileLayer.wms(this.wmsUrl, {
      layers: this.wmsLayerName,
      format: "image/png",
      transparent: false,
      attribution: "SuperMap iServer WMS"
    });
    this.setBasemap(this.basemapMode);

    (map as { on: (event: string, cb: (e: Record<string, unknown>) => void) => void }).on("click", (e) => {
      const latlng = e.latlng as { lat: number; lng: number } | undefined;
      if (!latlng) return;
      if (this.onMapClickCb) {
        this.onMapClickCb([latlng.lng, latlng.lat]);
        return;
      }
      if (!this.onRouteClickCb || !this.routesVisible) return;
      const clickedId = this.findNearestRoute([latlng.lng, latlng.lat]);
      if (clickedId) this.onRouteClickCb(clickedId);
    });
    (map as { on: (event: string, cb: () => void) => void }).on("zoomend", () => this.renderPoiLabels());
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
    this.renderVectorBasemap();
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
      this.routeDirectionLayers.set(route.id, this.createRouteDirectionLayers(route, false, true));
    }
    this.renderRouteEndpointMarkers();
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
        this.replaceRouteDirectionLayers(route, isActive, isCompared);
      }
    }
    this.renderRouteEndpointMarkers();
    this.renderSupportPoints();
  }

  setSupportPoints(points: SupportPoint[]): void {
    if (this.destroyed || !this.map) return;
    this.supportPoints = points;
    this.renderSupportPoints();
  }

  setPoiLabels(labels: MapPoiLabel[]): void {
    if (this.destroyed || !this.map) return;
    this.poiLabels = labels;
    this.renderPoiLabels();
  }

  setRoadNetwork(roads: RoadNetworkFeature[]): void {
    if (this.destroyed || !this.map) return;
    this.roadNetworkFeatures = roads;
    this.renderRoadNetwork();
  }

  setVectorBasemapFeatures(features: VectorBasemapFeature[]): void {
    if (this.destroyed || !this.map) return;
    this.vectorBasemapFeatures = features;
    this.renderVectorBasemap();
  }

  setPlanningPoints(startPoint: Coordinate | null, endPoint: Coordinate | null): void {
    if (this.destroyed || !this.map) return;
    this.planningStartPoint = startPoint;
    this.planningEndPoint = endPoint;
    this.renderPlanningPoints();
  }

  setSupportPlanningPoints(points: SupportPlanningMapPoint[]): void {
    if (this.destroyed || !this.map) return;
    this.clearSupportPlanningPointLayers();
    if (points.length === 0) return;

    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) return;
    const divIcon = L.divIcon as ((opts: Record<string, unknown>) => unknown) | undefined;
    const marker = L.marker as ((latlng: [number, number], opts?: Record<string, unknown>) => unknown) | undefined;
    if (!divIcon || !marker) return;

    for (const point of points) {
      const icon = divIcon({
        className: `support-plan-marker ${supportPlanningClass(point.type)}`,
        html: `<span><b>${supportPlanningShortLabel(point.type)}</b></span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      const layer = marker([point.coordinate[1], point.coordinate[0]], {
        icon,
        pane: "planning-point-pane",
        keyboard: false
      });
      const leafletMarker = layer as {
        addTo?: (m: unknown) => unknown;
        bindTooltip?: (label: string, opts?: Record<string, unknown>) => unknown;
        bindPopup?: (label: string, opts?: Record<string, unknown>) => unknown;
      };
      leafletMarker.bindTooltip?.(`${point.label} · ${point.mileageLabel}`, {
        direction: "top",
        permanent: point.type === "医疗",
        className: "support-plan-label",
        opacity: 0.94
      });
      leafletMarker.bindPopup?.(
        `<strong>${escapeHtml(point.label)}</strong><br>类型：${escapeHtml(point.type)}<br>建议里程：${escapeHtml(point.mileageLabel)}`,
        { maxWidth: 240 }
      );
      leafletMarker.addTo?.(this.map);
      this.supportPlanningPointLayers.push(layer);
    }
  }

  private renderRoadNetwork(): void {
    if (this.destroyed || !this.map) return;
    this.clearRoadNetworkLayers();
    if (!this.roadNetworkVisible) return;

    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) return;

    const polyline = L.polyline as (latlngs: [number, number][], opts?: Record<string, unknown>) => unknown;

    const shownRoadLabels = new Set<string>();
    let roadLabelCount = 0;

    for (const road of this.roadNetworkFeatures) {
      const layer = polyline(road.line, { ...roadNetworkStyle(road), pane: "road-network-pane" });
      const orderedLayer = layer as {
        addTo: (m: unknown) => unknown;
        bindTooltip?: (label: string, opts?: Record<string, unknown>) => unknown;
        bindPopup?: (label: string, opts?: Record<string, unknown>) => unknown;
      };
      orderedLayer.bindPopup?.(formatRoadNetworkPopup(road), {
        maxWidth: 280
      });
      const labelKey = roadLabelKey(road);
      const showPermanentLabel = Boolean(
        labelKey &&
        !shownRoadLabels.has(labelKey) &&
        shouldShowRoadLabel(road, roadLabelCount)
      );
      if (showPermanentLabel && labelKey) {
        shownRoadLabels.add(labelKey);
        roadLabelCount += 1;
        orderedLayer.bindTooltip?.(road.label, {
          permanent: true,
          direction: "center",
          className: "road-name-label",
          opacity: 0.82
        });
      } else {
        orderedLayer.bindTooltip?.(road.label, {
          sticky: true,
          direction: "top",
          className: "road-hover-label"
        });
      }
      orderedLayer.addTo(this.map);
      this.roadNetworkLayers.push(layer);
    }
  }

  private renderVectorBasemap(): void {
    this.clearVectorBasemapLayers();
  }

  setLayerVisibility(visibility: { routes?: boolean; supportPoints?: boolean; roadNetwork?: boolean }): void {
    if (typeof visibility.routes === "boolean") {
      this.routesVisible = visibility.routes;
      this.highlightRoute(this.activeRouteId, this.comparedRouteIds);
    }
    if (typeof visibility.supportPoints === "boolean") {
      this.supportPointsVisible = visibility.supportPoints;
      this.renderPoiLabels();
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

  onMapClick(callback: ((coordinate: Coordinate) => void) | null): void {
    if (this.destroyed) return;
    this.onMapClickCb = callback;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.map) {
      const mapWithRemove = this.map as { remove?: () => void };
      if (mapWithRemove.remove) mapWithRemove.remove();
      this.map = null;
    }
    this.routeLayers.clear();
    this.clearRouteDirectionLayers();
    this.clearRouteEndpointLayers();
    this.clearSupportPointLayers();
    this.clearPoiLabelLayers();
    this.clearVectorBasemapLayers();
    this.clearRoadNetworkLayers();
    this.clearPlanningPointLayers();
    this.clearSupportPlanningPointLayers();
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
    this.clearRouteDirectionLayers();
    this.clearRouteEndpointLayers();
  }

  private replaceRouteDirectionLayers(route: MarathonRoute, isActive: boolean, isCompared: boolean): void {
    const existing = this.routeDirectionLayers.get(route.id) ?? [];
    for (const layer of existing) {
      if (this.map) {
        const mapWithRemove = this.map as { removeLayer?: (l: unknown) => void };
        mapWithRemove.removeLayer?.(layer);
      }
    }
    this.routeDirectionLayers.set(route.id, this.createRouteDirectionLayers(route, isActive, isCompared));
  }

  private createRouteDirectionLayers(route: MarathonRoute, isActive: boolean, isCompared: boolean): unknown[] {
    if (this.destroyed || !this.map || !this.routesVisible) return [];
    if (!isActive && !isCompared) return [];

    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) return [];

    const divIcon = L.divIcon as ((opts: Record<string, unknown>) => unknown) | undefined;
    const marker = L.marker as ((latlng: [number, number], opts?: Record<string, unknown>) => unknown) | undefined;
    if (!divIcon || !marker) return [];

    const markerCount = isActive ? 16 : 8;
    return buildRouteDirectionMarkers(route, markerCount).map((direction) => {
      const icon = divIcon({
        className: "route-direction-icon",
        html: `<span style="border-left-color:${route.color}; opacity:${isActive ? 1 : 0.45}; transform: rotate(${direction.angleDeg}deg)"></span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      const layer = marker([direction.coordinate[1], direction.coordinate[0]], {
        icon,
        pane: "route-overlay-pane",
        interactive: false,
        keyboard: false
      });
      (layer as { addTo?: (m: unknown) => unknown }).addTo?.(this.map);
      return layer;
    });
  }

  private clearRouteDirectionLayers(): void {
    for (const layers of this.routeDirectionLayers.values()) {
      for (const layer of layers) {
        if (this.map) {
          const mapWithRemove = this.map as { removeLayer?: (l: unknown) => void };
          mapWithRemove.removeLayer?.(layer);
        }
      }
    }
    this.routeDirectionLayers.clear();
  }

  private renderRouteEndpointMarkers(): void {
    if (this.destroyed || !this.map) return;
    this.clearRouteEndpointLayers();
    if (!this.routesVisible) return;

    const route = this.routes.find((item) => item.id === this.activeRouteId) ?? this.routes[0];
    if (!route) return;

    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) return;
    const divIcon = L.divIcon as ((opts: Record<string, unknown>) => unknown) | undefined;
    const marker = L.marker as ((latlng: [number, number], opts?: Record<string, unknown>) => unknown) | undefined;
    if (!divIcon || !marker) return;

    for (const endpoint of buildRouteEndpointMarkers(route)) {
      const icon = divIcon({
        className: `route-endpoint-marker ${endpoint.role}`,
        html: `<span>${endpoint.role === "start" ? "\u8d77" : "\u7ec8"}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      const layer = marker([endpoint.coordinate[1], endpoint.coordinate[0]], {
        icon,
        pane: "planning-point-pane",
        keyboard: false
      });
      const leafletMarker = layer as {
        addTo?: (m: unknown) => unknown;
        bindTooltip?: (label: string, opts?: Record<string, unknown>) => unknown;
        bindPopup?: (label: string, opts?: Record<string, unknown>) => unknown;
      };
      const coordinateText = `${endpoint.coordinate[0].toFixed(5)}, ${endpoint.coordinate[1].toFixed(5)}`;
      leafletMarker.bindTooltip?.(`${endpoint.label} ${coordinateText}`, {
        direction: "top",
        permanent: true,
        className: "route-endpoint-label",
        opacity: 0.95
      });
      leafletMarker.bindPopup?.(`<strong>${endpoint.label}</strong><br>\u5750\u6807：${coordinateText}`, { maxWidth: 220 });
      leafletMarker.addTo?.(this.map);
      this.routeEndpointLayers.push(layer);
    }
  }

  private clearRouteEndpointLayers(): void {
    for (const layer of this.routeEndpointLayers) {
      if (this.map) {
        const mapWithRemove = this.map as { removeLayer?: (l: unknown) => void };
        mapWithRemove.removeLayer?.(layer);
      }
    }
    this.routeEndpointLayers = [];
  }

  setWaypointMarkers(waypoints: Array<{ routeId: string; color: string; label: string; coordinate: Coordinate }>): void {
    if (this.destroyed || !this.map) return;
    this.clearWaypointMarkers();

    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) return;
    const divIcon = L.divIcon as ((opts: Record<string, unknown>) => unknown) | undefined;
    const marker = L.marker as ((latlng: [number, number], opts?: Record<string, unknown>) => unknown) | undefined;
    if (!divIcon || !marker) return;

    for (const wp of waypoints) {
      const icon = divIcon({
        className: `waypoint-marker`,
        html: `<span style="background:${wp.color}; box-shadow: 0 0 0 2px ${wp.color}33"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      const layer = marker([wp.coordinate[1], wp.coordinate[0]], {
        icon,
        pane: "planning-point-pane",
        interactive: true,
        keyboard: false
      });
      const m = layer as { addTo?: (m: unknown) => unknown; bindTooltip?: (t: string, o?: Record<string, unknown>) => unknown };
      m.bindTooltip?.(wp.label, { direction: "right", permanent: false, className: "waypoint-label" });
      m.addTo?.(this.map);
      this.waypointMarkerLayers.push(layer);
    }
  }

  private clearWaypointMarkers(): void {
    for (const layer of this.waypointMarkerLayers) {
      if (this.map) {
        (this.map as { removeLayer?: (l: unknown) => void }).removeLayer?.(layer);
      }
    }
    this.waypointMarkerLayers = [];
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
      const layer = circleMarker(toLeafletLatLng(point), {
        ...computeSupportPointStyle(point, isHighlighted),
        pane: "support-point-pane"
      });
      const marker = layer as {
        addTo?: (m: unknown) => unknown;
        bindTooltip?: (label: string, opts?: Record<string, unknown>) => unknown;
        bindPopup?: (label: string, opts?: Record<string, unknown>) => unknown;
        on?: (event: string, cb: () => void) => void;
      };
      marker.bindTooltip?.(formatSupportPointLabel(point), {
        direction: "top",
        permanent: true,
        className: "support-point-label",
        opacity: isHighlighted ? 0.98 : 0.84
      });
      marker.bindPopup?.(formatSupportPointPopup(point), { maxWidth: 260 });
      marker.on?.("click", () => this.onRouteClickCb?.(point.routeId));
      marker.addTo?.(this.map);
      this.supportPointLayers.push(layer);
    }
  }

  private renderPoiLabels(): void {
    if (this.destroyed || !this.map) return;
    this.clearPoiLabelLayers();
    if (!this.supportPointsVisible) return;

    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) return;

    const divIcon = L.divIcon as ((opts: Record<string, unknown>) => unknown) | undefined;
    const marker = L.marker as ((latlng: [number, number], opts?: Record<string, unknown>) => unknown) | undefined;
    if (!divIcon || !marker) return;

    const currentZoom = this.getCurrentZoom();
    const visiblePois = sortPoiLabelsForDisplay(
      this.poiLabels.filter((label) => shouldShowPoiLabelAtZoom(label, currentZoom))
    ).slice(0, visiblePoiLimitForZoom(currentZoom));

    for (const poi of visiblePois) {
      const displayMode = poiLabelDisplayMode(poi, currentZoom);
      if (displayMode === "hidden") continue;
      const icon = divIcon({
        className: `map-poi-marker ${poi.kind} ${displayMode}`,
        html: formatPoiLabel(poi, displayMode),
        iconSize: displayMode === "icon" ? [28, 28] : [170, 32],
        iconAnchor: displayMode === "icon" ? [14, 14] : [14, 16]
      });
      const layer = marker(toPoiLeafletLatLng(poi), {
        icon,
        pane: "support-point-pane",
        keyboard: false,
        riseOnHover: true
      });
      const poiMarker = layer as {
        addTo?: (m: unknown) => unknown;
        bindPopup?: (label: string, opts?: Record<string, unknown>) => unknown;
      };
      poiMarker.bindPopup?.(formatPoiPopup(poi), { maxWidth: 240 });
      poiMarker.addTo?.(this.map);
      this.poiLabelLayers.push(layer);
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

  private clearPoiLabelLayers(): void {
    for (const layer of this.poiLabelLayers) {
      if (this.map) {
        const mapWithRemove = this.map as { removeLayer?: (l: unknown) => void };
        mapWithRemove.removeLayer?.(layer);
      }
    }
    this.poiLabelLayers = [];
  }

  private clearVectorBasemapLayers(): void {
    for (const layer of this.vectorBasemapLayers) {
      if (this.map) {
        const mapWithRemove = this.map as { removeLayer?: (l: unknown) => void };
        mapWithRemove.removeLayer?.(layer);
      }
    }
    this.vectorBasemapLayers = [];
  }

  private renderPlanningPoints(): void {
    if (this.destroyed || !this.map) return;
    this.clearPlanningPointLayers();

    const L = (window as unknown as Record<string, unknown>).L as Record<string, unknown> | undefined;
    if (!L) return;

    const marker = L.marker as ((latlng: [number, number], opts?: Record<string, unknown>) => unknown) | undefined;
    const divIcon = L.divIcon as ((opts: Record<string, unknown>) => unknown) | undefined;
    if (!marker || !divIcon) return;

    const points: Array<{ role: "start" | "end"; label: string; coordinate: Coordinate | null }> = [
      { role: "start", label: "起点", coordinate: this.planningStartPoint },
      { role: "end", label: "终点", coordinate: this.planningEndPoint }
    ];

    for (const point of points) {
      if (!point.coordinate) continue;
      const icon = divIcon({
        className: `planning-point-marker ${point.role}`,
        html: `<span>${point.role === "start" ? "\u8d77" : "\u7ec8"}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      const layer = marker([point.coordinate[1], point.coordinate[0]], {
        icon,
        pane: "planning-point-pane",
        keyboard: false
      });
      const leafletMarker = layer as {
        addTo?: (m: unknown) => unknown;
        bindTooltip?: (label: string, opts?: Record<string, unknown>) => unknown;
      };
      leafletMarker.bindTooltip?.(`${point.label} ${point.coordinate[0].toFixed(5)}, ${point.coordinate[1].toFixed(5)}`, {
        direction: "top"
      });
      leafletMarker.addTo?.(this.map);
      this.planningPointLayers.push(layer);
    }
  }

  private clearPlanningPointLayers(): void {
    for (const layer of this.planningPointLayers) {
      if (this.map) {
        const mapWithRemove = this.map as { removeLayer?: (l: unknown) => void };
        mapWithRemove.removeLayer?.(layer);
      }
    }
    this.planningPointLayers = [];
  }

  private clearSupportPlanningPointLayers(): void {
    for (const layer of this.supportPlanningPointLayers) {
      if (this.map) {
        (this.map as { removeLayer?: (l: unknown) => void }).removeLayer?.(layer);
      }
    }
    this.supportPlanningPointLayers = [];
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
    return { ...style, pane: "route-overlay-pane" };
  }

  private findNearestRoute(coord: [number, number]): string | null {
    return findNearestRouteId(this.routes, coord);
  }

  private getCurrentZoom(): number {
    const mapWithZoom = this.map as { getZoom?: () => number };
    return mapWithZoom.getZoom?.() ?? this.zoom;
  }

  private createMapPane(name: string, zIndex: number, pointerEvents: "auto" | "none"): void {
    const mapWithPanes = this.map as {
      createPane?: (paneName: string) => HTMLElement;
      getPane?: (paneName: string) => HTMLElement | undefined;
    };
    const pane = mapWithPanes.getPane?.(name) ?? mapWithPanes.createPane?.(name);
    if (!pane) return;
    pane.style.zIndex = String(zIndex);
    pane.style.pointerEvents = pointerEvents;
  }
}

function supportPlanningClass(type: SupportPlanningMapPointType): string {
  const classes: Record<SupportPlanningMapPointType, string> = {
    补给: "supply",
    医疗: "medical",
    厕所: "restroom",
    引导: "guide"
  };
  return classes[type];
}

function supportPlanningShortLabel(type: SupportPlanningMapPointType): string {
  const labels: Record<SupportPlanningMapPointType, string> = {
    补给: "补",
    医疗: "医",
    厕所: "厕",
    引导: "导"
  };
  return labels[type];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
