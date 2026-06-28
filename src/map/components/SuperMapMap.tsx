import { useEffect, useRef, useState } from "react";
import type { MarathonRoute } from "../../domain/routeMetrics";
import { superMapConfig } from "../../config/supermap";
import { loadScript, loadStylesheet } from "../core/loadScript";
import { MapEngine } from "../core/MapEngine";
import { LoadingSpinner } from "./LoadingSpinner";
import { RouteMap } from "../../components/RouteMap";

interface SuperMapMapProps {
  routes: MarathonRoute[];
  activeRouteId: string;
  comparedRouteIds: string[];
  onSelectRoute: (id: string) => void;
}

type MapPhase = "loading" | "initializing" | "ready" | "fallback";

export function SuperMapMap(props: SuperMapMapProps) {
  const { routes, activeRouteId, comparedRouteIds, onSelectRoute } = props;
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
      // Phase 1: Load Leaflet from CDN
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

      // Phase 2: Initialize map with WMS tiles from SuperMap iServer
      setPhase("initializing");
      setPhaseMessage("初始化 SuperMap WMS 地图...");

      try {
        const engine = new MapEngine({
          container,
          wmsUrl: superMapConfig.wmsMapUrl,
          wmsLayerName: superMapConfig.wmsLayerName,
          center: superMapConfig.mapCenter,
          zoom: superMapConfig.mapZoom
        });
        engine.initialize();
        engine.onRouteClick((id) => onSelectRef.current(id));
        engine.setRoutes(routes);
        engine.highlightRoute(activeRouteId, comparedRouteIds);
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
    engine.setRoutes(routes);
    scheduleViewportRefresh(engine, routes);
  }, [routes, phase]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase !== "ready") return;
    engine.highlightRoute(activeRouteId, comparedRouteIds);
  }, [activeRouteId, comparedRouteIds, phase]);

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
    <section className="map-panel" aria-label="武汉马拉松赛道地图 — SuperMap iServer WMS">
      <div className="map-toolbar">
        <span>武汉 WebGIS 赛道工作台 · SuperMap iServer WMS</span>
        <strong>{comparedRouteIds.length}/5 已加入对比</strong>
      </div>
      {phase !== "ready" && <LoadingSpinner message={phaseMessage} />}
      <div
        ref={containerRef}
        className="iclient-map-container"
      />
    </section>
  );
}
