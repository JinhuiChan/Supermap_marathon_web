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
import { buildOsmMarathonTestRoute } from "./data/osmMarathonRoute";
import { supportPoints } from "./data/supportPoints";
import type { MarathonRoute } from "./domain/routeMetrics";

export default function App() {
  const [osmRoutes, setOsmRoutes] = useState<MarathonRoute[]>([]);
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
        const route = buildOsmMarathonTestRoute(geojson, {
          id: "osm-marathon-test",
          name: "OSM road-network test marathon",
          targetDistanceKm: 42.195,
          startPoint: [114.302, 30.604]
        });
        if (!route) return;
        setOsmRoutes([route]);
        setActiveRouteId(route.id);
        setComparedRouteIds([demoRoutes[0].id, route.id]);
      })
      .catch(() => {
        if (!cancelled) setOsmRoutes([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
          onSelectRoute={setActiveRouteId}
          onToggleCompare={toggleCompare}
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
