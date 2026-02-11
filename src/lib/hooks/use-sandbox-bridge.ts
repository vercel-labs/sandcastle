"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { useActiveSandbox } from "@/stores/workspace-store";
import { useNotificationStore } from "@/stores/notification-store";
import { useDesktopStore } from "@/stores/desktop-store";
import {
  sandboxServiceFetcher,
  sandboxServiceOnErrorRetry,
} from "@/lib/hooks/use-sandbox-service-client";

interface BridgeNotification {
  id: number;
  appName: string;
  replacesId: number;
  icon: string | null;
  summary: string;
  body: string;
  actions: string[];
  expires: number;
  timestamp: number;
  urgency: "low" | "normal" | "critical";
  category: string | null;
  transient: boolean;
  resident: boolean;
  desktopEntry: string | null;
}

interface BridgeNotificationsResponse {
  notifications: BridgeNotification[];
}



/**
 * Polls the sandbox bridge for notifications sent via `notify-send` or GLib
 * inside the sandbox. New notifications are fed into the existing
 * notification store so they appear as toast popups and in the notification
 * center, identical to Xpra-forwarded notifications.
 *
 * Uses SWR with `refreshInterval` for efficient polling — only fetches
 * notifications newer than the last seen timestamp.
 */
export function useDbusNotifications() {
  const { activeWorkspaceId, sandbox } = useActiveSandbox();
  const sinceRef = useRef(Date.now());
  const addNotification = useNotificationStore((s) => s.addNotification);

  const servicesUrl = sandbox?.domains.services
    ? `https://${sandbox.domains.services}`
    : null;

  const { data } = useSWR<BridgeNotificationsResponse>(
    servicesUrl
      ? `${servicesUrl}/bridge/notifications?since=${sinceRef.current}`
      : null,
    sandboxServiceFetcher,
    {
      refreshInterval: 1000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 500,
      onErrorRetry: sandboxServiceOnErrorRetry,
    },
  );

  useEffect(() => {
    if (!data?.notifications?.length) return;

    for (const notif of data.notifications) {
      if (notif.timestamp > sinceRef.current) {
        sinceRef.current = notif.timestamp;
      }

      addNotification({
        id: notif.id,
        replacesId: notif.replacesId,
        appName: notif.appName,
        summary: notif.summary,
        body: notif.body,
        icon: notif.icon,
        actions: notif.actions,
        expires: notif.expires,
        urgency: notif.urgency ?? "normal",
        category: notif.category ?? null,
        transient: notif.transient ?? false,
        workspaceId: activeWorkspaceId,
      });
    }
  }, [data, addNotification, activeWorkspaceId]);
}

// ---------------------------------------------------------------------------
// Desktop entry monitor
// ---------------------------------------------------------------------------

interface AppsGenerationResponse {
  generation: number;
}

/**
 * Polls the bridge for .desktop file changes (via inotify in the Python
 * daemon). When the generation counter bumps, re-fetches the full desktop
 * entry list so newly installed apps appear on the desktop and in menus.
 */
export function useDesktopEntryMonitor() {
  const { sandbox } = useActiveSandbox();
  const generationRef = useRef<number | null>(null);
  const fetchRemoteApps = useDesktopStore((s) => s.fetchRemoteApps);

  const servicesUrl = sandbox?.domains.services
    ? `https://${sandbox.domains.services}`
    : null;

  const { data } = useSWR<AppsGenerationResponse>(
    servicesUrl ? `${servicesUrl}/bridge/apps-generation` : null,
    sandboxServiceFetcher,
    {
      refreshInterval: 3000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 2000,
      onErrorRetry: sandboxServiceOnErrorRetry,
    },
  );

  useEffect(() => {
    if (data == null || !sandbox?.domains.services) return;
    const gen = data.generation;

    if (generationRef.current === null) {
      // First load — just record the baseline
      generationRef.current = gen;
      return;
    }

    if (gen !== generationRef.current) {
      generationRef.current = gen;
      fetchRemoteApps(sandbox.domains.services);
    }
  }, [data, sandbox?.domains.services, fetchRemoteApps]);
}
