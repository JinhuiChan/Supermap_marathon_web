import { useMemo, useState } from "react";
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
import { getOrGenerateRoutes } from "./data/generatedRoutes";
import { supportPoints } from "./data/supportPoints";

export default function App() {
  const allRoutes = useMemo(() => [...demoRoutes, ...getOrGenerateRoutes()], []);
  const [activeRouteId, setActiveRouteId] = useState(allRoutes[0].id);
  const [comparedRouteIds, setComparedRouteIds] = useState<string[]>([allRoutes[0].id, allRoutes[1]?.id ?? allRoutes[0].id]);
  const [mapLayerVisibility, setMapLayerVisibility] = useState<MapLayerVisibility>({
    routes: true,
    supportPoints: true
  });
  const [basemapMode, setBasemapMode] = useState<BasemapMode>(superMapConfig.defaultBasemap);
  const activeRoute = useMemo(
    () => allRoutes.find((route) => route.id === activeRouteId) ?? allRoutes[0],
    [activeRouteId]
  );
  const comparedRoutes = useMemo(
    () => allRoutes.filter((route) => comparedRouteIds.includes(route.id)),
    [comparedRouteIds]
  );

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
