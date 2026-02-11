"use client";

import useSWR, { mutate } from "swr";
import useSWRImmutable from "swr/immutable";
import type { Workspace } from "@/types/workspace";
import type { SandboxInfo } from "@/types/sandbox";
import type { DesktopEntry } from "@/types/desktop-entry";
import { fetcher, SWR_KEYS } from "@/lib/swr";
import { sandboxServiceFetcher } from "@/lib/hooks/use-sandbox-service-client";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

interface VercelAccountInfo {
  providerAccountId: string;
  scope: string | null;
  connectedAt: string;
}

interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  role: "user" | "admin" | "guest";
  workspaceLimit: number | null;
  vercelConnected: boolean;
  vercelAccount: VercelAccountInfo | null;
}

export function useUser() {
  const { data, error, isLoading } = useSWR<AuthUser>(
    SWR_KEYS.user,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );
  return {
    user: data ?? null,
    isLoading,
    error: error as Error | undefined,
  };
}

export async function loginMutate(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error);
  }
  const user = await res.json();
  await mutate(SWR_KEYS.user, user, { revalidate: false });
  return user as AuthUser;
}

export async function signupMutate(
  email: string,
  password: string,
  name?: string,
) {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error);
  }
  const user = await res.json();
  await mutate(SWR_KEYS.user, user, { revalidate: false });
  return user as AuthUser;
}

export async function logoutMutate() {
  await fetch("/api/auth/logout", { method: "POST" });
  await mutate(SWR_KEYS.user, null, { revalidate: false });
}

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

interface WorkspacesResponse {
  workspaces: Workspace[];
}

const EMPTY_WORKSPACES: Workspace[] = [];

export function useWorkspaces(enabled = true) {
  const { data, error, isLoading, isValidating } =
    useSWR<WorkspacesResponse>(
      enabled ? SWR_KEYS.workspaces : null,
      fetcher,
      { revalidateOnFocus: true, dedupingInterval: 2000 },
    );
  return {
    workspaces: data?.workspaces ?? EMPTY_WORKSPACES,
    isLoading,
    isValidating,
    error: error as Error | undefined,
  };
}

export function mutateWorkspaces() {
  return mutate(SWR_KEYS.workspaces);
}

// ---------------------------------------------------------------------------
// Single workspace + sandbox info
// ---------------------------------------------------------------------------

interface WorkspaceResponse {
  workspace: Workspace;
  sandbox: SandboxInfo | null;
  sandboxLost?: boolean;
  canRecover?: boolean;
}

export function useWorkspace(id: string | null) {
  const { data, error, isLoading } = useSWR<WorkspaceResponse>(
    id ? SWR_KEYS.workspace(id) : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 2000, refreshInterval: 60_000 },
  );
  return {
    workspace: data?.workspace ?? null,
    sandbox: data?.sandbox ?? null,
    sandboxLost: data?.sandboxLost ?? false,
    canRecover: data?.canRecover ?? false,
    isLoading,
    error: error as Error | undefined,
  };
}

export function mutateWorkspace(id: string) {
  return mutate(SWR_KEYS.workspace(id));
}

// ---------------------------------------------------------------------------
// Window state
// ---------------------------------------------------------------------------

interface WindowsResponse {
  windows: unknown[];
}

export function useWindowState(workspaceId: string | null) {
  const { data, error, isLoading } = useSWRImmutable<WindowsResponse>(
    workspaceId ? SWR_KEYS.windows(workspaceId) : null,
    fetcher,
  );
  return {
    windows: data?.windows ?? null,
    isLoading,
    error: error as Error | undefined,
  };
}

// ---------------------------------------------------------------------------
// Desktop entries (from sandbox services, not Next.js API)
// ---------------------------------------------------------------------------

interface DesktopEntriesResponse {
  entries: DesktopEntry[];
  desktopShortcuts: DesktopEntry[];
  apps: DesktopEntry[];
}

export function useDesktopEntries(servicesDomain: string | null) {
  const { data, error, isLoading } = useSWRImmutable<DesktopEntriesResponse>(
    servicesDomain ? SWR_KEYS.desktopEntries(servicesDomain) : null,
    sandboxServiceFetcher,
  );
  return { data: data ?? null, isLoading, error: error as Error | undefined };
}

// ---------------------------------------------------------------------------
// File manager directory listing
// ---------------------------------------------------------------------------

interface DirectoryListingResponse {
  items: FileEntry[];
}

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
}

export function useDirectoryListing(
  servicesDomain: string | null,
  path: string,
) {
  const key =
    servicesDomain ? SWR_KEYS.directoryListing(servicesDomain, path) : null;
  const { data, error, isLoading, isValidating, mutate: revalidate } =
    useSWR<DirectoryListingResponse>(key, sandboxServiceFetcher, {
      revalidateOnFocus: false,
      dedupingInterval: 1000,
    });
  return {
    entries: data?.items ?? [],
    isLoading,
    isValidating,
    error: error as Error | undefined,
    revalidate,
  };
}


