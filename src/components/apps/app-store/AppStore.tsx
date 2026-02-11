"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import useSWR from "swr";
import { useActiveSandbox } from "@/stores/workspace-store";
import { useXpraStore } from "@/stores/xpra-store";
import {
  useSandboxServiceClient,
  sandboxServiceFetcher,
} from "@/lib/hooks/use-sandbox-service-client";
import { NoWorkspacePlaceholder } from "@/components/apps/no-workspace-placeholder";
import {
  Toolbar,
  StatusBar,
  SplitPane,
  SidebarNav,
  ListView,
  PropertyPanel,
  EmptyState,
} from "@/components/os-primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Store,
  Download,
  Trash,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  Play,
  Globe,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Package {
  name: string;
  summary: string;
  version: string;
  versions?: string[];
}

interface PackageVersion {
  version: string;
  repo: string;
  size: number;
}

interface PackageInfo {
  [key: string]: string;
}

interface Repo {
  id: string;
  name: string;
  enabled: boolean;
}

type ViewMode = "gui-apps" | "installed" | "search";

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// AppStore
// ---------------------------------------------------------------------------

export function AppStore() {
  const { sandbox } = useActiveSandbox();
  const launchApp = useXpraStore((s) => s.launchApp);
  const { servicesDomain, serviceUrl, post } = useSandboxServiceClient();

  const [view, setView] = useState<ViewMode>("gui-apps");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState("");
  const [showRepoForm, setShowRepoForm] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // Reset offset when view/search changes
  useEffect(() => { setOffset(0); }, [view, debouncedSearch]);

  // ---- SWR queries (cached across tab switches) ----

  const searchPath = view === "gui-apps"
    ? `/packages/search?gui=1&offset=${offset}&limit=${PAGE_SIZE}`
    : view === "installed"
      ? `/packages/installed?offset=${offset}&limit=${PAGE_SIZE}${debouncedSearch ? `&q=${encodeURIComponent(debouncedSearch)}` : ""}`
      : debouncedSearch
        ? `/packages/search?q=${encodeURIComponent(debouncedSearch)}&offset=${offset}&limit=${PAGE_SIZE}`
        : null;

  const { data: searchData, error: searchError, isLoading, mutate: mutatePackages } = useSWR<{ packages: Package[]; total: number }>(
    searchPath ? serviceUrl(searchPath) : null,
    sandboxServiceFetcher,
    { revalidateOnFocus: false, dedupingInterval: 10_000 },
  );

  const packages: Package[] = searchData?.packages ?? [];
  const total: number = searchData?.total ?? 0;

  const { data: installedData, mutate: mutateInstalled } = useSWR<{ packages: Package[] }>(
    serviceUrl("/packages/installed?limit=500"),
    sandboxServiceFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );
  const installedNames = new Set<string>(
    (installedData?.packages ?? []).map((p) => p.name),
  );

  const { data: infoData, isLoading: infoLoading } = useSWR<{ info: PackageInfo | null }>(
    selectedPkg ? serviceUrl(`/packages/info?name=${encodeURIComponent(selectedPkg)}`) : null,
    sandboxServiceFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const pkgInfo: PackageInfo | null = infoData?.info ?? null;

  const { data: versionsData } = useSWR<{ versions: PackageVersion[]; installedVersion: string | null }>(
    selectedPkg ? serviceUrl(`/packages/versions?name=${encodeURIComponent(selectedPkg)}`) : null,
    sandboxServiceFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const versions: PackageVersion[] = versionsData?.versions ?? [];
  const installedVersion: string | null = versionsData?.installedVersion ?? null;

  const { data: reposData, mutate: mutateRepos } = useSWR<{ repos: Repo[] }>(
    serviceUrl("/packages/repos"),
    sandboxServiceFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const repos: Repo[] = reposData?.repos ?? [];

  // ---- Actions ----

  const installPkg = useCallback(
    async (name: string, version?: string) => {
      if (!servicesDomain) return;
      setActionStatus("installing");
      setActionLog("");
      try {
        const data = await post<{ ok: boolean; stdout?: string; stderr?: string }>("/packages/install", { name, version });
        setActionLog((data.stdout || "") + (data.stderr || ""));
        if (data.ok) {
          setActionStatus(null);
          void mutateInstalled();
          void mutatePackages();
        } else {
          setActionStatus("error");
        }
      } catch {
        setActionStatus("error");
      }
    },
    [servicesDomain, post, mutateInstalled, mutatePackages],
  );

  const removePkg = useCallback(
    async (name: string) => {
      if (!servicesDomain) return;
      setActionStatus("removing");
      setActionLog("");
      try {
        const data = await post<{ ok: boolean; stdout?: string; stderr?: string }>("/packages/remove", { name });
        setActionLog((data.stdout || "") + (data.stderr || ""));
        if (data.ok) {
          setActionStatus(null);
          void mutateInstalled();
          void mutatePackages();
        } else {
          setActionStatus("error");
        }
      } catch {
        setActionStatus("error");
      }
    },
    [servicesDomain, post, mutateInstalled, mutatePackages],
  );

  const addRepo = useCallback(
    async () => {
      if (!repoUrl.trim()) return;
      setActionStatus("adding-repo");
      setActionLog("");
      try {
        await post("/packages/repos", { repoUrl: repoUrl.trim() });
        setRepoUrl("");
        setShowRepoForm(false);
        void mutateRepos();
        setActionStatus(null);
      } catch (err) {
        setActionLog(err instanceof Error ? err.message : "Failed to add repo");
        setActionStatus("error");
      }
    },
    [post, repoUrl, mutateRepos],
  );

  // ---- Derived state ----

  const selectedPkgData = selectedPkg ? packages.find((p) => p.name === selectedPkg) : null;
  const isInstalled = selectedPkg ? installedNames.has(selectedPkg) : false;
  const busy = actionStatus === "installing" || actionStatus === "removing" || actionStatus === "adding-repo";
  const hasNext = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;
  const pageNum = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (!sandbox) {
    return <NoWorkspacePlaceholder message="No active workspace. Create one to browse packages." />;
  }

  return (
    <div className="flex h-full flex-col bg-background-100">
      <Toolbar>
        <Toolbar.Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value.trim() && view !== "search") setView("search");
          }}
          placeholder={"Search packages\u2026"}
          aria-label="Search packages"
        />
        <Toolbar.Separator />
        <Toolbar.Button
          tooltip="Refresh"
          onClick={() => { void mutatePackages(); void mutateInstalled(); }}
          disabled={isLoading}
          aria-label="Refresh"
        >
          <RefreshCw />
        </Toolbar.Button>
      </Toolbar>

      <div className="flex-1 overflow-hidden">
        <SplitPane defaultSize={150} min={120} max={200} collapseBelow={480}>
          <SplitPane.Panel className="bg-gray-alpha-50">
            <SidebarNav label="Views">
              <SidebarNav.Group title="Packages">
                <SidebarNav.Item active={view === "gui-apps"} onClick={() => { setView("gui-apps"); setSearch(""); setSelectedPkg(null); }} icon={<Globe />}>GUI Apps</SidebarNav.Item>
                <SidebarNav.Item active={view === "installed"} onClick={() => { setView("installed"); setSearch(""); setSelectedPkg(null); }} icon={<CheckCircle />} suffix={installedNames.size}>Installed</SidebarNav.Item>
                <SidebarNav.Item active={view === "search"} onClick={() => setView("search")} icon={<Store />}>All Packages</SidebarNav.Item>
              </SidebarNav.Group>

              <SidebarNav.Group title="Repos">
                {repos.map((r) => (
                  <div key={r.id} className="mx-1 flex items-center gap-2 px-2 py-0.5 text-copy-13 text-gray-900">
                    <span className={`h-1.5 w-1.5 rounded-full ${r.enabled ? "bg-green-900" : "bg-gray-600"}`} />
                    <span className="truncate">{r.id}</span>
                  </div>
                ))}
                <SidebarNav.Item onClick={() => setShowRepoForm(!showRepoForm)} icon={<Plus />}>
                  Add repo
                </SidebarNav.Item>
                {showRepoForm && (
                  <div className="mx-1 mt-1 flex flex-col gap-1 rounded-md bg-gray-alpha-100 p-2">
                    <Input
                      size="small"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://..."
                      aria-label="Repository URL"
                    />
                    <Button size="small" onClick={addRepo} disabled={busy || !repoUrl.trim()} loading={actionStatus === "adding-repo"}>
                      Add
                    </Button>
                  </div>
                )}
              </SidebarNav.Group>
            </SidebarNav>
          </SplitPane.Panel>
          <SplitPane.Panel>
            <SplitPane defaultSize={260} min={180} max={400} collapseBelow={600}>
              <SplitPane.Panel>
                <div className="flex h-full flex-col">
                  {isLoading ? (
                    <div className="flex flex-1 items-center justify-center"><Spinner size="md" /></div>
                  ) : searchError ? (
                    <EmptyState icon={<Store />} title="Failed to load" description={searchError.message} className="flex-1" />
                  ) : packages.length === 0 ? (
                    <EmptyState
                      icon={<Store />}
                      title={view === "search" && !debouncedSearch ? "Search all packages" : view === "search" ? "No results" : view === "installed" ? "No packages installed" : "No GUI apps found"}
                      description={view === "search" && !debouncedSearch ? "Type a package name to search the dnf repos." : view === "search" ? `Nothing matching \u201c${debouncedSearch}\u201d.` : undefined}
                      className="flex-1"
                    />
                  ) : (
                    <ListView
                      items={packages}
                      selected={selectedPkg}
                      onSelect={setSelectedPkg}
                      getKey={(p) => p.name}
                      renderItem={(p) => (
                        <div className="flex items-center gap-2 py-0.5">
                          <span className="min-w-0 flex-1 truncate text-copy-13 text-gray-1000">{p.name}</span>
                          {installedNames.has(p.name) && (
                            <span className="shrink-0 text-green-900 [&>svg]:h-3 [&>svg]:w-3"><CheckCircle /></span>
                          )}
                        </div>
                      )}
                      className="flex-1"
                    />
                  )}
                  {/* Pagination */}
                  {total > PAGE_SIZE && (
                    <div className="flex shrink-0 items-center justify-between border-t border-gray-alpha-200 px-2 py-1">
                      <Button size="small" variant="secondary" prefix={<ChevronLeft />} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={!hasPrev}>
                        Prev
                      </Button>
                      <span className="text-copy-13 text-gray-800">{pageNum} / {totalPages}</span>
                      <Button size="small" variant="secondary" suffix={<ChevronRight />} onClick={() => setOffset(offset + PAGE_SIZE)} disabled={!hasNext}>
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              </SplitPane.Panel>
              <SplitPane.Panel>
                {selectedPkgData ? (
                  <PackageDetail
                    pkg={selectedPkgData}
                    info={pkgInfo}
                    infoLoading={infoLoading}
                    versions={versions}
                    installedVersion={installedVersion}
                    isInstalled={isInstalled}
                    busy={busy}
                    actionStatus={actionStatus}
                    actionLog={actionLog}
                    onInstall={installPkg}
                    onRemove={removePkg}
                    onLaunch={(name) => launchApp(name)}
                  />
                ) : (
                  <EmptyState icon={<Store />} title="Select a package" description="Choose a package to see details." className="h-full" />
                )}
              </SplitPane.Panel>
            </SplitPane>
          </SplitPane.Panel>
        </SplitPane>
      </div>

      <StatusBar>
        <StatusBar.Item>{total} packages</StatusBar.Item>
        <StatusBar.Separator />
        <StatusBar.Item variant="success">{installedNames.size} installed</StatusBar.Item>
        <StatusBar.Separator />
        <StatusBar.Item>{repos.filter((r) => r.enabled).length} repos</StatusBar.Item>
        <StatusBar.Spacer />
        {busy && <StatusBar.Item variant="warning">{actionStatus === "installing" ? "Installing\u2026" : actionStatus === "removing" ? "Removing\u2026" : "Working\u2026"}</StatusBar.Item>}
      </StatusBar>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Package detail panel
// ---------------------------------------------------------------------------

function PackageDetail({
  pkg,
  info,
  infoLoading,
  versions,
  installedVersion,
  isInstalled,
  busy,
  actionStatus,
  actionLog,
  onInstall,
  onRemove,
  onLaunch,
}: {
  pkg: Package;
  info: PackageInfo | null;
  infoLoading: boolean;
  versions: PackageVersion[];
  installedVersion: string | null;
  isInstalled: boolean;
  busy: boolean;
  actionStatus: string | null;
  actionLog: string;
  onInstall: (name: string, version?: string) => void;
  onRemove: (name: string) => void;
  onLaunch: (name: string) => void;
}) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="p-4">
        <h2 className="text-copy-13 font-medium text-gray-1000">{pkg.name}</h2>
        <p className="mt-0.5 text-copy-13 text-gray-900">{pkg.summary}</p>

        <div className="mt-2 mb-3 flex items-center gap-2">
          {isInstalled ? (
            <Badge variant="green" size="sm">Installed {installedVersion ?? ""}</Badge>
          ) : (
            <Badge variant="gray" size="sm">Available</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {isInstalled && (
            <Button size="small" prefix={<Play />} onClick={() => onLaunch(pkg.name)}>
              Launch
            </Button>
          )}
          {!isInstalled && (
            <Button
              size="small"
              prefix={busy ? undefined : <Download />}
              onClick={() => onInstall(pkg.name, selectedVersion ?? undefined)}
              disabled={busy}
              loading={actionStatus === "installing"}
            >
              Install{selectedVersion ? ` ${selectedVersion}` : ""}
            </Button>
          )}
          {isInstalled && (
            <Button size="small" variant="error" prefix={<Trash />} onClick={() => onRemove(pkg.name)} disabled={busy} loading={actionStatus === "removing"}>
              Remove
            </Button>
          )}
        </div>

        {/* Version picker */}
        {versions.length > 1 && (
          <div className="mb-4">
            <p className="mb-1 text-copy-13 font-medium text-gray-800">Versions</p>
            <div className="max-h-32 overflow-auto rounded-lg border border-gray-alpha-200">
              {versions.map((v) => (
                <button
                  key={v.version}
                  onClick={() => setSelectedVersion(v.version === selectedVersion ? null : v.version)}
                  className={`flex w-full items-center justify-between px-3 py-1 text-copy-13 transition-colors ${
                    selectedVersion === v.version
                      ? "bg-blue-700/10 text-gray-1000"
                      : "text-gray-900 hover:bg-gray-alpha-100"
                  } ${installedVersion === v.version ? "font-medium" : ""}`}
                >
                  <span className="font-mono">{v.version}</span>
                  <span className="flex items-center gap-2">
                    {v.repo && <span className="text-gray-700">{v.repo}</span>}
                    {installedVersion === v.version && (
                      <span className="text-green-900 [&>svg]:h-3 [&>svg]:w-3"><CheckCircle /></span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {infoLoading ? (
          <div className="flex justify-center py-4"><Spinner size="sm" /></div>
        ) : info ? (
          <PropertyPanel className="rounded-lg border border-gray-alpha-200">
            <PropertyPanel.Section>
              {info.version && <PropertyPanel.Row label="Version" value={info.version} />}
              {info.release && <PropertyPanel.Row label="Release" mono>{info.release}</PropertyPanel.Row>}
              {info.architecture && <PropertyPanel.Row label="Arch" value={info.architecture} />}
              {info.size && <PropertyPanel.Row label="Size" value={info.size} />}
              {info.repository && <PropertyPanel.Row label="Repo" value={info.repository} />}
              {info.license && <PropertyPanel.Row label="License" value={info.license} />}
            </PropertyPanel.Section>
            {info.url && (
              <PropertyPanel.Section>
                <PropertyPanel.Row label="URL">
                  <a href={info.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-900 hover:underline">
                    Link <ExternalLink />
                  </a>
                </PropertyPanel.Row>
              </PropertyPanel.Section>
            )}
            {info.description && (
              <PropertyPanel.Section>
                <div className="px-3 py-2 text-copy-13 text-gray-900">{info.description}</div>
              </PropertyPanel.Section>
            )}
          </PropertyPanel>
        ) : null}
      </div>

      {actionLog && (
        <div className="mt-auto border-t border-gray-alpha-200 bg-gray-alpha-50 p-3">
          <p className="mb-1 text-copy-13 font-medium text-gray-800">Output</p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-gray-alpha-100 p-2 font-mono text-copy-13 text-gray-1000">
            {actionLog}
          </pre>
        </div>
      )}
    </div>
  );
}


