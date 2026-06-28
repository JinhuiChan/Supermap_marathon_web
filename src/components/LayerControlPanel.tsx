import type { MapLayerVisibility } from "../map/components/SuperMapMap";

interface LayerControlPanelProps {
  visibility: MapLayerVisibility;
  supportPointCount: number;
  onChange: (visibility: MapLayerVisibility) => void;
}

export function LayerControlPanel({ visibility, supportPointCount, onChange }: LayerControlPanelProps) {
  const updateLayer = (key: keyof MapLayerVisibility) => {
    onChange({
      ...visibility,
      [key]: !visibility[key]
    });
  };

  return (
    <section className="side-section layer-control">
      <h2>图层控制</h2>
      <label className="layer-toggle">
        <input type="checkbox" checked={visibility.routes} onChange={() => updateLayer("routes")} />
        <span>
          <strong>候选赛道</strong>
          <small>显示路线走向与点击选线</small>
        </span>
      </label>
      <label className="layer-toggle">
        <input type="checkbox" checked={visibility.supportPoints} onChange={() => updateLayer("supportPoints")} />
        <span>
          <strong>赛事服务点</strong>
          <small>{supportPointCount} 个起终点、补给、医疗和停车点</small>
        </span>
      </label>
    </section>
  );
}
