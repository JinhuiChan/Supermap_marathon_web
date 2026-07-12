import { useEffect, useMemo, useRef, useState } from "react";
import { superMapConfig } from "../../config/supermap";
import { wuhanLandmarkPoiLabels } from "../../data/wuhanLandmarks";
import type { MarathonRoute } from "../../domain/routeMetrics";
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
  routes: MarathonRoute[];
  activeRouteId: string;
  comparedRouteIds: string[];
  layerVisibility: MapLayerVisibility;
  onSelectRoute: (id: string) => void;
}

export interface MapLayerVisibility {
  routes: boolean;
  roadNetwork: boolean;
}

type MapPhase = "loading" | "initializing" | "ready" | "fallback";

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

export function SuperMapMap(props: SuperMapMapProps) {
  const {
    routes,
    activeRouteId,
    comparedRouteIds,
    layerVisibility,
    onSelectRoute
  } = props;
  const visibleRoutes = useMemo(
    () => getVisibleMapRoutes(routes, activeRouteId, comparedRouteIds, layerVisibility.routes),
    [routes, activeRouteId, comparedRouteIds, layerVisibility.routes]
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const viewportTimersRef = useRef<number[]>([]);
  const [roadNetworkFeatures, setRoadNetworkFeatures] = useState<RoadNetworkFeature[]>([]);
  const [poiLabels, setPoiLabels] = useState<MapPoiLabel[]>([]);
  const [vectorBasemapFeatures, setVectorBasemapFeatures] = useState<VectorBasemapFeature[]>([]);
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

    fetch(superMapConfig.displayRoadNetworkGeoJsonUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geojson) => {
        if (cancelled) return;
        const roads = extractRoadNetworkFeatures(geojson);
        setRoadNetworkFeatures(roads);
        setRoadNetworkStatus(`汉马道路走廊：已加载 ${roads.length} 条`);
        engineRef.current?.setRoadNetwork(roads);
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

    setPoiLabels(wuhanLandmarkPoiLabels);

    loadFallbackPoiLabels().then((labels) => {
      if (cancelled || labels.length === 0) return;
      const nextLabels = [...wuhanLandmarkPoiLabels, ...labels];
      setPoiLabels(nextLabels);
      engineRef.current?.setPoiLabels(nextLabels);
    });

    fetchIserverPoiLabels(superMapConfig.serviceUrls.poiDataRest)
      .catch(() => [])
      .then((labels) => {
      if (cancelled) return;
      if (labels.length === 0) return;
      const nextLabels = [...wuhanLandmarkPoiLabels, ...labels];
      setPoiLabels(nextLabels);
      engineRef.current?.setPoiLabels(nextLabels);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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
      setPhaseMessage("初始化 iDesktop 发布图...");

      try {
        const engine = new MapEngine({
          container,
          wmsUrl: superMapConfig.wmsMapUrl,
          wmsLayerName: superMapConfig.wmsLayerName,
          defaultBasemap: superMapConfig.defaultBasemap,
          center: superMapConfig.mapCenter,
          zoom: superMapConfig.mapZoom
        });
        engine.initialize();
        engine.onRouteClick((id) => onSelectRef.current(id));
        engine.setRoutes(visibleRoutes);
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
    scheduleViewportRefresh(engine, visibleRoutes);
  }, [visibleRoutes, phase]);

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
        <span>
          武汉 WebGIS 赛道工作台 · iDesktop 发布图 + 路线/POI 矢量图层
        </span>
        <strong>{comparedRouteIds.length}/5 已加入对比</strong>
      </div>
      <div className="road-network-status">{roadNetworkStatus}</div>
      {phase !== "ready" && <LoadingSpinner message={phaseMessage} />}
      <div ref={containerRef} className="iclient-map-container" />
    </section>
  );
}
