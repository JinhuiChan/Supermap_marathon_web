export type LoadState = "idle" | "loading" | "ready" | "error";

let state: LoadState = "idle";
let lastError: Error | null = null;
let scriptPromises = new Map<string, Promise<void>>();
let scriptStates = new Map<string, LoadState>();
let stylesheetPromises = new Map<string, Promise<void>>();

export function getScriptLoadState(): LoadState {
  return state;
}

export function getScriptLoadError(): Error | null {
  return lastError;
}

export function loadScript(url: string): Promise<void> {
  if (scriptStates.get(url) === "ready") return Promise.resolve();
  const cached = scriptPromises.get(url);
  if (cached) return cached;

  state = "loading";
  scriptStates.set(url, "loading");
  const loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-supermap-iclient][src="${url}"]`);
    if (existing) {
      scriptStates.set(url, "ready");
      state = allScriptsReady() ? "ready" : "loading";
      lastError = null;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.supermapIclient = "true";

    script.onload = () => {
      scriptStates.set(url, "ready");
      state = allScriptsReady() ? "ready" : "loading";
      lastError = null;
      resolve();
    };

    script.onerror = () => {
      scriptPromises.delete(url);
      scriptStates.set(url, "error");
      state = "error";
      lastError = new Error(`Failed to load iClient script: ${url}`);
      script.remove();
      reject(lastError);
    };

    document.head.appendChild(script);
  });

  scriptPromises.set(url, loadPromise);
  return loadPromise;
}

export async function loadScriptsInOrder(urls: string[]): Promise<void> {
  for (const url of urls) {
    await loadScript(url);
  }
}

export function loadStylesheet(url: string): Promise<void> {
  const existing = document.querySelector(`link[href="${url}"]`);
  if (existing) return Promise.resolve();

  const cached = stylesheetPromises.get(url);
  if (cached) return cached;

  const promise = new Promise<void>((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;

    link.onload = () => {
      stylesheetPromises.set(url, Promise.resolve());
      resolve();
    };

    link.onerror = () => {
      stylesheetPromises.delete(url);
      link.remove();
      reject(new Error(`Failed to load iClient stylesheet: ${url}`));
    };

    document.head.appendChild(link);
  });

  stylesheetPromises.set(url, promise);
  return promise;
}

export function resetScriptState(): void {
  state = "idle";
  lastError = null;
  scriptPromises.clear();
  scriptStates.clear();
  stylesheetPromises.clear();
}

function allScriptsReady(): boolean {
  return scriptStates.size > 0 && [...scriptStates.values()].every((scriptState) => scriptState === "ready");
}
