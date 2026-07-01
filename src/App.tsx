import { useEffect, useMemo, useState } from "react";
import { ComparisonPanel } from "./components/ComparisonPanel";
import { DataPackagePanel } from "./components/DataPackagePanel";
import { ExportPanel } from "./components/ExportPanel";
import { LayerControlPanel } from "./components/LayerControlPanel";
import { RouteAnalysisPanel } from "./components/RouteAnalysisPanel";
import { RouteDetails } from "./components/RouteDetails";
import { RouteLibrary } from "./components/RouteLibrary";
import { SuperMapStatusPanel } from "./components/SuperMapStatusPanel";
import type { BasemapMode } from "./config/supermap";
import { superMapConfig } from "./config/supermap";
import type { MapLayerVisibility } from "./map/components/SuperMapMap";
import { SuperMapMap } from "./map/components/SuperMapMap";
import { Scene3DPanel } from "./map/components/Scene3DPanel";
import { demoRoutes } from "./data/routes";
import { buildOsmMarathonCandidateRoutes } from "./data/osmMarathonRoute";
import { supportPoints } from "./data/supportPoints";
import type { MarathonRoute } from "./domain/routeMetrics";

export default function App() {
  const [osmRoutes, setOsmRoutes] = useState<MarathonRoute[]>([]);
  const [osmRoadGeoJson, setOsmRoadGeoJson] = useState<unknown>(null);
  const [generationStatus, setGenerationStatus] = useState("正在加载 OSM 道路走廊");
  const allRoutes = useMemo(() => [...demoRoutes, ...osmRoutes], [osmRoutes]);
  const [activeRouteId, setActiveRouteId] = useState(allRoutes[0].id);
  const [comparedRouteIds, setComparedRouteIds] = useState<string[]>([allRoutes[0].id]);
  const [mapLayerVisibility, setMapLayerVisibility] = useState<MapLayerVisibility>({
    routes: true,
    supportPoints: true,
    roadNetwork: true
  });
  const [basemapMode, setBasemapMode] = useState<BasemapMode>(superMapConfig.defaultBasemap);
  const activeRoute = useMemo(
    () => allRoutes.find((route) => route.id === activeRouteId) ?? allRoutes[0],
    [activeRouteId]
  );
  const comparedRoutes = useMemo(
    () => allRoutes.filter((route) => comparedRouteIds.includes(route.id)),
    [allRoutes, comparedRouteIds]
  );

  useEffect(() => {
    let cancelled = false;

    fetch("data/local-wuhan-marathon-corridor-roads.geojson")
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geojson) => {
        if (cancelled) return;
        setOsmRoadGeoJson(geojson);
        const routes = buildOsmMarathonCandidateRoutes(geojson, {
          targetDistanceKm: 42.195,
          startPoint: [114.302, 30.604]
        });
        setOsmRoutes(routes);
        setGenerationStatus(`已生成 ${routes.length} 条 OSM 候选路线`);
        if (routes.length > 0) {
          setActiveRouteId(routes[0].id);
          setComparedRouteIds([demoRoutes[0].id, ...routes.slice(0, 2).map((route) => route.id)]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOsmRoutes([]);
          setGenerationStatus("未找到本地 OSM 道路数据");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const generateOsmCandidates = () => {
    if (!osmRoadGeoJson) return;
    const routes = buildOsmMarathonCandidateRoutes(osmRoadGeoJson, {
      targetDistanceKm: 42.195,
      startPoint: [114.302, 30.604]
    });
    setOsmRoutes(routes);
    setGenerationStatus(`已生成 ${routes.length} 条 OSM 候选路线`);
    if (routes.length > 0) {
      setActiveRouteId(routes[0].id);
      setComparedRouteIds([demoRoutes[0].id, ...routes.slice(0, 2).map((route) => route.id)]);
    }
  };

  const toggleCompare = (id: string) => {
    setComparedRouteIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 5) return current;
      return [...current, id];
    });
  };

  return (
    <main className="app-shell">
      <aside className="left-panel">
        <RouteLibrary
          routes={allRoutes}
          activeRouteId={activeRouteId}
          comparedRouteIds={comparedRouteIds}
          generationStatus={generationStatus}
          canGenerate={Boolean(osmRoadGeoJson)}
          onSelectRoute={setActiveRouteId}
          onToggleCompare={toggleCompare}
          onGenerateRoutes={generateOsmCandidates}
        />
        <RouteDetails route={activeRoute} />
      </aside>
      <SuperMapMap
        routes={allRoutes}
        supportPoints={supportPoints}
        activeRouteId={activeRouteId}
        comparedRouteIds={comparedRouteIds}
        layerVisibility={mapLayerVisibility}
        basemapMode={basemapMode}
        onSelectRoute={setActiveRouteId}
      />
      <aside className="right-panel">
        <SuperMapStatusPanel />
        <LayerControlPanel
          visibility={mapLayerVisibility}
          basemapMode={basemapMode}
          supportPointCount={supportPoints.length}
          onChange={setMapLayerVisibility}
          onBasemapChange={setBasemapMode}
        />
        <RouteAnalysisPanel route={activeRoute} supportPoints={supportPoints} />
        <Scene3DPanel />
        <DataPackagePanel />
        <ComparisonPanel routes={comparedRoutes} />
        <ExportPanel routes={comparedRoutes} supportPoints={supportPoints} />
      </aside>
    </main>
  );
}
