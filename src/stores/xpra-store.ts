import { create } from "zustand";
import type {
  XpraClient as XpraClientType,
  XpraWindow as XpraWindowData,
  XpraWindowMoveResize,
  XpraWindowMetadataUpdate,
  XpraWindowIcon,
  XpraDraw,
  XpraNotification,
  XpraCursor,
  XpraSendFile,
} from "xpra-html5-client";
import { useNotificationStore } from "./notification-store";
import { useWorkspaceStore } from "./workspace-store";

export interface XpraWindowState {
  wid: number;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  focused: boolean;
  minimized: boolean;
  overrideRedirect: boolean;
}

interface PendingLaunch {
  command: string;
  timer: ReturnType<typeof setTimeout>;
}

const LAUNCH_TIMEOUT_MS = 10_000;

interface XpraStore {
  client: XpraClientType | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  windows: Map<number, XpraWindowState>;
  focusedWid: number | null;
  cursor: { url: string; xhot: number; yhot: number } | null;
  windowIcons: Map<number, string>;
  bellFlash: boolean;

  connect: (wsUrl: string) => void;
  disconnect: () => void;
  focusWindow: (wid: number) => void;
  moveResizeWindow: (wid: number, x: number, y: number, w: number, h: number) => void;
  closeWindow: (wid: number) => void;
  minimizeWindow: (wid: number) => void;
  unminimizeWindow: (wid: number) => void;
  launchApp: (command: string) => void;
  registerCanvas: (wid: number, canvas: HTMLCanvasElement) => void;
  unregisterCanvas: (wid: number) => void;
  sendGlobalPointerPosition: (x: number, y: number) => void;
}

const canvasRefs = new Map<number, HTMLCanvasElement>();
const originalWindows = new Map<number, XpraWindowData>();
const pendingLaunches = new Map<number, PendingLaunch>();
let launchCounter = 0;
let currentClient: XpraClientType | null = null;
let connectionId = 0;
let pasteHandler: (() => void) | null = null;

export const useXpraStore = create<XpraStore>()((set, get) => ({
  client: null,
  connected: false,
  connecting: false,
  error: null,
  windows: new Map(),
  focusedWid: null,
  cursor: null,
  windowIcons: new Map(),
  bellFlash: false,

  connect: (wsUrl) => {
    const { connected, connecting, client } = get();
    if (connected || connecting || client) {
      get().disconnect();
    }

    const thisConnectionId = ++connectionId;
    set({ connecting: true, error: null });

    import("xpra-html5-client")
      .then(({ XpraClient, XpraDecodeNullWorker }) => {
        if (thisConnectionId !== connectionId) return;

        const decoder = new XpraDecodeNullWorker();
        const xpraClient = new XpraClient({ decoder });
        currentClient = xpraClient;

        xpraClient.on("connect", () => {
          set({ connected: true, connecting: false, error: null });
        });

        xpraClient.on("disconnect", () => {
          set({ connected: false, connecting: false });
        });

        xpraClient.on("error", (message: string) => {
          console.error("[Xpra] Error:", message);
          set({ error: message, connecting: false });
        });

        xpraClient.on("newWindow", (win: XpraWindowData) => {
          const wid = win.id;
          const [x, y] = win.position;
          const [width, height] = win.dimension;
          const isOverrideRedirect = win.overrideRedirect || false;

          const metadata = win.metadata as Record<string, unknown>;
          const title = (metadata?.title as string) || "Untitled";

          // A new window appeared -- clear any pending launch timeout.
          // We clear the oldest pending launch since Xpra doesn't tell us
          // which sendStartCommand produced this window.
          if (!isOverrideRedirect && pendingLaunches.size > 0) {
            const [firstKey, firstLaunch] = pendingLaunches.entries().next().value!;
            clearTimeout(firstLaunch.timer);
            pendingLaunches.delete(firstKey);
          }

          originalWindows.set(wid, win);

          set((state) => {
            const next = new Map(state.windows);
            if (!isOverrideRedirect) {
              next.forEach((existing, id) => {
                next.set(id, { ...existing, focused: false });
              });
            }
            next.set(wid, {
              wid,
              title,
              x,
              y,
              width,
              height,
              focused: !isOverrideRedirect,
              minimized: false,
              overrideRedirect: isOverrideRedirect,
            });
            return {
              windows: next,
              focusedWid: isOverrideRedirect ? state.focusedWid : wid,
            };
          });

          xpraClient.sendMapWindow(win);
        });

        xpraClient.on("removeWindow", (wid: number) => {
          set((state) => {
            const next = new Map(state.windows);
            next.delete(wid);
            const nextIcons = new Map(state.windowIcons);
            nextIcons.delete(wid);
            return { windows: next, windowIcons: nextIcons };
          });
          canvasRefs.delete(wid);
          originalWindows.delete(wid);
          useNotificationStore.getState().removeTrayIcon(wid);
        });

        xpraClient.on("moveResizeWindow", (data: XpraWindowMoveResize) => {
          set((state) => {
            const next = new Map(state.windows);
            const win = next.get(data.wid);
            if (win) {
              const [x, y] = data.position || [win.x, win.y];
              const [width, height] = data.dimension || [win.width, win.height];
              next.set(data.wid, { ...win, x, y, width, height });
            }
            return { windows: next };
          });
        });

        xpraClient.on("updateWindowMetadata", (data: XpraWindowMetadataUpdate) => {
          set((state) => {
            const next = new Map(state.windows);
            const win = next.get(data.wid);
            if (win) {
              next.set(data.wid, {
                ...win,
                title: (data.metadata?.title as string) || win.title,
              });
            }
            return { windows: next };
          });
        });

        xpraClient.on("raiseWindow", (wid: number) => {
          set((state) => {
            const next = new Map(state.windows);
            next.forEach((win, id) => {
              next.set(id, { ...win, focused: id === wid });
            });
            return { windows: next, focusedWid: wid };
          });
        });

        xpraClient.on("draw", (draw: XpraDraw) => {
          const [x, y] = draw.position;
          if (draw.image instanceof ImageBitmap) {
            const canvas = canvasRefs.get(draw.wid);
            if (canvas) {
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(draw.image, x, y);
              }
            }
          }
          xpraClient.sendDamageSequence(draw.packetSequence, draw.wid, draw.dimension, 0);
        });

        xpraClient.on("drawBuffer", (draw: XpraDraw, buffer: ImageBitmap | null) => {
          if (!buffer) return;
          const [x, y] = draw.position;
          const canvas = canvasRefs.get(draw.wid);
          if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(buffer, x, y);
            }
          }
        });

        // -- Native bridge: Notifications --
        xpraClient.on("showNotification", (notification: XpraNotification) => {
          useNotificationStore.getState().addNotification({
            id: notification.id,
            replacesId: notification.replacesId,
            summary: notification.summary,
            body: notification.body,
            icon: notification.icon,
            actions: notification.actions || [],
            expires: notification.expires,
            workspaceId: useWorkspaceStore.getState().activeWorkspaceId,
          });
        });

        xpraClient.on("hideNotification", (id: number) => {
          useNotificationStore.getState().hideNotification(id);
        });

        // -- Native bridge: System tray icons --
        xpraClient.on("newTray", (win: XpraWindowData) => {
          const metadata = win.metadata as Record<string, unknown>;
          const title = (metadata?.title as string) || "";
          useNotificationStore.getState().addTrayIcon({
            wid: win.id,
            title,
            icon: null,
          });
        });

        // -- Native bridge: Custom cursors --
        xpraClient.on("cursor", (cursor: XpraCursor | null) => {
          if (!cursor || !cursor.data) {
            set({ cursor: null });
          } else {
            set({
              cursor: {
                url: cursor.data,
                xhot: cursor.xhot,
                yhot: cursor.yhot,
              },
            });
          }
        });

        // -- Native bridge: Per-window icons --
        xpraClient.on("windowIcon", (icon: XpraWindowIcon) => {
          if (!icon.data) return;
          set((state) => {
            const next = new Map(state.windowIcons);
            next.set(icon.wid, icon.data);
            return { windowIcons: next };
          });
        });

        // -- Native bridge: Bell --
        xpraClient.on("bell", () => {
          set({ bellFlash: true });
          setTimeout(() => set({ bellFlash: false }), 300);
        });

        // -- Native bridge: File transfer (downloads from sandbox) --
        xpraClient.on("sendFile", (file: XpraSendFile) => {
          const blob = new Blob([file.data as BlobPart], { type: file.mimetype || "application/octet-stream" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.filename;
          a.click();
          URL.revokeObjectURL(url);
        });

        // -- Native bridge: Open URL in host browser --
        xpraClient.on("openUrl", (url: string) => {
          if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
            window.open(url, "_blank", "noopener,noreferrer");
          }
        });

        // -- Clipboard sync: X11 -> Browser --
        xpraClient.on("connect", () => {
          const clipboard = xpraClient.clipboard;
          if (!clipboard) return;

          clipboard.on("send", (
            _requestId: number,
            _selection: string,
            buffer: string,
            dataType?: string,
          ) => {
            const isText =
              !dataType ||
              dataType === "UTF8_STRING" ||
              dataType === "TEXT" ||
              dataType === "STRING" ||
              dataType === "text/plain";

            if (isText && buffer && typeof buffer === "string" && buffer.trim().length > 0) {
              navigator.clipboard.writeText(buffer).catch(() => {});
            }
          });

          clipboard.on("token", () => {
            // Token indicates clipboard ownership changed in X11.
            // The actual data arrives via the "send" event.
          });
        });

        // -- Clipboard sync: Browser -> X11 --
        // When the user pastes in the browser, push clipboard text to Xpra.
        // clipboard.poll() reads the browser clipboard and emits a "token"
        // event which the client sends as a clipboard-token packet to X11.
        if (pasteHandler) {
          document.removeEventListener("paste", pasteHandler);
          pasteHandler = null;
        }
        const handleBrowserPaste = async () => {
          try {
            if (xpraClient.clipboard?.isEnabled()) {
              await xpraClient.clipboard.poll();
            }
          } catch {
            // Clipboard API may be denied without a user gesture
          }
        };
        pasteHandler = handleBrowserPaste;
        document.addEventListener("paste", handleBrowserPaste);

        xpraClient.init().then(() => {
          const wsProtocol = wsUrl.startsWith("https") ? "wss" : "ws";
          const wsHost = wsUrl.replace(/^https?:\/\//, "");
          const fullWsUrl = `${wsProtocol}://${wsHost}`;
          xpraClient.connect(fullWsUrl, {
            stealSession: true,
            clipboard: true,
            keyboard: true,
            mouse: true,
            audio: false,
            video: true,
            printing: false,
            fileTransfer: true,
            notifications: true,
            bell: true,
            tray: true,
            cursor: true,
            openUrl: true,
          });
        });

        set({ client: xpraClient });
      })
      .catch((err) => {
        console.error("[Xpra] Failed to load:", err);
        set({ error: "Failed to load Xpra client", connecting: false });
      });
  },

  disconnect: () => {
    const { client } = get();
    if (client) client.disconnect();
    if (currentClient && currentClient !== client) currentClient.disconnect();
    currentClient = null;
    if (pasteHandler) {
      document.removeEventListener("paste", pasteHandler);
      pasteHandler = null;
    }
    canvasRefs.clear();
    originalWindows.clear();
    for (const [, launch] of pendingLaunches) clearTimeout(launch.timer);
    pendingLaunches.clear();
    set({
      client: null,
      connected: false,
      connecting: false,
      windows: new Map(),
      focusedWid: null,
      cursor: null,
      windowIcons: new Map(),
      bellFlash: false,
    });
  },

  focusWindow: (wid) => {
    const { client, windows } = get();
    if (!client || !windows.has(wid)) return;
    const xpraWindows = Array.from(originalWindows.values());
    if (xpraWindows.length > 0) {
      client.sendWindowRaise(wid, xpraWindows);
    }
    set((state) => {
      const next = new Map(state.windows);
      next.forEach((win, id) => {
        next.set(id, { ...win, focused: id === wid });
      });
      return { windows: next, focusedWid: wid };
    });
  },

  moveResizeWindow: (wid, x, y, width, height) => {
    const { client } = get();
    if (!client) return;
    client.sendGeometryWindow(wid, [x, y], [width, height]);
    client.sendBufferRefresh(wid);
    set((state) => {
      const next = new Map(state.windows);
      const win = next.get(wid);
      if (win) next.set(wid, { ...win, x, y, width, height });
      return { windows: next };
    });
  },

  closeWindow: (wid) => {
    const { client } = get();
    if (client) client.sendWindowClose(wid);
  },

  minimizeWindow: (wid) => {
    set((state) => {
      const next = new Map(state.windows);
      const win = next.get(wid);
      if (win) next.set(wid, { ...win, minimized: true });
      return { windows: next };
    });
  },

  unminimizeWindow: (wid) => {
    set((state) => {
      const next = new Map(state.windows);
      const win = next.get(wid);
      if (win) next.set(wid, { ...win, minimized: false });
      return { windows: next };
    });
    get().focusWindow(wid);
  },

  launchApp: (command) => {
    const { client, connected } = get();
    if (!client) return;
    if (!connected) {
      useNotificationStore.getState().addNotification({
        id: Date.now(),
        replacesId: 0,
        summary: "Cannot launch app",
        body: `Not connected to display server. Try again in a moment.`,
        icon: null,
        actions: [],
        expires: 6000,
        workspaceId: useWorkspaceStore.getState().activeWorkspaceId,
      });
      return;
    }

    client.sendStartCommand(command, command, false);

    const launchId = ++launchCounter;
    const launchWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
    const timer = setTimeout(() => {
      pendingLaunches.delete(launchId);
      useNotificationStore.getState().addNotification({
        id: Date.now(),
        replacesId: 0,
        summary: "App may have failed to start",
        body: `"${command}" did not open a window within ${LAUNCH_TIMEOUT_MS / 1000}s. It may have crashed on startup.`,
        icon: null,
        actions: [],
        expires: 8000,
        workspaceId: launchWorkspaceId,
      });
    }, LAUNCH_TIMEOUT_MS);
    pendingLaunches.set(launchId, { command, timer });
  },

  registerCanvas: (wid, canvas) => {
    canvasRefs.set(wid, canvas);
  },

  unregisterCanvas: (wid) => {
    canvasRefs.delete(wid);
  },

  sendGlobalPointerPosition: (x, y) => {
    const { client, connected } = get();
    if (!client || !connected) return;
    // Send pointer position to root window (wid=0) for apps like xeyes
    // that track the global cursor position
    if (typeof client.sendPointerPosition === "function") {
      client.sendPointerPosition(0, x, y, []);
    } else if (typeof client.sendMouseMove === "function") {
      client.sendMouseMove(0, [x, y], []);
    }
  },
}));
