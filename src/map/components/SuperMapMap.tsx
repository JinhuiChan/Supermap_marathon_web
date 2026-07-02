import { useEffect, useMemo, useRef, useState } from "react";
import type { BasemapMode } from "../../config/supermap";
import { superMapConfig } from "../../config/supermap";
import type { SupportPoint } from "../../data/supportPoints";
import type { MarathonRoute } from "../../domain/routeMetrics";
import { RouteMap } from "../../components/RouteMap";
import { loadScript, loadStylesheet } from "../core/loadScript";
import { MapEngine } from "../core/MapEngine";
import { extractRoadNetworkLines } from "../layers/RoadNetworkLayer";
import { LoadingSpinner } from "./LoadingSpinner";

interface SuperMapMapProps {
  routes: MarathonRoute[];
  supportPoints: SupportPoint[];
  activeRouteId: string;
  comparedRouteIds: string[];
  layerVisibility: MapLayerVisibility;
  basemapMode: BasemapMode;
  onSelectRoute: (id: string) => void;
}

export interface MapLayerVisibility {
  routes: boolean;
  supportPoints: boolean;
  roadNetwork: boolean;
}

type MapPhase = "loading" | "initializing" | "ready" | "fallback";

export function getVisibleMapRoutes(
  routes: MarathonRoute[],
  comparedRouteIds: string[],
  routesVisible = true
) {
  if (!routesVisible) return [];
  const visibleIds = new Set(comparedRouteIds);
  return routes.filter((route) => visibleIds.has(route.id));
}

export function SuperMapMap(props: SuperMapMapProps) {
  const { routes, supportPoints, activeRouteId, comparedRouteIds, layerVisibility, basemapMode, onSelectRoute } = props;
  const visibleRoutes = useMemo(
    () => getVisibleMapRoutes(routes, comparedRouteIds, layerVisibility.routes),
    [routes, comparedRouteIds, layerVisibility.routes]
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const viewportTimersRef = useRef<number[]>([]);
  const [roadNetworkLines, setRoadNetworkLines] = useState<[number, number][][]>([]);
  const [roadNetworkStatus, setRoadNetworkStatus] = useState("汉马道路走廊：加载中");
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

    fetch("data/local-wuhan-marathon-corridor-roads.geojson")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geojson) => {
        if (cancelled) return;
        const lines = extractRoadNetworkLines(geojson);
        setRoadNetworkLines(lines);
        setRoadNetworkStatus(`汉马道路走廊：已加载 ${lines.length} 条`);
        engineRef.current?.setRoadNetwork(lines);
      })
      .catch(() => {
        if (!cancelled) setRoadNetworkStatus("汉马道路走廊：未找到本地数据");
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
      setPhaseMessage("初始化在线地图与 SuperMap DEM...");

      try {
        const engine = new MapEngine({
          container,
          wmsUrl: superMapConfig.wmsMapUrl,
          wmsLayerName: superMapConfig.wmsLayerName,
          onlineTileUrl: superMapConfig.onlineBasemap.tileUrl,
          onlineAttribution: superMapConfig.onlineBasemap.attribution,
          defaultBasemap: basemapMode,
          center: superMapConfig.mapCenter,
          zoom: superMapConfig.mapZoom
        });
        engine.initialize();
        engine.onRouteClick((id) => onSelectRef.current(id));
        engine.setRoutes(visibleRoutes);
        engine.setSupportPoints(supportPoints);
        engine.setRoadNetwork(roadNetworkLines);
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
    engine.setBasemap(basemapMode);
  }, [basemapMode, phase]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase !== "ready") return;
    engine.setRoutes(visibleRoutes);
    scheduleViewportRefresh(engine, visibleRoutes);
  }, [visibleRoutes, phase]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase !== "ready") return;
    engine.setSupportPoints(supportPoints);
  }, [supportPoints, phase]);

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
    engine.setRoadNetwork(roadNetworkLines);
  }, [roadNetworkLines, phase]);

  if (phase === "fallback") {
    return (
      <div className="map-panel" style={{ position: "relative" }}>
        <div className="map-fallback-notice">{phaseMessage}</div>
        <RouteMap
          routes={visibleRoutes}
          activeRouteId={activeRouteId}
          comparedRouteIds={comparedRouteIds}
          onSelectRoute={onSelectRoute}
        />
      </div>
    );
  }

  return (
    <section className="map-panel" aria-label="武汉马拉松赛道地图">
      <div className="map-toolbar">
        <span>武汉 WebGIS 赛道工作台 · 在线真实地图 + SuperMap DEM</span>
        <strong>{comparedRouteIds.length}/5 已加入对比</strong>
      </div>
      <div className="road-network-status">{roadNetworkStatus}</div>
      {phase !== "ready" && <LoadingSpinner message={phaseMessage} />}
      <div ref={containerRef} className="iclient-map-container" />
    </section>
  );
}
