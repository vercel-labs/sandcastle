"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Bell, Sun, Moon, Monitor } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useNotificationStore } from "@/stores/notification-store";
import { useXpraStore } from "@/stores/xpra-store";


const THEME_OPTIONS = [
  { key: "system", label: "System", Icon: Monitor },
  { key: "light", label: "Light", Icon: Sun },
  { key: "dark", label: "Dark", Icon: Moon },
] as const;

function ThemeDropdown() {
  const { theme, setTheme } = useTheme();

  const current =
    THEME_OPTIONS.find((o) => o.key === theme) ?? THEME_OPTIONS[0];
  const CurrentIcon = current.Icon;

  return (
    <DropdownMenu>
      <Tooltip text="Theme" position="top" delay delayTime={400} desktopOnly>
        <DropdownMenuTrigger
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-alpha-200 hover:text-gray-1000"
          aria-label="Change theme"
        >
          <CurrentIcon size={16} />
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" side="top" className="w-40">
        {THEME_OPTIONS.map(({ key, label, Icon }) => (
          <DropdownMenuItem
            key={key}
            onClick={() => setTheme(key)}
          >
            <Icon size={16} />
            {label}
            {theme === key && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-700" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SystemTray() {
  const timeRef = useRef<HTMLSpanElement>(null);
  const dateRef = useRef<HTMLSpanElement>(null);

  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const toggleCenter = useNotificationStore((s) => s.toggleCenter);
  const trayIcons = useNotificationStore((s) => s.trayIcons);
  const bellFlash = useXpraStore((s) => s.bellFlash);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      if (timeRef.current) {
        timeRef.current.textContent = now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      if (dateRef.current) {
        dateRef.current.textContent = now.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        });
      }
    };
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, []);

  const trayIconEntries = Array.from(trayIcons.values());

  return (
    <div className="flex items-center gap-1.5 px-3">
      {trayIconEntries.map((tray) => (
        <Tooltip
          key={tray.wid}
          text={tray.title || "System Tray"}
          position="top"
          delay
          delayTime={400}
          desktopOnly
        >
          <div className="hidden h-6 w-6 items-center justify-center sm:flex">
            {tray.icon ? (
              <img src={tray.icon} alt={tray.title} className="h-4 w-4" />
            ) : (
              <div
                className="h-3 w-3 rounded-full bg-gray-600"
                aria-hidden="true"
              />
            )}
          </div>
        </Tooltip>
      ))}

      <Tooltip
        text="Notifications"
        position="top"
        delay
        delayTime={400}
        desktopOnly
      >
        <button
          className={`relative flex h-7 w-7 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-alpha-200 hover:text-gray-1000 ${
            bellFlash ? "bg-amber-100 text-amber-900" : ""
          }`}
          onClick={toggleCenter}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-blue-700 px-1 text-[9px] font-bold text-white"
              aria-hidden="true"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </Tooltip>

      <ThemeDropdown />

      <div
        className="hidden flex-col items-end leading-tight sm:flex"
        role="status"
        aria-live="polite"
        aria-label="Current time and date"
      >
        <span ref={timeRef} className="text-label-12 text-gray-1000" />
        <span ref={dateRef} className="text-label-12 text-gray-900" />
      </div>
    </div>
  );
}
