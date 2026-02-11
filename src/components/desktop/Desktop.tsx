"use client";

import { useCallback } from "react";
import { useDesktopStore } from "@/stores/desktop-store";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { useLaunchApp } from "@/lib/hooks/use-launch-app";
import { DesktopIcon } from "./DesktopIcon";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/ContextMenu";

export function Desktop() {
  const desktopIcons = useDesktopStore((s) => s.desktopIcons);
  const launchApp = useLaunchApp();
  const isMobile = useIsMobile();

  const launchById = useCallback(
    (id: string) => {
      const entry = desktopIcons.find((a) => a.id === id);
      if (entry) launchApp(entry);
    },
    [desktopIcons, launchApp],
  );

  const desktopContent = (
    <>
      <nav
        className={
          isMobile
            ? "grid auto-rows-max grid-cols-4 gap-2 p-4 pb-16"
            : "grid auto-rows-max grid-cols-[repeat(auto-fill,5rem)] gap-1 p-4 pb-16"
        }
        aria-label="Desktop applications"
      >
        {desktopIcons.map((entry) => (
          <DesktopIcon
            key={entry.id}
            entry={entry}
            onLaunch={() => launchApp(entry)}
            isMobile={isMobile}
          />
        ))}
      </nav>
    </>
  );

  if (isMobile) {
    return (
    <main
      className="fixed inset-0 overflow-hidden"
      aria-label="Desktop"
    >
      {desktopContent}
    </main>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
      <main
        className="fixed inset-0 overflow-hidden"
        aria-label="Desktop"
      >
        {desktopContent}
      </main>
    </ContextMenuTrigger>
      <ContextMenuContent className="w-[200px] z-[9999]">
        <ContextMenuItem onClick={() => launchById("terminal")}>
          Open Terminal
        </ContextMenuItem>
        <ContextMenuItem onClick={() => launchById("file-manager")}>
          Open File Manager
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => launchById("settings")}>
          Settings
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
