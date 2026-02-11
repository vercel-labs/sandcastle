import { useSyncExternalStore } from "react";

interface ViewportSize {
  height: number;
  width: number;
  offsetTop: number;
}

let cached: ViewportSize = {
  height: typeof window !== "undefined" ? window.innerHeight : 800,
  width: typeof window !== "undefined" ? window.innerWidth : 1280,
  offsetTop: 0,
};

const listeners = new Set<() => void>();

function update() {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const next: ViewportSize = vv
    ? { height: vv.height, width: vv.width, offsetTop: vv.offsetTop }
    : {
        height: typeof window !== "undefined" ? window.innerHeight : 800,
        width: typeof window !== "undefined" ? window.innerWidth : 1280,
        offsetTop: 0,
      };

  if (
    next.height !== cached.height ||
    next.width !== cached.width ||
    next.offsetTop !== cached.offsetTop
  ) {
    cached = next;
    for (const cb of listeners) cb();
  }
}

let listening = false;

function subscribe(cb: () => void) {
  listeners.add(cb);

  if (!listening && typeof window !== "undefined") {
    listening = true;
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
  }

  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && typeof window !== "undefined") {
      listening = false;
      const vv = window.visualViewport;
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
    }
  };
}

function getSnapshot() {
  return cached;
}

function getServerSnapshot(): ViewportSize {
  return { height: 800, width: 1280, offsetTop: 0 };
}

export function useVisualViewport(): ViewportSize {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
