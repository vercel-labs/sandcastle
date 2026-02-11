"use client";

import { useCallback, useMemo } from "react";
import { useActiveSandbox } from "@/stores/workspace-store";

/**
 * Shared error class for sandbox service failures.
 * Carries the HTTP status so callers (e.g. SWR `onErrorRetry`) can
 * distinguish permanent failures (404/410) from transient ones.
 */
export class SandboxServiceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SandboxServiceError";
    this.status = status;
  }
}

/**
 * SWR-compatible fetcher for sandbox service URLs.
 * Expects the full URL as the key (e.g. `https://<domain>/packages/search`).
 */
export async function sandboxServiceFetcher<T = unknown>(
  url: string,
): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let message = `Sandbox service error (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {}
    throw new SandboxServiceError(message, res.status);
  }
  return res.json();
}

/**
 * POST to a sandbox service endpoint. Returns the parsed JSON body.
 * Throws `SandboxServiceError` on non-OK responses.
 */
export async function sandboxServicePost<T = unknown>(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok || (data as { error?: string }).error) {
    const message =
      (data as { error?: string }).error ||
      `Sandbox service error (${res.status})`;
    throw new SandboxServiceError(message, res.status);
  }
  return data as T;
}

/**
 * Standard SWR `onErrorRetry` for sandbox service calls.
 * Stops retrying on 404/410 (endpoint missing or sandbox gone),
 * caps retries at 3 with exponential backoff.
 */
export function sandboxServiceOnErrorRetry(
  error: Error & { status?: number },
  _key: string,
  _config: unknown,
  revalidate: (opts: { retryCount: number }) => void,
  { retryCount }: { retryCount: number },
) {
  if (error.status === 410 || error.status === 404) return;
  if (retryCount >= 3) return;
  setTimeout(
    () => revalidate({ retryCount }),
    5000 * Math.min(retryCount + 1, 3),
  );
}

/**
 * Builds the full sandbox service URL for a given path.
 * Returns `null` when no services domain is available.
 */
export function buildServiceUrl(
  servicesDomain: string | null | undefined,
  path: string,
): string | null {
  if (!servicesDomain) return null;
  return `https://${servicesDomain}${path}`;
}

/**
 * React hook that provides a sandbox service client bound to the active
 * workspace's services domain.
 *
 * - `serviceUrl(path)` — builds a full URL, or `null` when offline
 * - `fetcher` — SWR-compatible GET fetcher
 * - `post(path, body)` — POST mutation helper
 * - `servicesDomain` — raw domain string (for SWR key construction)
 */
export function useSandboxServiceClient() {
  const { sandbox } = useActiveSandbox();
  const servicesDomain = sandbox?.domains?.services ?? null;

  const serviceUrl = useCallback(
    (path: string): string | null => buildServiceUrl(servicesDomain, path),
    [servicesDomain],
  );

  const post = useCallback(
    async <T = unknown>(path: string, body: Record<string, unknown>) => {
      if (!servicesDomain) throw new Error("No active sandbox");
      return sandboxServicePost<T>(
        `https://${servicesDomain}`,
        path,
        body,
      );
    },
    [servicesDomain],
  );

  return useMemo(
    () => ({
      servicesDomain,
      serviceUrl,
      fetcher: sandboxServiceFetcher,
      post,
    }),
    [servicesDomain, serviceUrl, post],
  );
}
