import { create } from "zustand";
import type { WindowState, WindowPosition, WindowSize, SnapZone } from "@/types/window";
import { v4 as uuid } from "uuid";

interface WindowStore {
  // Per-workspace window states
  windowsByWorkspace: Record<string, WindowState[]>;
  activeWorkspaceId: string | null;
  nextZIndex: number;

  // Derived getter for current workspace windows
  getWindows: () => WindowState[];

  setActiveWorkspace: (id: string | null) => void;
  loadWindowState: (workspaceId: string, windows: WindowState[]) => void;

  openWindow: (opts: {
    title: string;
    appId: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    meta?: Record<string, unknown>;
  }) => string;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  moveWindow: (id: string, position: WindowPosition) => void;
  resizeWindow: (id: string, size: WindowSize) => void;
  snapWindow: (id: string, zone: SnapZone) => void;
  unsnapWindow: (id: string) => void;
  setWindowTitle: (id: string, title: string) => void;
  getTopmostWindow: () => WindowState | undefined;
  getSerializableState: (workspaceId?: string) => WindowState[];
}

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const CASCADE_OFFSET = 30;

function currentWindows(state: { windowsByWorkspace: Record<string, WindowState[]>; activeWorkspaceId: string | null }): WindowState[] {
  if (!state.activeWorkspaceId) return [];
  return state.windowsByWorkspace[state.activeWorkspaceId] || [];
}

function updateCurrentWindows(
  state: { windowsByWorkspace: Record<string, WindowState[]>; activeWorkspaceId: string | null },
  updater: (windows: WindowState[]) => WindowState[],
) {
  if (!state.activeWorkspaceId) return state.windowsByWorkspace;
  const current = state.windowsByWorkspace[state.activeWorkspaceId] || [];
  return {
    ...state.windowsByWorkspace,
    [state.activeWorkspaceId]: updater(current),
  };
}

export const useWindowStore = create<WindowStore>((set, get) => ({
  windowsByWorkspace: {},
  activeWorkspaceId: null,
  nextZIndex: 1,

  getWindows: () => currentWindows(get()),

  setActiveWorkspace: (id) => {
    set({ activeWorkspaceId: id });
  },

  loadWindowState: (workspaceId, windows) => {
    set((state) => ({
      windowsByWorkspace: {
        ...state.windowsByWorkspace,
        [workspaceId]: windows,
      },
      nextZIndex: Math.max(
        state.nextZIndex,
        ...windows.map((w) => w.zIndex + 1),
        1,
      ),
    }));
  },

  openWindow: (opts) => {
    const id = uuid();
    set((state) => {
      const windows = currentWindows(state);
      const cascade = windows.length * CASCADE_OFFSET;
      const z = state.nextZIndex;
      const win: WindowState = {
        id,
        title: opts.title,
        appId: opts.appId,
        position: {
          x: opts.x ?? 100 + (cascade % 300),
          y: opts.y ?? 100 + (cascade % 200),
        },
        size: {
          width: opts.width ?? DEFAULT_WIDTH,
          height: opts.height ?? DEFAULT_HEIGHT,
        },
        minimized: false,
        maximized: false,
        focused: true,
        zIndex: z,
        ...(opts.meta && { meta: opts.meta }),
      };

      return {
        windowsByWorkspace: updateCurrentWindows(state, (ws) => [
          ...ws.map((w) => ({ ...w, focused: false })),
          win,
        ]),
        nextZIndex: z + 1,
      };
    });
    scheduleSync();
    return id;
  },

  closeWindow: (id) => {
    set((state) => ({
      windowsByWorkspace: updateCurrentWindows(state, (ws) =>
        ws.filter((w) => w.id !== id),
      ),
    }));
    scheduleSync();
  },

  focusWindow: (id) => {
    set((state) => {
      const z = state.nextZIndex;
      return {
        windowsByWorkspace: updateCurrentWindows(state, (ws) =>
          ws.map((w) =>
            w.id === id
              ? { ...w, focused: true, zIndex: z, minimized: false }
              : { ...w, focused: false },
          ),
        ),
        nextZIndex: z + 1,
      };
    });
  },

  minimizeWindow: (id) => {
    set((state) => ({
      windowsByWorkspace: updateCurrentWindows(state, (ws) =>
        ws.map((w) =>
          w.id === id ? { ...w, minimized: true, focused: false } : w,
        ),
      ),
    }));
    scheduleSync();
  },

  maximizeWindow: (id) => {
    set((state) => ({
      windowsByWorkspace: updateCurrentWindows(state, (ws) =>
        ws.map((w) => (w.id === id ? { ...w, maximized: true } : w)),
      ),
    }));
    scheduleSync();
  },

  restoreWindow: (id) => {
    set((state) => ({
      windowsByWorkspace: updateCurrentWindows(state, (ws) =>
        ws.map((w) =>
          w.id === id ? { ...w, maximized: false, minimized: false } : w,
        ),
      ),
    }));
    scheduleSync();
  },

  moveWindow: (id, position) => {
    set((state) => ({
      windowsByWorkspace: updateCurrentWindows(state, (ws) =>
        ws.map((w) => (w.id === id ? { ...w, position } : w)),
      ),
    }));
    scheduleSync();
  },

  resizeWindow: (id, size) => {
    set((state) => ({
      windowsByWorkspace: updateCurrentWindows(state, (ws) =>
        ws.map((w) => (w.id === id ? { ...w, size } : w)),
      ),
    }));
    scheduleSync();
  },

  snapWindow: (id, zone) => {
    if (!zone) return;
    const TASKBAR_HEIGHT = 44;
    const vw = globalThis.innerWidth ?? 1280;
    const vh = (globalThis.innerHeight ?? 800) - TASKBAR_HEIGHT;
    const halfW = Math.round(vw / 2);
    const halfH = Math.round(vh / 2);

    const geometry: Record<NonNullable<SnapZone>, { x: number; y: number; w: number; h: number }> = {
      left: { x: 0, y: 0, w: halfW, h: vh },
      right: { x: halfW, y: 0, w: vw - halfW, h: vh },
      top: { x: 0, y: 0, w: vw, h: vh },
      "top-left": { x: 0, y: 0, w: halfW, h: halfH },
      "top-right": { x: halfW, y: 0, w: vw - halfW, h: halfH },
      "bottom-left": { x: 0, y: halfH, w: halfW, h: vh - halfH },
      "bottom-right": { x: halfW, y: halfH, w: vw - halfW, h: vh - halfH },
    };

    const g = geometry[zone];
    set((state) => ({
      windowsByWorkspace: updateCurrentWindows(state, (ws) =>
        ws.map((w) => {
          if (w.id !== id) return w;
          return {
            ...w,
            snapped: zone,
            preSnapPosition: w.snapped ? w.preSnapPosition : w.position,
            preSnapSize: w.snapped ? w.preSnapSize : w.size,
            position: { x: g.x, y: g.y },
            size: { width: g.w, height: g.h },
            maximized: false,
          };
        }),
      ),
    }));
    scheduleSync();
  },

  unsnapWindow: (id) => {
    set((state) => ({
      windowsByWorkspace: updateCurrentWindows(state, (ws) =>
        ws.map((w) => {
          if (w.id !== id || !w.snapped) return w;
          return {
            ...w,
            snapped: null,
            position: w.preSnapPosition ?? w.position,
            size: w.preSnapSize ?? w.size,
            preSnapPosition: undefined,
            preSnapSize: undefined,
          };
        }),
      ),
    }));
    scheduleSync();
  },

  setWindowTitle: (id, title) => {
    set((state) => ({
      windowsByWorkspace: updateCurrentWindows(state, (ws) =>
        ws.map((w) => (w.id === id ? { ...w, title } : w)),
      ),
    }));
  },

  getTopmostWindow: () => {
    const windows = currentWindows(get());
    const visible = windows.filter((w) => !w.minimized);
    if (visible.length === 0) return undefined;
    return visible.reduce((a, b) => (a.zIndex > b.zIndex ? a : b));
  },

  getSerializableState: (workspaceId) => {
    const id = workspaceId || get().activeWorkspaceId;
    if (!id) return [];
    return get().windowsByWorkspace[id] || [];
  },
}));

// Debounced sync to persist window state to the server (non-blocking)
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function doSync(workspaceId?: string) {
  const state = useWindowStore.getState();
  const wsId = workspaceId || state.activeWorkspaceId;
  if (!wsId) return;
  const windows = state.windowsByWorkspace[wsId] || [];
  fetch(`/api/sandbox/${wsId}/windows`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ windows }),
  }).catch(() => {});
}

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(doSync, 1000);
}

// Flush any pending sync immediately (fire-and-forget, non-blocking)
export function flushWindowSync(workspaceId?: string) {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  doSync(workspaceId);
}
