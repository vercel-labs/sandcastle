"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useActiveSandbox } from "@/stores/workspace-store";
import { sandboxServicePost } from "@/lib/hooks/use-sandbox-service-client";

/**
 * Syncs the resolved theme (light/dark) to the sandbox's GTK/GNOME settings
 * so X11 apps render with the correct color scheme.
 *
 * Two-pronged approach:
 * 1. Writes GTK settings.ini files + gsettings for GTK3 apps and env vars
 * 2. Posts color-scheme to the sandbox bridge, which exposes it via the
 *    org.freedesktop.portal.Settings interface for GTK4/libadwaita apps
 */
export function useSyncSandboxTheme() {
  const { resolvedTheme } = useTheme();
  const { sandbox } = useActiveSandbox();
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sandbox || !resolvedTheme) return;
    if (lastSyncedRef.current === resolvedTheme) return;
    lastSyncedRef.current = resolvedTheme;

    const isDark = resolvedTheme === "dark";
    const gtkTheme = isDark ? "Adwaita-dark" : "Adwaita";
    const darkPref = isDark ? 1 : 0;
    const colorScheme = isDark ? "prefer-dark" : "prefer-light";

    // Portal color-scheme values: 0=default, 1=prefer-dark, 2=prefer-light
    const portalColorScheme = isDark ? 1 : 2;

    // Keep gtk-decoration-layout empty so CSD buttons stay hidden
    const settingsIni = `[Settings]\ngtk-application-prefer-dark-theme=${darkPref}\ngtk-theme-name=${gtkTheme}\ngtk-decoration-layout=\n`;

    const servicesBase = `https://${sandbox.domains.services}`;

    const script = [
      `mkdir -p ~/.config/gtk-3.0 ~/.config/gtk-4.0`,
      `printf '${settingsIni}' > ~/.config/gtk-3.0/settings.ini`,
      `printf '${settingsIni}' > ~/.config/gtk-4.0/settings.ini`,
      `gsettings set org.gnome.desktop.interface color-scheme '${colorScheme}' 2>/dev/null || true`,
      `gsettings set org.gnome.desktop.interface gtk-theme '${gtkTheme}' 2>/dev/null || true`,
      `printf 'export GTK_THEME=${gtkTheme}\\n' | sudo tee /etc/profile.d/sandbox-gtk-theme.sh > /dev/null`,
    ].join(" && ");

    Promise.all([
      sandboxServicePost(servicesBase, "/process/run", {
        command: "bash",
        args: ["-c", script],
      }),
      sandboxServicePost(servicesBase, "/bridge/settings", {
        colorScheme: portalColorScheme,
      }),
    ]).catch(() => {});
  }, [resolvedTheme, sandbox]);
}
