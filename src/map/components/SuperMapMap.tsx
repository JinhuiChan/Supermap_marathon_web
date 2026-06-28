import { useEffect, useRef, useState } from "react";
import type { BasemapMode } from "../../config/supermap";
import { superMapConfig } from "../../config/supermap";
import type { SupportPoint } from "../../data/supportPoints";
import type { MarathonRoute } from "../../domain/routeMetrics";
import { RouteMap } from "../../components/RouteMap";
import { loadScript, loadStylesheet } from "../core/loadScript";
import { MapEngine } from "../core/MapEngine";
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
}

type MapPhase = "loading" | "initializing" | "ready" | "fallback";

export function SuperMapMap(props: SuperMapMapProps) {
  const { routes, supportPoints, activeRouteId, comparedRouteIds, layerVisibility, basemapMode, onSelectRoute } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const viewportTimersRef = useRef<number[]>([]);
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
        engine.setRoutes(routes);
        engine.setSupportPoints(supportPoints);
        engine.highlightRoute(activeRouteId, comparedRouteIds);
        engine.setLayerVisibility(layerVisibility);
        engineRef.current = engine;

        if (!cancelled) {
          setPhase("ready");
          engine.whenReady(() => scheduleViewportRefresh(engine, routes));
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
    engine.setRoutes(routes);
    scheduleViewportRefresh(engine, routes);
  }, [routes, phase]);

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

  if (phase === "fallback") {
    return (
      <div className="map-panel" style={{ position: "relative" }}>
        <div className="map-fallback-notice">{phaseMessage}</div>
        <RouteMap
          routes={routes}
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
      {phase !== "ready" && <LoadingSpinner message={phaseMessage} />}
      <div ref={containerRef} className="iclient-map-container" />
    </section>
  );
}
