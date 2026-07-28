import { afterEach, describe, expect, it, vi } from "vitest";
import { MapEngine } from "./MapEngine";

function installMapEnvironment() {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const superMapLayerAddTo = vi.fn();
  const wmsAddTo = vi.fn();
  const wmsFactory = vi.fn(() => ({ addTo: wmsAddTo }));
  const tiledMapLayerFactory = vi.fn(() => ({ addTo: superMapLayerAddTo }));
  const map = {
    on: vi.fn(),
    remove: vi.fn()
  };
  const L = {
    map: vi.fn(() => map),
    tileLayer: Object.assign(vi.fn(), { wms: wmsFactory }),
    supermap: {
      TiledMapLayer: tiledMapLayerFactory
    }
  };
  const fakeDocument = {
    createElement: () => ({
      style: {},
      appendChild: vi.fn(),
      remove: vi.fn(),
      className: "",
      textContent: ""
    })
  };
  const container = {
    appendChild: vi.fn()
  } as unknown as HTMLElement;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { L }
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fakeDocument
  });

  return {
    container,
    tiledMapLayerFactory,
    wmsFactory,
    restore: () => {
      Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
      Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MapEngine", () => {
  it("uses SuperMap iClient TiledMapLayer for the iServer basemap", () => {
    const env = installMapEnvironment();
    try {
      const engine = new MapEngine({
        container: env.container,
        wmsUrl: "http://127.0.0.1:8090/iserver/services/map-wuhan-road-network/wms111",
        mapRestUrl: "http://127.0.0.1:8090/iserver/services/map-wuhan-road-network/rest/maps/road_network_osm%40wuhan_marathon_base",
        wmsLayerName: "0",
        defaultBasemap: "supermapDem",
        center: [114.32, 30.58],
        zoom: 12
      });

      engine.initialize();

      expect(env.tiledMapLayerFactory).toHaveBeenCalledWith(
        "http://127.0.0.1:8090/iserver/services/map-wuhan-road-network/rest/maps/road_network_osm%40wuhan_marathon_base",
        expect.objectContaining({ attribution: "SuperMap iClient for JavaScript" })
      );
      expect(env.wmsFactory).not.toHaveBeenCalled();
    } finally {
      env.restore();
    }
  });
});
