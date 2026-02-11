"use client";

import { useState, useCallback } from "react";
import { useDesktopStore } from "@/stores/desktop-store";
import { LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { DesktopEntry } from "@/types/desktop-entry";
import { AppIcon } from "@/components/app-icon";
import { useLaunchApp, getAppId } from "@/lib/hooks/use-launch-app";

export function AppMenu() {
  const [search, setSearch] = useState("");
  const apps = useDesktopStore((s) => s.apps);
  const launchApp = useLaunchApp();

  const filtered = apps.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()),
  );

  const launch = useCallback(
    (entry: DesktopEntry) => {
      launchApp(entry);
      setSearch("");
    },
    [launchApp],
  );

  return (
    <div className="flex items-center px-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-label-13 text-gray-900 transition-all hover:bg-gray-alpha-200 hover:text-gray-1000"
          aria-label="Applications menu"
        >
          <LayoutGrid aria-hidden="true" size={16} />
          <span className="text-label-13">Apps</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72 max-h-80 overflow-y-auto" side="top" align="start">
          <div className="p-2">
            <Input
              type="search"
              placeholder="Search apps..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search applications"
              autoFocus
            />
          </div>
          {filtered.map((entry) => (
            <DropdownMenuItem
              key={entry.id}
              onClick={() => launch(entry)}
            >
              <AppIcon appId={getAppId(entry)} size={16} className="shrink-0" />
              <div className="min-w-0">
                <div className="truncate text-label-14 text-gray-1000">
                  {entry.name}
                </div>
                {entry.comment && (
                  <div className="truncate text-label-12 text-gray-900">
                    {entry.comment}
                  </div>
                )}
              </div>
            </DropdownMenuItem>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-label-13 text-gray-900">
              No apps found
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
