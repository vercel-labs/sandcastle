"use client";

import { TerminalApp } from "./terminal/TerminalApp";
import { FileManager } from "./file-manager/FileManager";
import { Settings } from "./settings/Settings";
import { CodeServerApp } from "./code-server/CodeServerApp";
import { AppStore } from "./app-store/AppStore";

export const APP_COMPONENTS: Record<string, React.ComponentType<{ meta?: Record<string, unknown> }>> = {
  terminal: TerminalApp,
  "file-manager": FileManager,
  settings: Settings,
  "code-server": CodeServerApp,
  "app-store": AppStore,
};
