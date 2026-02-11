"use client";

import { useEffect, useRef } from "react";
import { useNotificationStore } from "@/stores/notification-store";
import { X } from "lucide-react";

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export function NotificationCenter() {
  const centerOpen = useNotificationStore((s) => s.centerOpen);
  const history = useNotificationStore((s) => s.history);
  const clearHistory = useNotificationStore((s) => s.clearHistory);
  const closeCenter = useNotificationStore((s) => s.closeCenter);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!centerOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeCenter();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCenter();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [centerOpen, closeCenter]);

  if (!centerOpen) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notification center"
      className="fixed right-2 bottom-12 z-[9400] flex w-80 flex-col rounded-lg border border-gray-alpha-200 bg-background-100/95 shadow-xl backdrop-blur-xl"
      style={{ maxHeight: "min(480px, calc(100vh - 60px))" }}
    >
      <div className="flex items-center justify-between border-b border-gray-alpha-200 px-3 py-2">
        <span className="text-label-13 text-gray-1000">Notifications</span>
        <div className="flex items-center gap-1">
          {history.length > 0 && (
            <button
              className="rounded px-1.5 py-0.5 text-label-12 text-gray-800 transition-colors hover:bg-gray-alpha-200 hover:text-gray-1000"
              onClick={clearHistory}
            >
              Clear all
            </button>
          )}
          <button
            className="flex h-6 w-6 items-center justify-center rounded text-gray-800 transition-colors hover:bg-gray-alpha-200 hover:text-gray-1000"
            onClick={closeCenter}
            aria-label="Close notification center"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <span className="text-label-13 text-gray-800">
              No notifications
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {history.map((notif, i) => (
              <div
                key={`${notif.id}-${notif.timestamp}-${i}`}
                className={`flex gap-3 border-b border-gray-alpha-100 px-3 py-2.5 last:border-b-0 ${notif.urgency === "critical" ? "bg-red-500/5" : ""}`}
              >
                {notif.icon && (
                  <img
                    src={notif.icon}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {notif.appName && (
                        <p className="truncate text-label-12 text-gray-700">
                          {notif.appName}
                        </p>
                      )}
                      <p className="truncate text-label-13 text-gray-1000">
                        {notif.summary}
                      </p>
                    </div>
                    <span className="shrink-0 text-label-12 text-gray-700">
                      {formatTime(notif.timestamp)}
                    </span>
                  </div>
                  {notif.body && (
                    <p className="mt-0.5 line-clamp-2 text-label-12 text-gray-900">
                      {notif.body}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
