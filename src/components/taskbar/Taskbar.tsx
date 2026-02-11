"use client";

import { AppLauncher } from "./AppLauncher";
import { RunningApps } from "./RunningApps";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { SystemTray } from "./SystemTray";
import { Separator } from "@/components/ui/separator";

export function Taskbar({ launcherToggle }: { launcherToggle?: number }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[9000] flex h-11 items-center border-t border-gray-alpha-100 bg-background-100/90 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-2xl backdrop-saturate-150"
      aria-label="Taskbar"
    >
      <div className="flex items-center px-1 sm:px-1.5">
        <AppLauncher externalToggle={launcherToggle} />
      </div>
      <Separator orientation="vertical" className="mx-0.5 h-5 sm:mx-1" />
      <RunningApps />
      <Separator orientation="vertical" className="mx-0.5 h-5 sm:mx-1" />
      <WorkspaceSwitcher />
      <Separator orientation="vertical" className="mx-0.5 h-5 sm:mx-1" />
      <SystemTray />
    </nav>
  );
}
