import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { activeCityPackage, type CityPackage } from "../../config/cityPackages";
import type { WaypointRoutePlan } from "../../data/profileRoutePlanner";
import { countComparedCandidateRoutes } from "../../domain/routeComparisonStatus";
import type { Coordinate, MarathonRoute } from "../../domain/routeMetrics";
import { fetchIserverPoiLabels } from "../../services/iserverPoi";
import { RouteMap } from "../../components/RouteMap";
import { loadScript, loadStylesheet } from "../core/loadScript";
import { MapEngine } from "../core/MapEngine";
import {
  extractPoiLabelsFromGeoJson,
  type MapPoiLabel,
  type PoiLabelKind
} from "../layers/PoiLabelLayer";
import { extractRoadNetworkFeatures, type RoadNetworkFeature } from "../layers/RoadNetworkLayer";
import {
  extractVectorBasemapFeatures,
  type VectorBasemapFeature,
  type VectorBasemapKind
} from "../layers/VectorBasemapLayer";
import { LoadingSpinner } from "./LoadingSpinner";

interface SuperMapMapProps {
  cityPackage?: CityPackage;
  routePlans?: WaypointRoutePlan[];
  routes: MarathonRoute[];
  activeRouteId: string;
  comparedRouteIds: string[];
  layerVisibility: MapLayerVisibility;
  isGenerating?: boolean;
  generationProgress?: number | null;
  generationStatus?: string;
  onSelectRoute: (id: string) => void;
}

export interface MapLayerVisibility {
  routes: boolean;
  roadNetwork: boolean;
}

type MapPhase = "loading" | "initializing" | "ready" | "fallback";
type DragPosition = { x: number; y: number };
type DragBounds = { width: number; height: number };

export function getVisibleMapRoutes(
  routes: MarathonRoute[],
  activeRouteId: string,
  comparedRouteIds: string[],
  routesVisible = true
) {
  if (!routesVisible) return [];
  const visibleIds = new Set([activeRouteId, ...comparedRouteIds].filter(Boolean));
  return routes.filter((route) => visibleIds.has(route.id));
}

export function clampDraggedProgressPosition(position: DragPosition, panel: DragBounds, floating: DragBounds): DragPosition {
  return {
    x: Math.max(0, Math.min(position.x, Math.max(0, panel.width - floating.width))),
    y: Math.max(0, Math.min(position.y, Math.max(0, panel.height - floating.height)))
  };
}

export function SuperMapMap(props: SuperMapMapProps) {
  const {
    routes,
    activeRouteId,
    comparedRouteIds,
    layerVisibility,
    isGenerating = false,
    generationProgress = null,
    generationStatus = "",
    onSelectRoute
  } = props;
  const cityPackage = props.cityPackage ?? activeCityPackage;
  const routePlans = props.routePlans ?? cityPackage.routePlans;
  const superMapConfig = cityPackage.superMap;
  const visibleRoutes = useMemo(
    () => getVisibleMapRoutes(routes, activeRouteId, comparedRouteIds, layerVisibility.routes),
    [routes, activeRouteId, comparedRouteIds, layerVisibility.routes]
  );
  const comparedCandidateRouteCount = countComparedCandidateRoutes(routes, comparedRouteIds);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const viewportTimersRef = useRef<number[]>([]);
  const [roadNetworkFeatures, setRoadNetworkFeatures] = useState<RoadNetworkFeature[]>([]);
  const [poiLabels, setPoiLabels] = useState<MapPoiLabel[]>([]);
  const [vectorBasemapFeatures, setVectorBasemapFeatures] = useState<VectorBasemapFeature[]>([]);
  const [roadNetworkStatus, setRoadNetworkStatus] = useState(`${cityPackage.name}道路走廊：加载中`);
  const [phase, setPhase] = useState<MapPhase>("loading");
  const [phaseMessage, setPhaseMessage] = useState("加载 Leaflet 地图库...");

  const onSelectRef = useRef(onSelectRoute);
  onSelectRef.current = onSelectRoute;

  const clearViewportTimers = () => {
    for (const timer of viewportTimersRef.current) {
      window.clearTimeout(timer);
    }
    viewportTimersRef.current = [];
  };

  const refreshViewport = (engine: MapEngine, routeSet: MarathonRoute[]) => {
    const coordinates = routeSet.flatMap((route) => route.coordinates);
    engine.invalidateSize();
    engine.fitBounds(coordinates);
  };

  const scheduleViewportRefresh = (engine: MapEngine, routeSet: MarathonRoute[]) => {
    clearViewportTimers();

    const run = () => refreshViewport(engine, routeSet);
    window.requestAnimationFrame(run);
    viewportTimersRef.current = [
      window.setTimeout(run, 80),
      window.setTimeout(run, 300),
      window.setTimeout(run, 800)
    ];
  };

  useEffect(() => {
    let cancelled = false;

    fetch(superMapConfig.displayRoadNetworkGeoJsonUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geojson) => {
        if (cancelled) return;
        const roads = extractRoadNetworkFeatures(geojson);
        setRoadNetworkFeatures(roads);
        setRoadNetworkStatus(`${cityPackage.name}道路走廊：已加载 ${roads.length} 条`);
        engineRef.current?.setRoadNetwork(roads);
      })
      .catch(() => {
        if (!cancelled) setRoadNetworkStatus(`${cityPackage.name}道路走廊：未找到本地数据`);
      });

    return () => {
      cancelled = true;
    };
  }, [superMapConfig.displayRoadNetworkGeoJsonUrl]);

  useEffect(() => {
    let cancelled = false;
    const loadFallbackPoiLabels = () => {
      const sources: Array<{ url: string; kind: PoiLabelKind; maxLabels: number }> = [
      { url: superMapConfig.constraintLayerUrls.sensitiveHospital, kind: "hospital", maxLabels: 120 },
      { url: superMapConfig.constraintLayerUrls.trafficStation, kind: "traffic", maxLabels: 160 },
      { url: superMapConfig.constraintLayerUrls.parks, kind: "park", maxLabels: 220 },
      { url: superMapConfig.constraintLayerUrls.commercialPotential, kind: "commercial", maxLabels: 220 }
      ];

      return Promise.all(
        sources.map((source) =>
          fetch(source.url)
            .then((response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.json();
            })
            .then((geojson) => extractPoiLabelsFromGeoJson(geojson, source.kind, source.maxLabels))
            .catch(() => [])
        )
      ).then((layers) => layers.flat());
    };

    setPoiLabels(cityPackage.landmarks);

    loadFallbackPoiLabels().then((labels) => {
      if (cancelled || labels.length === 0) return;
      const nextLabels = [...cityPackage.landmarks, ...labels];
      setPoiLabels(nextLabels);
      engineRef.current?.setPoiLabels(nextLabels);
    });

    fetchIserverPoiLabels(superMapConfig.serviceUrls.poiDataRest)
      .catch(() => [])
      .then((labels) => {
      if (cancelled) return;
      if (labels.length === 0) return;
      const nextLabels = [...cityPackage.landmarks, ...labels];
      setPoiLabels(nextLabels);
      engineRef.current?.setPoiLabels(nextLabels);
    });

    return () => {
      cancelled = true;
    };
  }, [cityPackage.landmarks, superMapConfig.constraintLayerUrls, superMapConfig.serviceUrls.poiDataRest]);

  useEffect(() => {
    let cancelled = false;
    const sources: Array<{ url: string; kind: VectorBasemapKind; maxFeatures?: number }> = [
      { url: superMapConfig.constraintLayerUrls.waterArea, kind: "waterArea", maxFeatures: 2400 },
      { url: superMapConfig.constraintLayerUrls.waterLine, kind: "waterLine", maxFeatures: 1800 },
      { url: superMapConfig.constraintLayerUrls.parks, kind: "park", maxFeatures: 2400 },
      { url: superMapConfig.constraintLayerUrls.commercialPotential, kind: "commercial", maxFeatures: 1200 },
      { url: superMapConfig.constraintLayerUrls.trafficStation, kind: "trafficStation", maxFeatures: 1200 }
    ];

    Promise.all(
      sources.map((source) =>
        fetch(source.url)
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
          })
          .then((geojson) => extractVectorBasemapFeatures(geojson, source.kind, source.maxFeatures))
          .catch(() => [])
      )
    ).then((layers) => {
      if (cancelled) return;
      const features = layers.flat();
      setVectorBasemapFeatures(features);
      engineRef.current?.setVectorBasemapFeatures(features);
    });

    return () => {
      cancelled = true;
    };
  }, [superMapConfig.constraintLayerUrls]);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    const initMap = async () => {
      setPhase("loading");
      setPhaseMessage("加载 Leaflet 地图库...");

      try {
        await loadScript(superMapConfig.leafletJsUrl);
        if (superMapConfig.leafletCssUrl) {
          await loadStylesheet(superMapConfig.leafletCssUrl).catch(() => {});
        }
      } catch {
        if (!cancelled) {
          setPhase("fallback");
          setPhaseMessage("Leaflet 加载失败，使用示意图");
        }
        return;
      }

      if (cancelled) return;

      setPhase("initializing");
      setPhaseMessage("初始化 iDesktop 发布图...");

      try {
        const engine = new MapEngine({
          container,
          wmsUrl: superMapConfig.wmsMapUrl,
          wmsLayerName: superMapConfig.wmsLayerName,
          defaultBasemap: superMapConfig.defaultBasemap,
          center: cityPackage.mapCenter,
          zoom: cityPackage.mapZoom
        });
        engine.initialize();
        engine.onRouteClick((id) => onSelectRef.current(id));
        engine.setRoutes(visibleRoutes);
        engine.setWaypointMarkers(buildWaypointMarkers(visibleRoutes, routePlans));
        engine.setPoiLabels(poiLabels);
        engine.setVectorBasemapFeatures(vectorBasemapFeatures);
        engine.setRoadNetwork(roadNetworkFeatures);
        engine.highlightRoute(activeRouteId, comparedRouteIds);
        engine.setLayerVisibility(layerVisibility);
        engineRef.current = engine;

        if (!cancelled) {
          setPhase("ready");
          engine.whenReady(() => scheduleViewportRefresh(engine, visibleRoutes));
        }
      } catch {
        if (!cancelled) {
          setPhase("fallback");
          setPhaseMessage("地图初始化失败，使用示意图");
        }
      }
    };

    initMap();

    return () => {
      cancelled = true;
      clearViewportTimers();
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase !== "ready") return;
    engine.setRoutes(visibleRoutes);
    engine.setWaypointMarkers(buildWaypointMarkers(visibleRoutes, routePlans));
    scheduleViewportRefresh(engine, visibleRoutes);
  }, [visibleRoutes, routePlans, phase]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase !== "ready") return;
    engine.setPoiLabels(poiLabels);
  }, [poiLabels, phase]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase !== "ready") return;
    engine.highlightRoute(activeRouteId, comparedRouteIds);
  }, [activeRouteId, comparedRouteIds, phase]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase !== "ready") return;
    engine.setLayerVisibility(layerVisibility);
  }, [layerVisibility, phase]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase !== "ready") return;
    engine.setRoadNetwork(roadNetworkFeatures);
  }, [roadNetworkFeatures, phase]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase !== "ready") return;
    engine.setVectorBasemapFeatures(vectorBasemapFeatures);
  }, [vectorBasemapFeatures, phase]);

  if (phase === "fallback") {
    return (
      <div className="map-panel" style={{ position: "relative" }}>
        <div className="map-fallback-notice">{phaseMessage}</div>
        <RouteMap
          cityPackage={cityPackage}
          routePlans={routePlans}
          routes={visibleRoutes}
          activeRouteId={activeRouteId}
          comparedRouteIds={comparedRouteIds}
          onSelectRoute={onSelectRoute}
        />
        <MapGenerationProgress isGenerating={isGenerating} progress={generationProgress} status={generationStatus} />
      </div>
    );
  }

  return (
    <section className="map-panel" aria-label={`${cityPackage.displayName}赛道地图`}>
      <div className="map-toolbar">
        <span>
          {cityPackage.name} WebGIS 赛道工作台 · iDesktop 发布图 + 路线/POI 矢量图层
        </span>
        <strong>{comparedCandidateRouteCount}/{routes.length} 已加入对比</strong>
      </div>
      <MapGenerationProgress isGenerating={isGenerating} progress={generationProgress} status={generationStatus} />
      <div className="road-network-status">{roadNetworkStatus}</div>
      {phase !== "ready" && <LoadingSpinner message={phaseMessage} />}
      <div ref={containerRef} className="iclient-map-container" />
    </section>
  );
}

function MapGenerationProgress({
  isGenerating,
  progress,
  status
}: {
  isGenerating: boolean;
  progress: number | null;
  status: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragPosition, setDragPosition] = useState<DragPosition | null>(null);

  if (!isGenerating) return null;

  const progressValue = Math.max(0, Math.min(100, Math.round(progress ?? 12)));
  const dragStyle = dragPosition
    ? { left: `${dragPosition.x}px`, top: `${dragPosition.y}px`, transform: "none" }
    : undefined;

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const floating = panelRef.current;
    const mapPanel = floating?.closest(".map-panel") as HTMLElement | null;
    if (!floating || !mapPanel) return;

    event.preventDefault();
    floating.setPointerCapture?.(event.pointerId);

    const floatingRect = floating.getBoundingClientRect();
    const mapRect = mapPanel.getBoundingClientRect();
    const offsetX = event.clientX - floatingRect.left;
    const offsetY = event.clientY - floatingRect.top;

    const move = (moveEvent: PointerEvent) => {
      setDragPosition(
        clampDraggedProgressPosition(
          {
            x: moveEvent.clientX - mapRect.left - offsetX,
            y: moveEvent.clientY - mapRect.top - offsetY
          },
          { width: mapRect.width, height: mapRect.height },
          { width: floatingRect.width, height: floatingRect.height }
        )
      );
    };

    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };

    move(event.nativeEvent);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  };

  return (
    <div
      ref={panelRef}
      className="map-generation-progress"
      aria-label="Route generation progress"
      style={dragStyle}
      onPointerDown={beginDrag}
    >
      <div className="map-generation-progress-title">
        <span>拖动生成进度</span>
        <small>{status || "正在搜索合规路线"}</small>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressValue}
        aria-valuetext={`Full OSM route generation ${progressValue}%`}
      >
        <i style={{ width: `${progressValue}%` }} />
      </div>
      <strong>{progressValue}%</strong>
    </div>
  );
}

function buildWaypointMarkers(
  routes: MarathonRoute[],
  routePlans: WaypointRoutePlan[] = activeCityPackage.routePlans
): Array<{ routeId: string; color: string; label: string; coordinate: Coordinate }> {
  const markers: Array<{ routeId: string; color: string; label: string; coordinate: Coordinate }> = [];
  const routeIds = new Set(routes.map((r) => r.id));
  for (const plan of routePlans) {
    if (!routeIds.has(plan.id)) continue;
    for (const wp of plan.waypoints) {
      markers.push({
        routeId: plan.id,
        color: plan.color,
        label: wp.label,
        coordinate: wp.coordinate
      });
    }
  }
  return markers;
}

