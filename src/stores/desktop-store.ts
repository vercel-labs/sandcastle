import { create } from "zustand";
import type { DesktopEntry } from "@/types/desktop-entry";
import { sandboxServiceFetcher } from "@/lib/hooks/use-sandbox-service-client";

/**
 * Map of app name patterns (lowercase) to Dusk icon SVG filenames.
 * Used to override Linux icon theme icons with consistent Dusk icons
 * for well-known applications installed via X11/sandbox.
 * Icons from https://github.com/pacocoursey/Dusk
 */
const DUSK_ICON_MAP: Record<string, string> = {
  // Browsers
  firefox: "firefox",
  "google chrome": "chrome",
  chrome: "chrome",
  chromium: "chrome",
  brave: "brave",
  "brave browser": "brave",
  safari: "safari",
  vivaldi: "vivaldi",
  // Communication
  discord: "discord",
  slack: "slack",
  telegram: "telegram",
  "telegram desktop": "telegram",
  whatsapp: "whatsapp",
  skype: "skype",
  zoom: "zoom",
  "microsoft teams": "teams",
  teams: "teams",
  "facebook messenger": "messenger",
  messenger: "messenger",
  // Media
  spotify: "spotify",
  vlc: "vlc",
  "vlc media player": "vlc",
  obs: "obs",
  "obs studio": "obs",
  itunes: "itunes",
  // Dev tools
  "visual studio code": "vscode",
  "code - oss": "vscode",
  intellij: "intellij",
  "intellij idea": "intellij",
  atom: "atom",
  iterm2: "iterm2",
  iterm: "iterm2",
  hyper: "hyper",
  "github desktop": "github_desktop",
  postman: "postman",
  "mongodb compass": "mongodb",
  "sequel pro": "sequel_pro",
  tableplus: "tableplus",
  // Graphics / Design
  gimp: "gimp",
  "gnu image manipulation program": "gimp",
  figma: "figma",
  sketch: "sketch",
  framer: "framer",
  // Productivity
  notion: "notion",
  todoist: "todoist",
  trello: "trello",
  notes: "notes",
  reminders: "reminders",
  calendar: "calendar",
  mail: "mail",
  // Gaming
  steam: "steam",
  // System / Utilities
  "system monitor": "activity_monitor",
  "text editor": "pages",
  "image viewer": "preview",
  "document viewer": "notes",
  // X11 utilities
  xeyes: "xeyes",
  // Other
  calculator: "calculator",
  photos: "photos",
  dropbox: "dropbox",
  electron: "electron",
};

function getDuskIcon(appName: string): string | null {
  const key = appName.toLowerCase();
  const match = DUSK_ICON_MAP[key];
  if (match) return `/icons/dusk/${match}.svg`;
  return null;
}

const BUILTIN_APPS: DesktopEntry[] = [
  {
    id: "terminal",
    name: "Terminal",
    icon: "/icons/dusk/terminal.svg",
    exec: null,
    type: "builtin",
    component: "terminal",
    categories: ["System"],
    comment: "Terminal emulator",
    onDesktop: true,
  },
  {
    id: "file-manager",
    name: "Files",
    icon: "/icons/dusk/finder2.svg",
    exec: null,
    type: "builtin",
    component: "file-manager",
    categories: ["System"],
    comment: "File manager",
    onDesktop: true,
  },
  {
    id: "code-server",
    name: "Code",
    icon: "/icons/dusk/vscode.svg",
    exec: null,
    type: "builtin",
    component: "code-server",
    categories: ["Development"],
    comment: "VS Code in the browser",
    onDesktop: true,
  },
  {
    id: "settings",
    name: "Settings",
    icon: "/icons/dusk/system_preferences.svg",
    exec: null,
    type: "builtin",
    component: "settings",
    categories: ["System"],
    comment: "Desktop settings",
    onDesktop: true,
  },
  {
    id: "app-store",
    name: "App Store",
    icon: "/icons/dusk/app_store.svg",
    exec: null,
    type: "builtin",
    component: "app-store",
    categories: ["System"],
    comment: "Browse and install apps",
    onDesktop: true,
  },
];

interface DesktopStore {
  /** All apps: builtins + remote (full catalog, used by the app menu) */
  apps: DesktopEntry[];
  /** Desktop surface icons: builtins + ~/Desktop shortcuts */
  desktopIcons: DesktopEntry[];
  wallpaper: string;

  setApps: (apps: DesktopEntry[]) => void;
  setWallpaper: (url: string) => void;
  fetchRemoteApps: (apiDomain: string) => Promise<void>;
}

export const useDesktopStore = create<DesktopStore>((set) => ({
  apps: BUILTIN_APPS,
  desktopIcons: BUILTIN_APPS,
  wallpaper: "/wallpapers/default.svg",

  setApps: (apps) => set({ apps }),

  setWallpaper: (url) => set({ wallpaper: url }),

  fetchRemoteApps: async (apiDomain) => {
    try {
      const data = await sandboxServiceFetcher<{
        entries?: DesktopEntry[];
        desktopShortcuts?: DesktopEntry[];
        apps?: DesktopEntry[];
      }>(`https://${apiDomain}/desktop-entries`);

      // Dedup: remote entries whose name matches a builtin are suppressed.
      // Builtins always win (they have proper React components).
      const builtinNames = new Set(
        BUILTIN_APPS.map((a) => a.name.toLowerCase()),
      );

      const normalize = (entry: DesktopEntry) => {
        const duskIcon = getDuskIcon(entry.name);
        return {
          ...entry,
          component: entry.component ?? null,
          categories: entry.categories ?? [],
          icon: duskIcon
            ? duskIcon
            : entry.icon?.startsWith("/icon?")
              ? `https://${apiDomain}${entry.icon}`
              : entry.icon || "/icons/default.svg",
        };
      };

      // The agent returns { desktopShortcuts, apps, entries }
      const allRemote: DesktopEntry[] = (data.entries ?? [])
        .map(normalize)
        .filter((e: DesktopEntry) => !builtinNames.has(e.name.toLowerCase()));

      const remoteDesktop: DesktopEntry[] = (data.desktopShortcuts ?? [])
        .map((e: DesktopEntry) => ({ ...normalize(e), onDesktop: true }))
        .filter((e: DesktopEntry) => !builtinNames.has(e.name.toLowerCase()));

      set({
        apps: [...BUILTIN_APPS, ...allRemote],
        desktopIcons: [...BUILTIN_APPS, ...remoteDesktop],
      });
    } catch (err) {
      console.error("Failed to fetch remote apps:", err);
    }
  },
}));
