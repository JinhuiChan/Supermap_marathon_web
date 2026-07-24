import type { MarathonRoute } from "../domain/routeMetrics";
import { waypointRoutePlans } from "../data/profileRoutePlanner";
import { buildRouteDirectionMarkers } from "../map/layers/RouteLayer";

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
        <strong>{comparedRouteIds.length}/{waypointRoutePlans.length} 已加入对比</strong>
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
            <g key={route.id}>
              <polyline
                points={points}
                fill="none"
                stroke={route.color}
                strokeWidth={isActive ? 2.8 : isCompared ? 1.6 : 1.1}
                opacity={isActive ? 1 : isCompared ? 0.58 : 0.28}
                className="route-line"
                onClick={() => onSelectRoute(route.id)}
              />
              {(isActive || isCompared) &&
                buildRouteDirectionMarkers(route, isActive ? 10 : 4).map((marker, index) => {
                  const [x, y] = project(marker.coordinate).split(",").map(Number);
                  return (
                    <path
                      key={`${route.id}-dir-${index}`}
                      d="M -2.8 -2.4 L 3.6 0 L -2.8 2.4 Z"
                      transform={`translate(${x} ${y}) rotate(${-marker.angleDeg})`}
                      fill={route.color}
                      opacity={isActive ? 0.92 : 0.45}
                      pointerEvents="none"
                    />
                  );
                })}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
