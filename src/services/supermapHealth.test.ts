import { describe, expect, it, vi } from "vitest";
import { buildWmsCapabilitiesUrl, checkSuperMapWms } from "./supermapHealth";

describe("supermapHealth", () => {
  it("builds a WMS GetCapabilities URL without dropping existing path segments", () => {
    const url = buildWmsCapabilitiesUrl("http://127.0.0.1:8090/iserver/services/map-world/wms111/World");

    expect(url).toBe(
      "http://127.0.0.1:8090/iserver/services/map-world/wms111/World?SERVICE=WMS&REQUEST=GetCapabilities"
    );
  });

  it("only marks WMS ready when the capabilities document is returned", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => new Response("<WMT_MS_Capabilities></WMT_MS_Capabilities>", { status: 200 }));
    globalThis.fetch = fetchMock;

    await expect(checkSuperMapWms("http://127.0.0.1:8090/iserver/services/map-world/wms111/World")).resolves.toBe(
      "ready"
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8090/iserver/services/map-world/wms111/World?SERVICE=WMS&REQUEST=GetCapabilities",
      expect.objectContaining({ cache: "no-store" })
    );

    globalThis.fetch = originalFetch;
  });
});
