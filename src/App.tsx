import { useMemo, useState } from "react";
import { ComparisonPanel } from "./components/ComparisonPanel";
import { DataPackagePanel } from "./components/DataPackagePanel";
import { ExportPanel } from "./components/ExportPanel";
import { LayerControlPanel } from "./components/LayerControlPanel";
import { RouteAnalysisPanel } from "./components/RouteAnalysisPanel";
import { RouteDetails } from "./components/RouteDetails";
import { RouteLibrary } from "./components/RouteLibrary";
import { SuperMapStatusPanel } from "./components/SuperMapStatusPanel";
import type { MapLayerVisibility } from "./map/components/SuperMapMap";
import { SuperMapMap } from "./map/components/SuperMapMap";
import { Scene3DPanel } from "./map/components/Scene3DPanel";
import { demoRoutes } from "./data/routes";
import { supportPoints } from "./data/supportPoints";

export default function App() {
  const [activeRouteId, setActiveRouteId] = useState(demoRoutes[0].id);
  const [comparedRouteIds, setComparedRouteIds] = useState<string[]>([demoRoutes[0].id, demoRoutes[1].id]);
  const [mapLayerVisibility, setMapLayerVisibility] = useState<MapLayerVisibility>({
    routes: true,
    supportPoints: true
  });
  const activeRoute = useMemo(
    () => demoRoutes.find((route) => route.id === activeRouteId) ?? demoRoutes[0],
    [activeRouteId]
  );
  const comparedRoutes = useMemo(
    () => demoRoutes.filter((route) => comparedRouteIds.includes(route.id)),
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
          routes={demoRoutes}
          activeRouteId={activeRouteId}
          comparedRouteIds={comparedRouteIds}
          onSelectRoute={setActiveRouteId}
          onToggleCompare={toggleCompare}
        />
        <RouteDetails route={activeRoute} />
      </aside>
      <SuperMapMap
        routes={demoRoutes}
        supportPoints={supportPoints}
        activeRouteId={activeRouteId}
        comparedRouteIds={comparedRouteIds}
        layerVisibility={mapLayerVisibility}
        onSelectRoute={setActiveRouteId}
      />
      <aside className="right-panel">
        <SuperMapStatusPanel />
        <LayerControlPanel
          visibility={mapLayerVisibility}
          supportPointCount={supportPoints.length}
          onChange={setMapLayerVisibility}
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
