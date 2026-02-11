import { create } from "zustand";

export type NotificationUrgency = "low" | "normal" | "critical";
export type DesktopNotifMode = "background" | "always" | "off";

export interface DesktopNotification {
  id: number;
  replacesId: number;
  appName: string;
  summary: string;
  body: string;
  icon: string | null;
  actions: string[];
  expires: number;
  timestamp: number;
  read: boolean;
  urgency: NotificationUrgency;
  category: string | null;
  transient: boolean;
  workspaceId: string | null;
}

export interface TrayIcon {
  wid: number;
  title: string;
  icon: string | null;
}

interface NotificationStore {
  notifications: DesktopNotification[];
  history: DesktopNotification[];
  trayIcons: Map<number, TrayIcon>;
  centerOpen: boolean;
  unreadCount: number;

  // Preferences
  doNotDisturb: boolean;
  desktopNotifMode: DesktopNotifMode;
  browserPermission: NotificationPermission;

  setDoNotDisturb: (value: boolean) => void;
  setDesktopNotifMode: (mode: DesktopNotifMode) => void;
  requestBrowserPermission: () => Promise<NotificationPermission>;
  syncBrowserPermission: () => void;

  addNotification: (notification: Omit<DesktopNotification, "timestamp" | "read" | "appName" | "urgency" | "category" | "transient" | "workspaceId"> & Partial<Pick<DesktopNotification, "appName" | "urgency" | "category" | "transient" | "workspaceId">>) => void;
  dismissNotification: (id: number) => void;
  hideNotification: (id: number) => void;
  clearHistory: () => void;
  markAllRead: () => void;
  toggleCenter: () => void;
  closeCenter: () => void;

  addTrayIcon: (icon: TrayIcon) => void;
  removeTrayIcon: (wid: number) => void;
  updateTrayIcon: (wid: number, updates: Partial<TrayIcon>) => void;
}

const MAX_VISIBLE = 5;
const MAX_HISTORY = 50;

const PREFS_KEY = "sandcastle_notification_prefs";

function loadPrefs(): {
  doNotDisturb: boolean;
  desktopNotifMode: DesktopNotifMode;
} {
  if (typeof window === "undefined")
    return { doNotDisturb: false, desktopNotifMode: "background" };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { doNotDisturb: false, desktopNotifMode: "background" };
}

function savePrefs(prefs: {
  doNotDisturb: boolean;
  desktopNotifMode: DesktopNotifMode;
}) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

function getBrowserPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window))
    return "denied";
  return Notification.permission;
}

function sendBrowserNotification(notif: DesktopNotification) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return;

  const n = new Notification(notif.summary, {
    body: notif.body || undefined,
    icon: notif.icon || undefined,
    tag: String(notif.id),
    silent: notif.urgency === "low",
  });

  n.onclick = () => {
    window.focus();
    if (notif.workspaceId) {
      // Lazy import to avoid circular dependency
      import("@/stores/workspace-store").then(({ useWorkspaceStore }) => {
        useWorkspaceStore.getState().setActiveWorkspace(notif.workspaceId!);
      });
    }
    n.close();
  };

  if (notif.expires > 0) {
    setTimeout(() => n.close(), notif.expires);
  } else if (notif.urgency !== "critical") {
    setTimeout(() => n.close(), 6000);
  }
}

const initialPrefs = loadPrefs();

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  notifications: [],
  history: [],
  trayIcons: new Map(),
  centerOpen: false,
  unreadCount: 0,

  doNotDisturb: initialPrefs.doNotDisturb,
  desktopNotifMode: initialPrefs.desktopNotifMode,
  browserPermission: getBrowserPermission(),

  setDoNotDisturb: (value) => {
    set({ doNotDisturb: value });
    savePrefs({ doNotDisturb: value, desktopNotifMode: get().desktopNotifMode });
  },

  setDesktopNotifMode: (mode) => {
    set({ desktopNotifMode: mode });
    savePrefs({ doNotDisturb: get().doNotDisturb, desktopNotifMode: mode });
  },

  requestBrowserPermission: async () => {
    if (typeof window === "undefined" || !("Notification" in window))
      return "denied";
    const result = await Notification.requestPermission();
    set({ browserPermission: result });
    return result;
  },

  syncBrowserPermission: () => {
    set({ browserPermission: getBrowserPermission() });
  },

  addNotification: (notification) => {
    const full: DesktopNotification = {
      ...notification,
      appName: notification.appName ?? "",
      urgency: notification.urgency ?? "normal",
      category: notification.category ?? null,
      transient: notification.transient ?? false,
      workspaceId: notification.workspaceId ?? null,
      timestamp: Date.now(),
      read: false,
    };

    const { doNotDisturb, desktopNotifMode, browserPermission } = get();

    // Always add to history regardless of DND
    set((state) => {
      const history = full.transient
        ? state.history
        : [full, ...state.history].slice(0, MAX_HISTORY);

      // In DND mode, skip visible toasts (still record in history)
      if (doNotDisturb && full.urgency !== "critical") {
        return {
          history,
          unreadCount: full.transient ? state.unreadCount : state.unreadCount + 1,
        };
      }

      let notifications = [...state.notifications];

      if (notification.replacesId) {
        notifications = notifications.filter((n) => n.id !== notification.replacesId);
      }

      notifications = [full, ...notifications].slice(0, MAX_VISIBLE);

      return {
        notifications,
        history,
        unreadCount: full.transient ? state.unreadCount : state.unreadCount + 1,
      };
    });

    // Bridge to browser desktop notifications
    if (
      browserPermission === "granted" &&
      desktopNotifMode !== "off" &&
      !full.transient
    ) {
      const shouldSend =
        desktopNotifMode === "always" ||
        (desktopNotifMode === "background" && document.hidden);
      if (shouldSend) {
        sendBrowserNotification(full);
      }
    }

    const isCritical = full.urgency === "critical";
    if (full.expires > 0) {
      setTimeout(() => {
        get().hideNotification(full.id);
      }, full.expires);
    } else if (!isCritical) {
      setTimeout(() => {
        get().hideNotification(full.id);
      }, 6000);
    }
  },

  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  hideNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearHistory: () => {
    set({ history: [], unreadCount: 0 });
  },

  markAllRead: () => {
    set((state) => ({
      history: state.history.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  toggleCenter: () => {
    const opening = !get().centerOpen;
    set({ centerOpen: opening });
    if (opening) {
      get().markAllRead();
    }
  },

  closeCenter: () => {
    set({ centerOpen: false });
  },

  addTrayIcon: (icon) => {
    set((state) => {
      const next = new Map(state.trayIcons);
      next.set(icon.wid, icon);
      return { trayIcons: next };
    });
  },

  removeTrayIcon: (wid) => {
    set((state) => {
      const next = new Map(state.trayIcons);
      next.delete(wid);
      return { trayIcons: next };
    });
  },

  updateTrayIcon: (wid, updates) => {
    set((state) => {
      const next = new Map(state.trayIcons);
      const existing = next.get(wid);
      if (existing) {
        next.set(wid, { ...existing, ...updates });
      }
      return { trayIcons: next };
    });
  },
}));
