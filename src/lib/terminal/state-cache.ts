/**
 * Terminal state persistence via localStorage.
 *
 * Saves serialized terminal buffer content so it can be restored
 * when a terminal reconnects (e.g. workspace switch, page reload).
 * Each workspace gets its own cache entry.
 *
 * Cache entries expire after 30 minutes to avoid stale content.
 */

const CACHE_PREFIX = "sandcastle:terminal:";
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  state: string;
  savedAt: number;
}

export function saveTerminalState(
  workspaceId: string,
  serializedState: string,
): void {
  try {
    const entry: CacheEntry = {
      state: serializedState,
      savedAt: Date.now(),
    };
    localStorage.setItem(CACHE_PREFIX + workspaceId, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable -- silently skip
  }
}

export function loadTerminalState(workspaceId: string): string | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + workspaceId);
    if (!raw) return null;

    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(CACHE_PREFIX + workspaceId);
      return null;
    }
    return entry.state;
  } catch {
    return null;
  }
}

export function clearTerminalState(workspaceId: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + workspaceId);
  } catch {
    // ignore
  }
}
