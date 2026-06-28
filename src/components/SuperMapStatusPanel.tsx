import { useEffect, useState } from "react";
import { superMapConfig } from "../config/supermap";
import {
  checkSuperMapIserver,
  checkSuperMapResource,
  type SuperMapResourceStatus,
  type SuperMapStatus
} from "../services/supermapHealth";

const statusText: Record<SuperMapStatus, string> = {
  checking: "检测中",
  online: "已连接",
  offline: "未连接"
};

const resourceText: Record<SuperMapResourceStatus, string> = {
  checking: "检测中",
  ready: "已发布",
  pending: "待发布"
};

export function SuperMapStatusPanel() {
  const [status, setStatus] = useState<SuperMapStatus>("checking");
  const [mapStatus, setMapStatus] = useState<SuperMapResourceStatus>("checking");
  const [sceneStatus, setSceneStatus] = useState<SuperMapResourceStatus>("checking");

  useEffect(() => {
    let active = true;

    checkSuperMapIserver(superMapConfig.iServerBaseUrl).then((nextStatus) => {
      if (active) setStatus(nextStatus);
    });
    checkSuperMapResource(superMapConfig.expectedMapServiceUrl).then((nextStatus) => {
      if (active) setMapStatus(nextStatus);
    });
    checkSuperMapResource(superMapConfig.expectedSceneServiceUrl).then((nextStatus) => {
      if (active) setSceneStatus(nextStatus);
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
      <div className="service-readiness" aria-label="SuperMap 服务发布状态">
        <div className={`readiness-item ${mapStatus}`}>
          <span>二维地图服务</span>
          <strong>{resourceText[mapStatus]}</strong>
        </div>
        <div className={`readiness-item ${sceneStatus}`}>
          <span>三维地形服务</span>
          <strong>{resourceText[sceneStatus]}</strong>
        </div>
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
        <div>
          <dt>DEM 范围</dt>
          <dd>
            {superMapConfig.demMetadata.name} · {superMapConfig.demMetadata.crs} · {superMapConfig.demMetadata.bounds}
          </dd>
        </div>
        <div>
          <dt>DEM 高程</dt>
          <dd>
            {superMapConfig.demMetadata.size} · {superMapConfig.demMetadata.elevationRange}
          </dd>
        </div>
      </dl>
      <p className="integration-note">
        当前页面已按 SuperMap iServer 服务地址组织地图接入边界；发布武汉马拉松地图和三维地形服务后，地图面板即可切换到
        SuperMap iClient 图层。
      </p>
    </section>
  );
}
