export const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error("Fetch failed");
    try {
      const body = await res.json();
      if (body.error) error.message = body.error;
    } catch {}
    throw error;
  }
  return res.json();
};

export const SWR_KEYS = {
  user: "/api/auth/me",
  workspaces: "/api/sandbox/list",
  workspace: (id: string) => `/api/sandbox/${id}`,
  windows: (id: string) => `/api/sandbox/${id}/windows`,
  desktopEntries: (servicesDomain: string) =>
    `https://${servicesDomain}/desktop-entries`,
  directoryListing: (servicesDomain: string, path: string) =>
    `https://${servicesDomain}/files/list?path=${encodeURIComponent(path)}`,
} as const;
