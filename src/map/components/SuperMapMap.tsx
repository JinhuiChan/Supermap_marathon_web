import { useCallback, useEffect, useRef, useState } from "react";
import type { MarathonRoute } from "../../domain/routeMetrics";
import { superMapConfig } from "../../config/supermap";
import { discoveriClientBundle, getCDNFallback, type iClientBundle } from "../core/iClientDiscovery";
import { loadScript, loadStylesheet, type LoadState } from "../core/loadScript";
import { MapEngine } from "../core/MapEngine";
import { LoadingSpinner } from "./LoadingSpinner";
import { RouteMap } from "../../components/RouteMap";

interface SuperMapMapProps {
  routes: MarathonRoute[];
  activeRouteId: string;
  comparedRouteIds: string[];
  onSelectRoute: (id: string) => void;
}

type MapPhase = "discovering" | "loading" | "initializing" | "ready" | "fallback";

export function SuperMapMap(props: SuperMapMapProps) {
  const { routes, activeRouteId, comparedRouteIds, onSelectRoute } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const [phase, setPhase] = useState<MapPhase>("discovering");
  const [phaseMessage, setPhaseMessage] = useState("检测 SuperMap iClient...");

  const onSelectRef = useRef(onSelectRoute);
  onSelectRef.current = onSelectRoute;

  // Initialize map
  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    const initMap = async () => {
      // Phase 1: Discover iClient bundle
      setPhase("discovering");
      setPhaseMessage("检测 SuperMap iClient 库...");

      let bundle: iClientBundle | null = await discoveriClientBundle(superMapConfig.iServerBaseUrl);

      if (!bundle) {
        bundle = getCDNFallback();
        setPhaseMessage("iServer 库未找到，使用 Leaflet CDN...");
      }

      if (cancelled) return;

      // Phase 2: Load script
      setPhase("loading");
      setPhaseMessage(`加载 ${bundle.variant} 地图库...`);

      try {
        await loadScript(bundle.scriptUrl);
        if (bundle.cssUrl) {
          await loadStylesheet(bundle.cssUrl).catch(() => {
            // CSS is optional — map works without it
          });
        }
      } catch {
        if (!cancelled) {
          setPhase("fallback");
          setPhaseMessage("地图库加载失败，使用示意图");
        }
        return;
      }

      if (cancelled) return;

      // Phase 3: Initialize engine
      setPhase("initializing");
      setPhaseMessage("初始化地图引擎...");

      try {
        const engine = new MapEngine({
          container,
          bundle,
          baseLayerUrl: superMapConfig.fallbackMapService,
          center: superMapConfig.mapCenter,
          zoom: superMapConfig.mapZoom
        });
        engine.initialize();
        engine.onRouteClick((id) => onSelectRef.current(id));
        engine.setRoutes(routes);
        engine.highlightRoute(activeRouteId, comparedRouteIds);
        engineRef.current = engine;

        if (!cancelled) setPhase("ready");
      } catch {
        if (!cancelled) {
          setPhase("fallback");
          setPhaseMessage("地图引擎初始化失败，使用示意图");
        }
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update routes when they change
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || phase !== "ready") return;
    engine.setRoutes(routes);
    engine.highlightRoute(activeRouteId, comparedRouteIds);
  }, [routes, activeRouteId, comparedRouteIds, phase]);

  // Fallback to SVG
  if (phase === "fallback") {
    return (
      <div className="map-panel" style={{ position: "relative" }}>
        <div className="map-fallback-notice">
          {phaseMessage}
        </div>
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
    <section className="map-panel" aria-label="武汉马拉松赛道地图 — SuperMap iClient">
      <div className="map-toolbar">
        <span>武汉 WebGIS 赛道工作台 · SuperMap iClient {phase === "ready" ? "Leaflet" : ""}</span>
        <strong>{comparedRouteIds.length}/5 已加入对比</strong>
      </div>
      {phase !== "ready" && <LoadingSpinner message={phaseMessage} />}
      <div
        ref={containerRef}
        className="iclient-map-container"
        style={{ display: phase === "ready" ? "block" : "none" }}
      />
    </section>
  );
}
