import type { MarathonRoute } from "../domain/routeMetrics";

interface RouteMapProps {
  routes: MarathonRoute[];
  activeRouteId: string;
  comparedRouteIds: string[];
  onSelectRoute: (id: string) => void;
}

export function RouteMap({ routes, activeRouteId, comparedRouteIds, onSelectRoute }: RouteMapProps) {
  const minLon = 114.25;
  const maxLon = 114.47;
  const minLat = 30.52;
  const maxLat = 30.63;
  const project = ([lon, lat]: [number, number]) => {
    const x = ((lon - minLon) / (maxLon - minLon)) * 100;
    const y = 100 - ((lat - minLat) / (maxLat - minLat)) * 100;
    return `${x},${y}`;
  };

  return (
    <section className="map-panel" aria-label="武汉马拉松赛道地图">
      <div className="map-toolbar">
        <span>武汉 WebGIS 赛道工作台 · SuperMap iServer</span>
        <strong>{comparedRouteIds.length}/5 已加入对比</strong>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="路线示意图">
        <rect x="0" y="0" width="100" height="100" rx="0" className="map-bg" />
        <path d="M7 48 C22 38 32 62 46 49 S74 40 92 55" className="river" />
        <path d="M14 20 L86 84 M10 74 L88 22 M24 8 L40 92 M62 5 L70 95" className="road-grid" />
        {routes.map((route) => {
          const points = route.coordinates.map(project).join(" ");
          const isActive = route.id === activeRouteId;
          const isCompared = comparedRouteIds.includes(route.id);

          return (
            <polyline
              key={route.id}
              points={points}
              fill="none"
              stroke={route.color}
              strokeWidth={isActive ? 2.8 : isCompared ? 2.2 : 1.3}
              opacity={isActive || isCompared ? 1 : 0.42}
              className="route-line"
              onClick={() => onSelectRoute(route.id)}
            />
          );
        })}
      </svg>
    </section>
  );
}
