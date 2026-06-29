export type LoadState = "idle" | "loading" | "ready" | "error";

let state: LoadState = "idle";
let loadPromise: Promise<void> | null = null;
let lastError: Error | null = null;
let loadedUrl: string | null = null;
let stylesheetPromises = new Map<string, Promise<void>>();

export function getScriptLoadState(): LoadState {
  return state;
}

export function getScriptLoadError(): Error | null {
  return lastError;
}

export function loadScript(url: string): Promise<void> {
  if (state === "ready") {
    if (loadedUrl !== url) {
      return Promise.reject(
        new Error(`A different iClient script is already loaded: ${loadedUrl}`)
      );
    }
    return Promise.resolve();
  }
  if (state === "loading" && loadPromise) {
    if (loadedUrl !== url) {
      return Promise.reject(
        new Error(`A different iClient script is already loading: ${loadedUrl}`)
      );
    }
    return loadPromise;
  }

  state = "loading";
  loadedUrl = url;
  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-supermap-iclient]`);
    if (existing) {
      state = "ready";
      lastError = null;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.supermapIclient = "true";

    script.onload = () => {
      state = "ready";
      lastError = null;
      resolve();
    };

    script.onerror = (event) => {
      state = "error";
      lastError = new Error(`Failed to load iClient script: ${url}`);
      script.remove();
      reject(lastError);
    };

    document.head.appendChild(script);
  });

  return loadPromise;
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
  loadPromise = null;
  lastError = null;
  loadedUrl = null;
  stylesheetPromises.clear();
}
