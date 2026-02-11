"use client";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useActiveSandbox } from "@/stores/workspace-store";
import { useWindowStore } from "@/stores/window-store";
import { useXpraStore } from "@/stores/xpra-store";
import { useDirectoryListing } from "@/lib/hooks/use-swr-hooks";
import { useSandboxServiceClient } from "@/lib/hooks/use-sandbox-service-client";
import { NoWorkspacePlaceholder } from "@/components/apps/no-workspace-placeholder";
import { Toolbar, StatusBar, ListView, SplitPane, EmptyState } from "@/components/os-primitives";
import {
  FolderOpen,
  FileText,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  EyeOff,
  Code,
  Globe,
  Layers,
  Hash,
  Plus,
  FolderPlus,
  Pencil,
  Trash,
  Home,
  Download,
  Star,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Note } from "@/components/ui/note";

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
}

function getFileIcon(name: string, isDirectory: boolean) {
  if (isDirectory) return FolderOpen;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "c", "cpp", "h", "java", "sh", "bash", "zsh"].includes(ext)) return Code;
  if (["html", "htm", "css", "scss", "less", "svg", "xml"].includes(ext)) return Globe;
  if (["json", "yaml", "yml", "toml", "ini", "conf", "cfg"].includes(ext)) return Hash;
  if (["tar", "gz", "zip", "bz2", "xz", "7z", "rar", "deb", "rpm"].includes(ext)) return Layers;
  return FileText;
}

function getOpenAction(name: string): "code" | "xpra-open" | "none" {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if ([
    "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rb", "go", "rs", "c", "cpp", "h", "java",
    "sh", "bash", "zsh", "html", "htm", "css", "scss", "less", "svg", "xml",
    "json", "yaml", "yml", "toml", "ini", "conf", "cfg", "md", "mdx", "txt",
    "log", "env", "gitignore", "dockerignore", "dockerfile", "makefile",
    "lock", "prisma", "graphql", "sql", "csv",
  ].includes(ext) || name.startsWith(".")) return "code";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "pdf", "ps", "eps"].includes(ext)) return "xpra-open";
  if (ext === "desktop") return "xpra-open";
  return "code";
}

const HOME = "/home/vercel-sandbox";

const SIDEBAR_ITEMS = [
  { id: "home", label: "Home", icon: Home, path: HOME },
  { id: "desktop", label: "Desktop", icon: Star, path: `${HOME}/Desktop` },
  { id: "documents", label: "Documents", icon: FileText, path: `${HOME}/Documents` },
  { id: "downloads", label: "Downloads", icon: Download, path: `${HOME}/Downloads` },
  { id: "root", label: "/", icon: FolderOpen, path: "/" },
] as const;

function buildChildPath(dir: string, name: string): string {
  if (dir === "/") return `/${name}`;
  return `${dir.replace(/\/+$/, "")}/${name}`;
}

function getParentPath(filePath: string): string {
  const idx = filePath.lastIndexOf("/");
  if (idx <= 0) return "/";
  return filePath.slice(0, idx);
}

function parseEntryName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new Error("Name cannot be empty.");
  if (name === "." || name === "..") throw new Error("Invalid name.");
  if (name.includes("/")) throw new Error("Name cannot include '/'.");
  return name;
}

function formatSize(bytes: number) {
  if (bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)}\u00a0${units[i]}`;
}

export function FileManager() {
  const [cwd, setCwd] = useState(HOME);
  const [selected, setSelected] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [mutating, setMutating] = useState<string | null>(null);
  const { sandbox } = useActiveSandbox();
  const openWindow = useWindowStore((s) => s.openWindow);
  const launchApp = useXpraStore((s) => s.launchApp);
  const { servicesDomain, post: postService } = useSandboxServiceClient();
  const {
    entries,
    isLoading,
    isValidating,
    error: swrError,
    revalidate,
  } = useDirectoryListing(servicesDomain, cwd);
  const error = swrError?.message ?? null;

  const historyRef = useRef<string[]>([HOME]);
  const historyIdxRef = useRef(0);

  const navigateTo = useCallback(
    (dir: string) => {
      setSelected(null);
      historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
      historyRef.current.push(dir);
      historyIdxRef.current = historyRef.current.length - 1;
      setCwd(dir);
    },
    [],
  );

  const goBack = useCallback(() => {
    if (historyIdxRef.current > 0) {
      historyIdxRef.current--;
      setSelected(null);
      setCwd(historyRef.current[historyIdxRef.current]);
    }
  }, []);

  const goForward = useCallback(() => {
    if (historyIdxRef.current < historyRef.current.length - 1) {
      historyIdxRef.current++;
      setSelected(null);
      setCwd(historyRef.current[historyIdxRef.current]);
    }
  }, []);

  const handleOpen = useCallback(
    (entry: FileEntry) => {
      if (entry.isDirectory) {
        navigateTo(entry.path);
        return;
      }
      const action = getOpenAction(entry.name);
      if (action === "code") {
        openWindow({
          title: `Code \u2013 ${entry.name}`,
          appId: "code-server",
          width: 900,
          height: 600,
          meta: { filePath: entry.path },
        });
      } else if (action === "xpra-open") {
        launchApp(`xdg-open '${entry.path.replace(/'/g, "'\\''")}'`);
      }
    },
    [navigateTo, openWindow, launchApp],
  );

  const selectedEntry = useMemo(
    () => entries.find((e) => e.path === selected) ?? null,
    [entries, selected],
  );

  const hasNameConflict = useCallback(
    (name: string, excludedPath?: string) =>
      entries.some((e) => e.name === name && e.path !== excludedPath),
    [entries],
  );



  const runMutation = useCallback(
    async (action: string, op: () => Promise<void>) => {
      if (mutating) return;
      setMutating(action);
      try {
        await op();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Operation failed";
        globalThis.alert(message);
      } finally {
        setMutating(null);
      }
    },
    [mutating],
  );

  const createFile = useCallback(() => {
    const input = globalThis.prompt("New file name:");
    if (input == null) return;
    runMutation("new-file", async () => {
      const name = parseEntryName(input);
      if (hasNameConflict(name)) throw new Error(`"${name}" already exists.`);
      const path = buildChildPath(cwd, name);
      await postService("/files/write", { path, content: "" });
      await revalidate();
      setSelected(path);
    });
  }, [cwd, hasNameConflict, postService, revalidate, runMutation]);

  const createFolder = useCallback(() => {
    const input = globalThis.prompt("New folder name:");
    if (input == null) return;
    runMutation("new-folder", async () => {
      const name = parseEntryName(input);
      if (hasNameConflict(name)) throw new Error(`"${name}" already exists.`);
      const path = buildChildPath(cwd, name);
      await postService("/files/mkdir", { path });
      await revalidate();
      setSelected(path);
    });
  }, [cwd, hasNameConflict, postService, revalidate, runMutation]);

  const renameEntry = useCallback(() => {
    if (!selectedEntry) return;
    const input = globalThis.prompt("Rename to:", selectedEntry.name);
    if (input == null) return;
    runMutation("rename", async () => {
      const nextName = parseEntryName(input);
      if (nextName === selectedEntry.name) return;
      if (hasNameConflict(nextName, selectedEntry.path)) throw new Error(`"${nextName}" already exists.`);
      const nextPath = buildChildPath(getParentPath(selectedEntry.path), nextName);
      await postService("/files/rename", { oldPath: selectedEntry.path, newPath: nextPath });
      await revalidate();
      setSelected(nextPath);
    });
  }, [hasNameConflict, postService, revalidate, runMutation, selectedEntry]);

  const deleteEntry = useCallback(() => {
    if (!selectedEntry) return;
    const ok = globalThis.confirm(
      `Delete "${selectedEntry.name}"${selectedEntry.isDirectory ? " and all contents" : ""}?`,
    );
    if (!ok) return;
    runMutation("delete", async () => {
      await postService("/files/delete", { path: selectedEntry.path });
      setSelected(null);
      await revalidate();
    });
  }, [postService, revalidate, runMutation, selectedEntry]);

  const sortedEntries = useMemo(() => {
    let filtered = entries;
    if (!showHidden) filtered = entries.filter((e) => !e.name.startsWith("."));
    return [...filtered].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [entries, showHidden]);

  const dirCount = sortedEntries.filter((e) => e.isDirectory).length;
  const fileCount = sortedEntries.filter((e) => !e.isDirectory).length;

  // Determine which sidebar item is active
  const activeSidebarId = SIDEBAR_ITEMS.find((item) => cwd === item.path)?.id ?? null;

  if (!sandbox) {
    return <NoWorkspacePlaceholder message="No active workspace. Create one to browse files." />;
  }

  return (
    <div className="flex h-full flex-col bg-background-100">
      {/* Toolbar */}
      <Toolbar>
        <Toolbar.Group>
          <Toolbar.Button
            tooltip="Back"
            onClick={goBack}
            disabled={historyIdxRef.current <= 0}
            aria-label="Go back"
          >
            <ChevronLeft />
          </Toolbar.Button>
          <Toolbar.Button
            tooltip="Forward"
            onClick={goForward}
            disabled={historyIdxRef.current >= historyRef.current.length - 1}
            aria-label="Go forward"
          >
            <ChevronRight />
          </Toolbar.Button>
        </Toolbar.Group>
        <Toolbar.Separator />
        <Toolbar.Input
          value={cwd}
          onChange={(e) => navigateTo(e.target.value)}
          aria-label="Directory path"
        />
        {isValidating && !isLoading && (
          <span className="shrink-0 px-1">
            <Spinner size="sm" />
          </span>
        )}
        <Toolbar.Separator />
        <Toolbar.Group>
          <Toolbar.Button
            tooltip={showHidden ? "Hide hidden files" : "Show hidden files"}
            active={showHidden}
            onClick={() => setShowHidden(!showHidden)}
            aria-label={showHidden ? "Hide hidden files" : "Show hidden files"}
          >
            {showHidden ? <Eye /> : <EyeOff />}
          </Toolbar.Button>
          <Toolbar.Button
            tooltip="Refresh"
            onClick={() => revalidate()}
            disabled={!!mutating}
            aria-label="Refresh"
          >
            <RefreshCw />
          </Toolbar.Button>
        </Toolbar.Group>
        <Toolbar.Separator />
        <Toolbar.Group>
          <Toolbar.Button tooltip="New file" onClick={createFile} disabled={!!mutating} aria-label="New file">
            <Plus />
          </Toolbar.Button>
          <Toolbar.Button tooltip="New folder" onClick={createFolder} disabled={!!mutating} aria-label="New folder">
            <FolderPlus />
          </Toolbar.Button>
          <Toolbar.Button tooltip="Rename" onClick={renameEntry} disabled={!selectedEntry || !!mutating} aria-label="Rename">
            <Pencil />
          </Toolbar.Button>
          <Toolbar.Button tooltip="Delete" onClick={deleteEntry} disabled={!selectedEntry || !!mutating} aria-label="Delete">
            <Trash />
          </Toolbar.Button>
        </Toolbar.Group>
      </Toolbar>

      {/* Sidebar + file list */}
      <div className="flex-1 overflow-hidden">
        <SplitPane defaultSize={160} min={120} max={240} collapseBelow={400}>
          <SplitPane.Panel className="bg-gray-alpha-50">
            <nav className="flex flex-col py-1" aria-label="Places">
              <div className="px-3 pt-2 pb-1">
                <span className="text-copy-13 font-medium text-gray-800">Places</span>
              </div>
              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSidebarId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.path)}
                    className={`mx-1 flex items-center gap-2 rounded-md px-2 py-1 text-copy-13 transition-colors ${
                      isActive
                        ? "bg-gray-alpha-200 text-gray-1000"
                        : "text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000"
                    }`}
                  >
                    <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5 text-gray-800">
                      <Icon />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </SplitPane.Panel>
          <SplitPane.Panel>
            {/* File list */}
            {isLoading && entries.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <Spinner size="md" />
              </div>
            ) : error && entries.length === 0 ? (
              <div className="p-4">
                <Note type="error">{error}</Note>
              </div>
            ) : sortedEntries.length === 0 && !isLoading ? (
              <EmptyState
                icon={<FolderOpen />}
                title="Empty directory"
                description="This folder has no files."
                compact
                className="h-full"
              />
            ) : (
              <ListView
                items={sortedEntries}
                selected={selected}
                onSelect={setSelected}
                onActivate={handleOpen}
                getKey={(entry) => entry.path}
                renderItem={(entry) => {
                  const IconComponent = getFileIcon(entry.name, entry.isDirectory);
                  return (
                    <div className="flex items-center gap-2 py-px">
                      <span
                        className={`shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5 ${
                          entry.isDirectory ? "text-blue-900" : "text-gray-800"
                        }`}
                      >
                        <IconComponent />
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-copy-13 ${
                          entry.name.startsWith(".") ? "text-gray-700" : "text-gray-1000"
                        }`}
                      >
                        {entry.name}
                      </span>
                      <span className="w-16 shrink-0 text-right font-mono text-copy-13 tabular-nums text-gray-700">
                        {entry.isDirectory ? "" : formatSize(entry.size)}
                      </span>
                    </div>
                  );
                }}
                className="h-full"
              />
            )}
          </SplitPane.Panel>
        </SplitPane>
      </div>

      {/* Status bar */}
      <StatusBar>
        <StatusBar.Item>
          {dirCount > 0 && `${dirCount} folder${dirCount !== 1 ? "s" : ""}`}
          {dirCount > 0 && fileCount > 0 && ", "}
          {fileCount > 0 && `${fileCount} file${fileCount !== 1 ? "s" : ""}`}
          {dirCount === 0 && fileCount === 0 && !isLoading && "Empty"}
        </StatusBar.Item>
        <StatusBar.Spacer />
        {mutating && (
          <>
            <StatusBar.Item variant="warning">{mutating}\u2026</StatusBar.Item>
            <StatusBar.Separator />
          </>
        )}
        {selected && (
          <StatusBar.Item>{selected.split("/").pop()}</StatusBar.Item>
        )}
      </StatusBar>
    </div>
  );
}
