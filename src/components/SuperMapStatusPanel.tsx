import { useEffect, useState } from "react";
import { superMapConfig } from "../config/supermap";
import { checkSuperMapIserver, type SuperMapStatus } from "../services/supermapHealth";

const statusText: Record<SuperMapStatus, string> = {
  checking: "检测中",
  online: "已连接",
  offline: "未连接"
};

export function SuperMapStatusPanel() {
  const [status, setStatus] = useState<SuperMapStatus>("checking");

  useEffect(() => {
    let active = true;

    checkSuperMapIserver(superMapConfig.iServerBaseUrl).then((nextStatus) => {
      if (active) setStatus(nextStatus);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="side-section supermap-status">
      <h2>SuperMap 接入</h2>
      <div className={`status-pill ${status}`}>
        <span>SuperMap iServer</span>
        <strong>{statusText[status]}</strong>
      </div>
      <dl className="service-list">
        <div>
          <dt>版本要求</dt>
          <dd>{superMapConfig.version}</dd>
        </div>
        <div>
          <dt>iServer 地址</dt>
          <dd>{superMapConfig.iServerBaseUrl}</dd>
        </div>
        <div>
          <dt>iClient JavaScript</dt>
          <dd>{superMapConfig.iClientJavaScriptUrl}</dd>
        </div>
        <div>
          <dt>iClient3D for WebGL/WebGPU</dt>
          <dd>{superMapConfig.iClient3DUrl}</dd>
        </div>
        <div>
          <dt>武汉 DEM 数据</dt>
          <dd>{superMapConfig.demDataPath}</dd>
        </div>
      </dl>
      <p className="integration-note">
        当前页面已按 SuperMap iServer 服务地址组织地图接入边界；发布武汉马拉松地图服务后，将地图面板从示意图切换到
        iClient 图层。
      </p>
    </section>
  );
}
