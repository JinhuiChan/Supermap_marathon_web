import type { BasemapMode } from "../config/supermap";
import type { MapLayerVisibility } from "../map/components/SuperMapMap";

interface LayerControlPanelProps {
  visibility: MapLayerVisibility;
  basemapMode: BasemapMode;
  supportPointCount: number;
  onChange: (visibility: MapLayerVisibility) => void;
  onBasemapChange: (mode: BasemapMode) => void;
}

export function LayerControlPanel({
  visibility,
  basemapMode,
  supportPointCount,
  onChange,
  onBasemapChange
}: LayerControlPanelProps) {
  const updateLayer = (key: keyof MapLayerVisibility) => {
    onChange({
      ...visibility,
      [key]: !visibility[key]
    });
  };

  return (
    <section className="side-section layer-control">
      <h2>图层控制</h2>
      <div className="basemap-switch" aria-label="底图切换">
        <strong>底图切换</strong>
        <label>
          <input
            type="radio"
            name="basemap"
            checked={basemapMode === "online"}
            onChange={() => onBasemapChange("online")}
          />
          <span>OpenStreetMap 备用底图</span>
        </label>
        <label>
          <input
            type="radio"
            name="basemap"
            checked={basemapMode === "supermapDem"}
            onChange={() => onBasemapChange("supermapDem")}
          />
          <span>iDesktop 发布图</span>
        </label>
      </div>
      <label className="layer-toggle">
        <input type="checkbox" checked={visibility.routes} onChange={() => updateLayer("routes")} />
        <span>
          <strong>候选赛道</strong>
          <small>显示路线走向与点击选线</small>
        </span>
      </label>
      <label className="layer-toggle">
        <input type="checkbox" checked={visibility.roadNetwork} onChange={() => updateLayer("roadNetwork")} />
        <span>
          <strong>汉马道路走廊</strong>
          <small>显示官方路线周边真实 OSM 道路网络</small>
        </span>
      </label>
      <label className="layer-toggle">
        <input type="checkbox" checked={visibility.supportPoints} onChange={() => updateLayer("supportPoints")} />
        <span>
          <strong>赛事服务点</strong>
          <small>{supportPointCount} 个起终点、补给、医疗、交通、停车和应急点</small>
        </span>
      </label>
    </section>
  );
}
