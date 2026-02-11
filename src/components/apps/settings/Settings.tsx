"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { logoutMutate, useUser } from "@/stores/auth-store";
import {
  WORKSPACE_ICON_NAMES,
  SHADER_BACKGROUNDS,
  SOLID_BACKGROUNDS,
} from "@/types/workspace";
import type { BackgroundConfig } from "@/types/workspace";
import { WorkspaceIcon } from "@/components/workspace-icon";
import { ShaderCanvas } from "@/components/desktop/ShaderCanvas";
import { SplitPane, SidebarNav, PropertyPanel, EmptyState, StatusBar, SectionHeader, StatusBadge } from "@/components/os-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Note } from "@/components/ui/note";
import { Tooltip } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useTheme } from "next-themes";
import { useNotificationStore } from "@/stores/notification-store";
import type { DesktopNotifMode } from "@/stores/notification-store";
import { Toggle } from "@/components/ui/switch";
import {
  Monitor,
  Layers,
  User,
  LogOut,
  Bell,
  Info,
  Command,
} from "lucide-react";
import { useKeybindStore } from "@/stores/keybind-store";
import type { ShortcutCategory, KeyCombo, ModifierKey } from "@/lib/keyboard/types";
import { comboToSymbols } from "@/lib/keyboard/types";

type SettingsTab = "appearance" | "workspaces" | "notifications" | "keyboard" | "account" | "about";

const NAV_ITEMS: Array<{ id: SettingsTab; label: string; icon: React.ComponentType }> = [
  { id: "appearance", label: "Appearance", icon: Monitor },
  { id: "workspaces", label: "Workspaces", icon: Layers },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "keyboard", label: "Keyboard Shortcuts", icon: Command },
  { id: "account", label: "Account", icon: User },
  { id: "about", label: "About", icon: Info },
];

function parseBackground(raw: string | null): BackgroundConfig {
  if (!raw) return { type: "solid", value: "#000000" };
  try {
    return JSON.parse(raw) as BackgroundConfig;
  } catch {
    return { type: "solid", value: "#000000" };
  }
}

export function Settings() {
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId),
  );

  return (
    <div className="flex h-full flex-col bg-background-100">
      <div className="flex-1 overflow-hidden">
        <SplitPane defaultSize={160} min={130} max={220} collapseBelow={400}>
          <SplitPane.Panel className="bg-gray-alpha-50">
            <SidebarNav label="Settings" title="Settings">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarNav.Item
                    key={item.id}
                    active={tab === item.id}
                    onClick={() => setTab(item.id)}
                    icon={<Icon />}
                  >
                    {item.label}
                  </SidebarNav.Item>
                );
              })}
            </SidebarNav>
          </SplitPane.Panel>
          <SplitPane.Panel className="overflow-auto p-6">
            {tab === "appearance" && <AppearanceTab />}
            {tab === "workspaces" && <WorkspacesTab />}
            {tab === "notifications" && <NotificationsTab />}
            {tab === "keyboard" && <KeyboardShortcutsTab />}
            {tab === "account" && <AccountTab />}
            {tab === "about" && <AboutTab />}
          </SplitPane.Panel>
        </SplitPane>
      </div>
      <StatusBar>
        <StatusBar.Item>
          {activeWorkspace ? activeWorkspace.name : "No workspace"}
        </StatusBar.Item>
        <StatusBar.Spacer />
        {activeWorkspace && (
          <StatusBar.Item
            variant={activeWorkspace.status === "active" ? "success" : "default"}
          >
            {activeWorkspace.status}
          </StatusBar.Item>
        )}
      </StatusBar>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Appearance Tab
// ---------------------------------------------------------------------------

function BackgroundPreview({
  config,
  selected,
  onClick,
  label,
  light,
}: {
  config: BackgroundConfig;
  selected: boolean;
  onClick: () => void;
  label: string;
  light: boolean;
}) {
  return (
    <Tooltip text={label} position="top" desktopOnly>
      <button
        className={`relative h-20 w-32 overflow-hidden rounded-lg border-2 transition-all ${
          selected
            ? "border-blue-600 ring-2 ring-blue-600/30"
            : "border-gray-alpha-300 hover:border-gray-alpha-400"
        }`}
        onClick={onClick}
      >
        {config.type === "shader" ? (
          <ShaderCanvas shaderId={config.value} light={light} />
        ) : (
          <div className="h-full w-full" style={{ backgroundColor: config.value }} />
        )}
        {selected && (
          <div className="absolute bottom-1 right-1">
            <Badge variant="blue" size="sm">Active</Badge>
          </div>
        )}
      </button>
    </Tooltip>
  );
}

function AppearanceTab() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId),
  );
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === "light";

  const currentBg = parseBackground(workspace?.background ?? null);

  const setBackground = useCallback(
    (config: BackgroundConfig) => {
      if (!activeWorkspaceId) return;
      updateWorkspace(activeWorkspaceId, {
        background: JSON.stringify(config),
      });
    },
    [activeWorkspaceId, updateWorkspace],
  );

  if (!workspace) {
    return (
      <EmptyState
        icon={<Monitor />}
        title="No active workspace"
        description="Create or start a workspace to configure its appearance."
      />
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8 text-gray-1000">
      <section>
        <SectionHeader
          title="Theme"
          description="Choose light, dark, or system. X11 apps adapt automatically."
        />
        <ThemeSwitcher />
      </section>

      <Separator />

      <section>
        <SectionHeader
          title="Desktop Background"
          description={`Background for \u201c${workspace.name}\u201d. Each workspace has its own.`}
        />
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-copy-13 text-gray-900">Shader</p>
            <div className="flex flex-wrap gap-3">
              {SHADER_BACKGROUNDS.map((shader) => (
                <BackgroundPreview
                  key={shader.id}
                  config={{ type: "shader", value: shader.id }}
                  selected={currentBg.type === "shader" && currentBg.value === shader.id}
                  onClick={() => setBackground({ type: "shader", value: shader.id })}
                  label={shader.name}
                  light={isLight}
                />
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <p className="mb-2 text-copy-13 text-gray-900">Solid</p>
            <div className="flex flex-wrap gap-3">
              {SOLID_BACKGROUNDS.map((bg) => (
                <BackgroundPreview
                  key={bg.id}
                  config={{ type: "solid", value: isLight ? bg.lightColor : bg.color }}
                  selected={currentBg.type === "solid" && currentBg.value === bg.color}
                  onClick={() => setBackground({ type: "solid", value: bg.color })}
                  label={bg.name}
                  light={isLight}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications Tab
// ---------------------------------------------------------------------------

const NOTIF_MODE_OPTIONS: Array<{
  value: DesktopNotifMode;
  label: string;
  description: string;
}> = [
  {
    value: "background",
    label: "When in background",
    description: "Only show when the tab is not visible",
  },
  {
    value: "always",
    label: "Always",
    description: "Show for every notification",
  },
  {
    value: "off",
    label: "Off",
    description: "Never send browser notifications",
  },
];

function NotificationsTab() {
  const doNotDisturb = useNotificationStore((s) => s.doNotDisturb);
  const setDoNotDisturb = useNotificationStore((s) => s.setDoNotDisturb);
  const desktopNotifMode = useNotificationStore((s) => s.desktopNotifMode);
  const setDesktopNotifMode = useNotificationStore(
    (s) => s.setDesktopNotifMode,
  );
  const browserPermission = useNotificationStore((s) => s.browserPermission);
  const requestBrowserPermission = useNotificationStore(
    (s) => s.requestBrowserPermission,
  );
  const syncBrowserPermission = useNotificationStore(
    (s) => s.syncBrowserPermission,
  );
  const history = useNotificationStore((s) => s.history);
  const clearHistory = useNotificationStore((s) => s.clearHistory);

  useEffect(() => {
    syncBrowserPermission();
  }, [syncBrowserPermission]);

  const needsPermission =
    browserPermission !== "granted" && desktopNotifMode !== "off";

  return (
    <div className="flex max-w-2xl flex-col gap-8 text-gray-1000">
      {/* Do Not Disturb */}
      <section>
        <SectionHeader
          title="Do Not Disturb"
          description="Suppress in-app toast notifications. Critical alerts and notification history are unaffected."
        />
        <div className="flex items-center justify-between rounded-lg border border-gray-alpha-200 bg-background-100 px-4 py-3">
          <div>
            <p className="text-copy-13 font-medium text-gray-1000">
              Do Not Disturb
            </p>
            <p className="text-copy-12 text-gray-800">
              {doNotDisturb
                ? "Toasts are hidden"
                : "Toasts are shown normally"}
            </p>
          </div>
          <Toggle
            checked={doNotDisturb}
            onChange={() => setDoNotDisturb(!doNotDisturb)}
          />
        </div>
      </section>

      <Separator />

      {/* Desktop Notifications */}
      <section>
        <SectionHeader
          title="Desktop Notifications"
          description="Bridge notifications to your operating system via the browser Notification API."
        />
        <div className="flex flex-col gap-3">
          {NOTIF_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDesktopNotifMode(opt.value)}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                desktopNotifMode === opt.value
                  ? "border-blue-400 bg-blue-100"
                  : "border-gray-alpha-200 bg-background-100 hover:border-gray-alpha-300"
              }`}
            >
              <div
                className={`h-3 w-3 shrink-0 rounded-full border-2 ${
                  desktopNotifMode === opt.value
                    ? "border-blue-600 bg-blue-600"
                    : "border-gray-alpha-400"
                }`}
              />
              <div>
                <p className="text-copy-13 font-medium text-gray-1000">
                  {opt.label}
                </p>
                <p className="text-copy-12 text-gray-800">{opt.description}</p>
              </div>
            </button>
          ))}

          {needsPermission && (
            <Note type="warning" size="small">
              <div className="flex items-center justify-between gap-4">
                <span>
                  {browserPermission === "denied"
                    ? "Browser notifications are blocked. Update your browser site settings to allow them."
                    : "Browser permission is required for desktop notifications."}
                </span>
                {browserPermission !== "denied" && (
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => requestBrowserPermission()}
                  >
                    Allow
                  </Button>
                )}
              </div>
            </Note>
          )}

          {browserPermission === "granted" && desktopNotifMode !== "off" && (
            <Note type="success" size="small">
              Browser notifications are enabled.
            </Note>
          )}
        </div>
      </section>

      <Separator />

      {/* History */}
      <section>
        <SectionHeader
          title="Notification History"
          description={`${history.length} notification${history.length !== 1 ? "s" : ""} in history.`}
        >
          {history.length > 0 && (
            <Button size="small" variant="secondary" onClick={clearHistory}>
              Clear History
            </Button>
          )}
        </SectionHeader>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// About Tab
// ---------------------------------------------------------------------------

function AboutTab() {
  return (
    <div className="flex max-w-2xl flex-col gap-8 text-gray-1000">
      <section>
        <SectionHeader title="Sandcastle" description="A desktop environment in your browser." />
        <PropertyPanel className="rounded-lg border border-gray-alpha-200">
          <PropertyPanel.Section>
            <PropertyPanel.Row label="Version">
              {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev"}
            </PropertyPanel.Row>
            <PropertyPanel.Row label="Framework">
              Next.js
            </PropertyPanel.Row>
            <PropertyPanel.Row label="Runtime">
              {typeof navigator !== "undefined" ? navigator.userAgent.split(" ").pop() : "—"}
            </PropertyPanel.Row>
          </PropertyPanel.Section>
        </PropertyPanel>
      </section>

      <Separator />

      <section>
        <SectionHeader
          title="Environment"
          description="Runtime information from your browser."
        />
        <PropertyPanel className="rounded-lg border border-gray-alpha-200">
          <PropertyPanel.Section>
            <PropertyPanel.Row label="Platform">
              {typeof navigator !== "undefined" ? navigator.platform : "—"}
            </PropertyPanel.Row>
            <PropertyPanel.Row label="Language">
              {typeof navigator !== "undefined" ? navigator.language : "—"}
            </PropertyPanel.Row>
            <PropertyPanel.Row label="Cores">
              {typeof navigator !== "undefined" ? navigator.hardwareConcurrency : "—"}
            </PropertyPanel.Row>
            <PropertyPanel.Row label="Screen">
              {typeof screen !== "undefined"
                ? `${screen.width}x${screen.height} @${devicePixelRatio}x`
                : "—"}
            </PropertyPanel.Row>
          </PropertyPanel.Section>
        </PropertyPanel>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Tab
// ---------------------------------------------------------------------------

function VercelLogo() {
  return (
    <svg
      aria-label="Vercel Logo"
      fill="currentColor"
      viewBox="0 0 75 65"
      height="14"
      width="14"
    >
      <path d="M37.59.25l36.95 64H.64l36.95-64z" />
    </svg>
  );
}

function AccountTab() {
  const { user } = useUser();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className="flex max-w-2xl flex-col gap-8 text-gray-1000">
      {/* Profile */}
      <section>
        <SectionHeader
          title="Profile"
          description="Your account information."
        />
        <PropertyPanel className="rounded-lg border border-gray-alpha-200">
          <PropertyPanel.Section>
            <PropertyPanel.Row label="Email">
              {user?.email ?? "—"}
            </PropertyPanel.Row>
            <PropertyPanel.Row label="Name">
              {user?.name ?? "—"}
            </PropertyPanel.Row>
            <PropertyPanel.Row label="User ID" mono>
              {user?.id ?? "—"}
            </PropertyPanel.Row>
          </PropertyPanel.Section>
        </PropertyPanel>
      </section>

      <Separator />

      {/* Connected Accounts */}
      <section>
        <SectionHeader
          title="Connected Accounts"
          description="Manage linked authentication providers."
        />
        <div className="rounded-lg border border-gray-alpha-200 bg-background-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-1000 text-gray-100">
                <VercelLogo />
              </div>
              <div>
                <p className="text-copy-13 font-medium text-gray-1000">
                  Vercel
                </p>
                {user?.vercelConnected && user.vercelAccount ? (
                  <p className="text-copy-12 text-gray-800">
                    Connected{" "}
                    {new Date(
                      user.vercelAccount.connectedAt,
                    ).toLocaleDateString()}
                  </p>
                ) : (
                  <p className="text-copy-12 text-gray-800">Not connected</p>
                )}
              </div>
            </div>
            {user?.vercelConnected ? (
              <Badge variant="green" size="sm">
                Connected
              </Badge>
            ) : (
              <Button
                size="small"
                variant="secondary"
                onClick={() => {
                  window.location.href = "/api/auth/vercel";
                }}
              >
                Connect
              </Button>
            )}
          </div>
        </div>
      </section>

      <Separator />

      {/* Session */}
      <section>
        <SectionHeader
          title="Session"
          description="Sign out of your current session."
        />
        <Button
          size="small"
          variant="secondary"
          loading={signingOut}
          prefix={<LogOut />}
          onClick={async () => {
            setSigningOut(true);
            await logoutMutate();
            window.location.reload();
          }}
        >
          Sign Out
        </Button>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspaces Tab
// ---------------------------------------------------------------------------

function WorkspaceNameEditor({
  workspaceId,
  currentName,
}: {
  workspaceId: string;
  currentName: string;
}) {
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setName(currentName); }, [currentName]);

  const save = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== currentName) {
      updateWorkspace(workspaceId, { name: trimmed });
    } else {
      setName(currentName);
    }
    setEditing(false);
  }, [name, currentName, workspaceId, updateWorkspace]);

  if (!editing) {
    return (
      <span
        role="button"
        tabIndex={0}
        className="cursor-pointer text-left text-copy-13 text-gray-1000 hover:underline"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setEditing(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        }}
      >
        {currentName}
      </span>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Input
        ref={inputRef}
        aria-label="Workspace name"
        size="small"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") { setName(currentName); setEditing(false); }
        }}
        autoFocus
      />
    </div>
  );
}

function WorkspacesTab() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const sandboxes = useWorkspaceStore((s) => s.sandboxes);
  const stopWorkspace = useWorkspaceStore((s) => s.stopWorkspace);
  const killWorkspace = useWorkspaceStore((s) => s.killWorkspace);
  const killAllWorkspaces = useWorkspaceStore((s) => s.killAllWorkspaces);
  const restartWorkspace = useWorkspaceStore((s) => s.restartWorkspace);
  const snapshotWorkspace = useWorkspaceStore((s) => s.snapshotWorkspace);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const [busy, setBusy] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeSandbox = activeWorkspaceId ? sandboxes[activeWorkspaceId] : null;

  const wrap = (id: string, fn: () => Promise<unknown>) => async () => {
    setBusy(id);
    try { await fn(); } catch (err) { console.error(err); } finally { setBusy(null); }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-8 text-gray-1000">
      {/* Active workspace */}
      <section>
        <SectionHeader title="Active Workspace" description="Manage your currently selected workspace" />
        <div className="rounded-lg border border-gray-alpha-200 bg-background-100">
          {activeWorkspace ? (
            <div className="p-4">
              <div className="mb-4 flex items-center gap-3">
                <Tooltip text="Change icon" desktopOnly>
                  <button
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-1000 transition-colors hover:bg-gray-alpha-200"
                    onClick={() => setShowIconPicker(!showIconPicker)}
                  >
                    <WorkspaceIcon name={activeWorkspace.icon} size={20} />
                  </button>
                </Tooltip>
                <div className="flex-1">
                  <WorkspaceNameEditor workspaceId={activeWorkspace.id} currentName={activeWorkspace.name} />
                  <div className="mt-1"><StatusBadge status={activeWorkspace.status} /></div>
                </div>
              </div>

              {showIconPicker && (
                <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-gray-alpha-100 p-2">
                  {WORKSPACE_ICON_NAMES.map((iconName) => (
                    <button
                      key={iconName}
                      className={`flex h-8 w-8 items-center justify-center rounded text-gray-900 transition-colors hover:bg-gray-alpha-300 hover:text-gray-1000 ${
                        activeWorkspace.icon === iconName ? "bg-gray-alpha-300 text-gray-1000 ring-1 ring-gray-alpha-400" : ""
                      }`}
                      onClick={() => { updateWorkspace(activeWorkspace.id, { icon: iconName }); setShowIconPicker(false); }}
                      title={iconName}
                    >
                      <WorkspaceIcon name={iconName} size={16} />
                    </button>
                  ))}
                </div>
              )}

              {activeSandbox && (
                <PropertyPanel className="mb-4 rounded-lg border border-gray-alpha-200">
                  <PropertyPanel.Section>
                    <PropertyPanel.Row label="Sandbox ID" mono>{activeSandbox.sandboxId}</PropertyPanel.Row>
                    <PropertyPanel.Row label="Timeout" value={`${Math.round(activeSandbox.timeout / 60000)} min`} />
                  </PropertyPanel.Section>
                </PropertyPanel>
              )}

              <div className="flex flex-wrap gap-2">
                {activeWorkspace.status === "active" && (
                  <>
                    <Button size="small" variant="warning" onClick={wrap("restart", () => restartWorkspace(activeWorkspace.id))} disabled={busy !== null} loading={busy === "restart"}>Restart</Button>
                    <Button size="small" variant="secondary" onClick={wrap("snapshot", () => snapshotWorkspace(activeWorkspace.id))} disabled={busy !== null} loading={busy === "snapshot"}>Snapshot</Button>
                    <Button size="small" variant="tertiary" onClick={wrap("stop", () => stopWorkspace(activeWorkspace.id))} disabled={busy !== null} loading={busy === "stop"}>Stop</Button>
                    <Button size="small" variant="error" onClick={wrap("kill", () => killWorkspace(activeWorkspace.id))} disabled={busy !== null} loading={busy === "kill"}>Kill</Button>
                  </>
                )}
                {(activeWorkspace.status === "stopped" || activeWorkspace.status === "snapshotted") && (
                  <Button size="small" onClick={wrap("restart", () => restartWorkspace(activeWorkspace.id))} disabled={busy !== null} loading={busy === "restart"}>Start</Button>
                )}
              </div>
            </div>
          ) : (
            <EmptyState title="No active workspace" description="Create or select a workspace." compact className="py-8" />
          )}
        </div>
      </section>

      {/* All workspaces */}
      <section>
        <SectionHeader title="All Workspaces">
          <Button size="small" onClick={wrap("new", () => createWorkspace())} disabled={busy !== null} loading={busy === "new"}>
            New Workspace
          </Button>
        </SectionHeader>
        <div className="space-y-2">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                ws.id === activeWorkspaceId ? "border-blue-400 bg-blue-100" : "border-gray-alpha-200 bg-background-100"
              }`}
            >
              <div className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left" onClick={() => setActiveWorkspace(ws.id)}>
                <span className="text-gray-900"><WorkspaceIcon name={ws.icon || "terminal"} size={16} /></span>
                <StatusBadge status={ws.status} />
                <div className="min-w-0 flex-1"><WorkspaceNameEditor workspaceId={ws.id} currentName={ws.name} /></div>
              </div>
              <div className="ml-2 flex shrink-0 gap-1">
                {ws.status === "active" && ws.id !== activeWorkspaceId && (
                  <Button size="small" variant="secondary" onClick={() => setActiveWorkspace(ws.id)}>Switch</Button>
                )}
                {ws.status === "active" && (
                  <Button size="small" variant="error" onClick={wrap(`kill-${ws.id}`, () => killWorkspace(ws.id))} disabled={busy !== null} loading={busy === `kill-${ws.id}`}>Kill</Button>
                )}
                {(ws.status === "stopped" || ws.status === "snapshotted") && (
                  <Button size="small" onClick={wrap(`restart-${ws.id}`, () => restartWorkspace(ws.id))} disabled={busy !== null} loading={busy === `restart-${ws.id}`}>Start</Button>
                )}
              </div>
            </div>
          ))}
          {workspaces.length === 0 && (
            <EmptyState title="No workspaces yet" description="Create your first workspace to get started." compact />
          )}
        </div>
      </section>

      {/* Danger zone */}
      {workspaces.length > 0 && (
        <section>
          <SectionHeader title="Danger Zone" />
          <Note type="error" label={false}>
            <div className="flex items-center justify-between gap-6">
              <div className="min-w-0">
                <p className="text-copy-13 font-medium text-gray-1000">Delete all workspaces</p>
                <p className="text-copy-13 text-gray-900">
                  Permanently stop and remove all {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}. This cannot be undone.
                </p>
              </div>
              <Button
                size="small"
                variant="error"
                onClick={wrap("kill-all", async () => {
                  if (globalThis.confirm(`Delete all ${workspaces.length} workspaces? This cannot be undone.`)) {
                    await killAllWorkspaces();
                  }
                })}
                disabled={busy !== null}
                loading={busy === "kill-all"}
              >
                Delete All
              </Button>
            </div>
           </Note>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keyboard Shortcuts Tab
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  window: "Window Management",
  workspace: "Workspaces",
  launcher: "App Launcher",
  system: "System",
};

const CATEGORY_ORDER: ShortcutCategory[] = ["window", "workspace", "launcher", "system"];

function ShortcutRecorder({
  value,
  onChange,
  onReset,
  isDefault,
}: {
  value: KeyCombo | null;
  onChange: (combo: KeyCombo) => void;
  onReset: () => void;
  isDefault: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const setSuspended = useKeybindStore((s) => s.setSuspended);

  useEffect(() => {
    if (!recording) {
      setSuspended(false);
      return;
    }
    setSuspended(true);

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(false);
        return;
      }

      if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) return;

      const modifiers: ModifierKey[] = [];
      if (e.metaKey) modifiers.push("meta");
      if (e.ctrlKey) modifiers.push("ctrl");
      if (e.altKey) modifiers.push("alt");
      if (e.shiftKey) modifiers.push("shift");

      onChange({ key: e.key, modifiers });
      setRecording(false);
    };

    const handleBlur = () => {
      setRecording(false);
    };

    window.addEventListener("keydown", handler, { capture: true });
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handler, { capture: true });
      window.removeEventListener("blur", handleBlur);
      setSuspended(false);
    };
  }, [recording, onChange, setSuspended]);

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <span className="animate-pulse rounded border border-blue-400 bg-blue-100 px-2 py-0.5 text-copy-13 text-blue-900">
          Press a key combo...
        </span>
        <button
          className="text-copy-12 text-gray-700 hover:text-gray-1000"
          onClick={() => setRecording(false)}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        ref={buttonRef}
        className="rounded border border-gray-alpha-300 bg-background-100 px-2 py-0.5 font-mono text-copy-13 text-gray-1000 transition-colors hover:border-gray-alpha-400 hover:bg-gray-alpha-100"
        onClick={() => setRecording(true)}
        title="Click to rebind"
      >
        {value ? comboToSymbols(value) : <span className="text-gray-600">Disabled</span>}
      </button>
      {!isDefault && (
        <button
          className="text-copy-12 text-gray-700 hover:text-gray-1000"
          onClick={onReset}
          title="Reset to default"
        >
          Reset
        </button>
      )}
    </div>
  );
}

function KeyboardShortcutsTab() {
  const definitions = useKeybindStore((s) => s.definitions);
  const overrides = useKeybindStore((s) => s.overrides);
  const getBinding = useKeybindStore((s) => s.getBinding);
  const setBinding = useKeybindStore((s) => s.setBinding);
  const resetBinding = useKeybindStore((s) => s.resetBinding);
  const resetAll = useKeybindStore((s) => s.resetAll);
  const [search, setSearch] = useState("");

  const hasOverrides = Object.keys(overrides).length > 0;

  const filtered = search.trim()
    ? definitions.filter(
        (d) =>
          d.label.toLowerCase().includes(search.toLowerCase()) ||
          d.description.toLowerCase().includes(search.toLowerCase()),
      )
    : definitions;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    shortcuts: filtered.filter((d) => d.category === cat),
  })).filter((g) => g.shortcuts.length > 0);

  return (
    <div className="flex max-w-2xl flex-col gap-6 text-gray-1000">
      <section>
        <SectionHeader
          title="Keyboard Shortcuts"
          description="Customize keybindings. Click a shortcut to rebind it."
        >
          {hasOverrides && (
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                if (globalThis.confirm("Reset all shortcuts to defaults?")) resetAll();
              }}
            >
              Reset All
            </Button>
          )}
        </SectionHeader>
        <Input
          size="small"
          placeholder="Search shortcuts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search keyboard shortcuts"
        />
      </section>

      {grouped.map((group) => (
        <section key={group.category}>
          <h3 className="mb-2 text-copy-13 font-medium text-gray-900">
            {group.label}
          </h3>
          <div className="rounded-lg border border-gray-alpha-200 bg-background-100">
            {group.shortcuts.map((def, i) => {
              const binding = getBinding(def.id);
              const isDefault = !(def.id in overrides);
              return (
                <div
                  key={def.id}
                  className={`flex items-center justify-between px-4 py-2.5 ${
                    i > 0 ? "border-t border-gray-alpha-100" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-copy-13 text-gray-1000">{def.label}</p>
                    <p className="text-copy-12 text-gray-700">{def.description}</p>
                  </div>
                  <ShortcutRecorder
                    value={binding}
                    onChange={(combo) => setBinding(def.id, combo)}
                    onReset={() => resetBinding(def.id)}
                    isDefault={isDefault}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {grouped.length === 0 && search && (
        <EmptyState
          title="No matching shortcuts"
          description={`No shortcuts match "${search}".`}
          compact
        />
      )}
    </div>
  );
}
