import { afterEach, describe, expect, it } from "vitest";
import { loadScriptsInOrder, resetScriptState } from "./loadScript";

type FakeElement = {
  src?: string;
  rel?: string;
  href?: string;
  async?: boolean;
  dataset: Record<string, string>;
  onload?: () => void;
  onerror?: () => void;
  remove: () => void;
};

function installFakeDocument() {
  const appended: FakeElement[] = [];
  const originalDocument = globalThis.document;
  const fakeDocument = {
    querySelector: () => null,
    createElement: () =>
      ({
        dataset: {},
        remove: () => {}
      }) as FakeElement,
    head: {
      appendChild: (element: FakeElement) => {
        appended.push(element);
      }
    }
  };

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fakeDocument
  });

  return {
    appended,
    restore: () => {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument
      });
    }
  };
}

afterEach(() => {
  resetScriptState();
});

describe("loadScriptsInOrder", () => {
  it("loads SuperMap iClient scripts sequentially", async () => {
    const { appended, restore } = installFakeDocument();
    try {
      const promise = loadScriptsInOrder(["leaflet.js", "iclient-leaflet-es6.min.js"]);

      expect(appended.map((script) => script.src)).toEqual(["leaflet.js"]);
      appended[0].onload?.();
      await Promise.resolve();
      expect(appended.map((script) => script.src)).toEqual(["leaflet.js", "iclient-leaflet-es6.min.js"]);
      appended[1].onload?.();

      await expect(promise).resolves.toBeUndefined();
    } finally {
      restore();
    }
  });
});
