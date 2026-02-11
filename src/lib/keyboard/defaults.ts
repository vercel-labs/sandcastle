import type { ShortcutDefinition } from "./types";

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // ── Window Management ──────────────────────────────────────────────
  {
    id: "window.cycle-next",
    label: "Switch Window",
    description: "Cycle to next window (Alt-Tab)",
    category: "window",
    defaultBinding: { key: "Tab", modifiers: ["alt"] },
    repeat: true,
  },
  {
    id: "window.cycle-prev",
    label: "Switch Window (Reverse)",
    description: "Cycle to previous window",
    category: "window",
    defaultBinding: { key: "Tab", modifiers: ["alt", "shift"] },
    repeat: true,
  },
  {
    id: "window.close",
    label: "Close Window",
    description: "Close the focused window",
    category: "window",
    defaultBinding: { key: "w", modifiers: ["alt"] },
  },
  {
    id: "window.minimize",
    label: "Minimize Window",
    description: "Minimize the focused window",
    category: "window",
    defaultBinding: { key: "h", modifiers: ["meta"] },
  },
  {
    id: "window.maximize",
    label: "Maximize / Restore Window",
    description: "Toggle maximize on the focused window",
    category: "window",
    defaultBinding: { key: "ArrowUp", modifiers: ["meta"] },
  },
  {
    id: "window.snap-left",
    label: "Tile Window Left",
    description: "Snap the focused window to the left half",
    category: "window",
    defaultBinding: { key: "ArrowLeft", modifiers: ["meta"] },
  },
  {
    id: "window.snap-right",
    label: "Tile Window Right",
    description: "Snap the focused window to the right half",
    category: "window",
    defaultBinding: { key: "ArrowRight", modifiers: ["meta"] },
  },

  // ── Workspace ──────────────────────────────────────────────────────
  {
    id: "workspace.1",
    label: "Workspace 1",
    description: "Switch to workspace 1",
    category: "workspace",
    defaultBinding: { key: "1", modifiers: ["ctrl"] },
  },
  {
    id: "workspace.2",
    label: "Workspace 2",
    description: "Switch to workspace 2",
    category: "workspace",
    defaultBinding: { key: "2", modifiers: ["ctrl"] },
  },
  {
    id: "workspace.3",
    label: "Workspace 3",
    description: "Switch to workspace 3",
    category: "workspace",
    defaultBinding: { key: "3", modifiers: ["ctrl"] },
  },
  {
    id: "workspace.4",
    label: "Workspace 4",
    description: "Switch to workspace 4",
    category: "workspace",
    defaultBinding: { key: "4", modifiers: ["ctrl"] },
  },
  {
    id: "workspace.5",
    label: "Workspace 5",
    description: "Switch to workspace 5",
    category: "workspace",
    defaultBinding: { key: "5", modifiers: ["ctrl"] },
  },
  {
    id: "workspace.6",
    label: "Workspace 6",
    description: "Switch to workspace 6",
    category: "workspace",
    defaultBinding: { key: "6", modifiers: ["ctrl"] },
  },
  {
    id: "workspace.7",
    label: "Workspace 7",
    description: "Switch to workspace 7",
    category: "workspace",
    defaultBinding: { key: "7", modifiers: ["ctrl"] },
  },
  {
    id: "workspace.8",
    label: "Workspace 8",
    description: "Switch to workspace 8",
    category: "workspace",
    defaultBinding: { key: "8", modifiers: ["ctrl"] },
  },
  {
    id: "workspace.9",
    label: "Workspace 9",
    description: "Switch to workspace 9",
    category: "workspace",
    defaultBinding: { key: "9", modifiers: ["ctrl"] },
  },

  // ── Launcher ───────────────────────────────────────────────────────
  {
    id: "launcher.open",
    label: "App Launcher",
    description: "Open the application launcher",
    category: "launcher",
    defaultBinding: { key: "k", modifiers: ["meta"] },
  },
  {
    id: "launcher.terminal",
    label: "Open Terminal",
    description: "Open a new terminal window",
    category: "launcher",
    defaultBinding: { key: "t", modifiers: ["ctrl", "alt"] },
  },
  {
    id: "launcher.file-manager",
    label: "Open File Manager",
    description: "Open the file manager",
    category: "launcher",
    defaultBinding: { key: "e", modifiers: ["meta"] },
  },
  {
    id: "launcher.settings",
    label: "Open Settings",
    description: "Open the settings panel",
    category: "launcher",
    defaultBinding: { key: ",", modifiers: ["meta"] },
  },

  // ── System ─────────────────────────────────────────────────────────
  {
    id: "system.notification-center",
    label: "Notification Center",
    description: "Toggle the notification center",
    category: "system",
    defaultBinding: { key: "n", modifiers: ["meta"] },
  },
];
