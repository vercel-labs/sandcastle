export const WORKSPACE_LIMITS: Record<string, number> = {
  guest: 1,
  user: 3,
  admin: Infinity,
};

export const MAX_SANDBOX_LIFETIME_MS = 60 * 60 * 1000; // 1 hour max
