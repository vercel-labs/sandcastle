"use client";

import type { DesktopEntry } from "@/types/desktop-entry";
import { AppIcon } from "@/components/app-icon";

interface DesktopIconProps {
  entry: DesktopEntry;
  onLaunch: () => void;
  isMobile?: boolean;
}

export function DesktopIcon({ entry, onLaunch, isMobile }: DesktopIconProps) {
  const iconSize = isMobile ? 36 : 32;

  return (
    <button
      className={
        isMobile
          ? "flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors active:bg-gray-alpha-200"
          : "flex w-20 flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-colors hover:bg-gray-alpha-200 focus-visible:bg-gray-alpha-200"
      }
      onClick={isMobile ? onLaunch : undefined}
      onDoubleClick={isMobile ? undefined : onLaunch}
      onKeyDown={isMobile ? undefined : (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onLaunch();
        }
      }}
      aria-label={`Open ${entry.name}`}
    >
      <div
        className={
          isMobile
            ? "flex h-14 w-14 items-center justify-center drop-shadow-lg"
            : "flex h-12 w-12 items-center justify-center drop-shadow-lg"
        }
        aria-hidden="true"
      >
        <AppIcon appId={entry.component || entry.id} size={iconSize} />
      </div>
      <span
        className="w-full truncate text-label-12 text-gray-1000 dark:text-gray-1000"
      >
        {entry.name}
      </span>
    </button>
  );
}
