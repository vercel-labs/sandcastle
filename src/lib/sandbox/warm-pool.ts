import { db } from "@/lib/db/client";
import { warmPool } from "@/lib/db/schema";
import { eq, and, sql, count, ne } from "drizzle-orm";
import { getGoldenSnapshotId } from "./golden-snapshot";
import { createSandbox, getSandbox } from "./client";
import type { SandboxInfo } from "@/types/sandbox";

const WARM_POOL_TARGET = 15;
const WARM_VM_MAX_AGE_MS = 45 * 60 * 1000; // 45 min (sandboxes timeout at 60)

/**
 * Claim a warm VM from the pool. Returns SandboxInfo if one was available,
 * null otherwise (caller should fall back to on-demand creation).
 *
 * Uses an atomic UPDATE ... LIMIT 1 to avoid races between concurrent claims.
 */
export async function claimWarmVM(): Promise<SandboxInfo | null> {
  const staleThreshold = new Date(Date.now() - WARM_VM_MAX_AGE_MS);

  // Atomic claim: grab the oldest available VM that isn't stale
  const [claimed] = await db
    .update(warmPool)
    .set({ status: "claimed", claimedAt: new Date() })
    .where(
      and(
        eq(warmPool.status, "available"),
        sql`${warmPool.createdAt} > ${staleThreshold}`,
        sql`${warmPool.id} = (
          SELECT ${warmPool.id} FROM ${warmPool}
          WHERE ${warmPool.status} = 'available'
            AND ${warmPool.createdAt} > ${staleThreshold}
          ORDER BY ${warmPool.createdAt} ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )`,
      ),
    )
    .returning();

  if (!claimed) return null;

  try {
    const info = await getSandbox(claimed.sandboxId);
    return info;
  } catch {
    // Sandbox may have died/expired -- mark it and return null
    await db
      .update(warmPool)
      .set({ status: "expired" })
      .where(eq(warmPool.id, claimed.id));
    return null;
  }
}

/**
 * Replenish the warm pool up to WARM_POOL_TARGET.
 * Creates sandboxes from the golden snapshot with services started.
 * Returns how many were created.
 */
export async function replenishPool(): Promise<{
  created: number;
  target: number;
  existing: number;
}> {
  const snapshotId = await getGoldenSnapshotId();
  if (!snapshotId) {
    return { created: 0, target: WARM_POOL_TARGET, existing: 0 };
  }

  const staleThreshold = new Date(Date.now() - WARM_VM_MAX_AGE_MS);

  // Count currently available (non-stale) VMs matching the current snapshot
  const [{ available }] = await db
    .select({ available: count() })
    .from(warmPool)
    .where(
      and(
        eq(warmPool.status, "available"),
        eq(warmPool.snapshotId, snapshotId),
        sql`${warmPool.createdAt} > ${staleThreshold}`,
      ),
    );

  const needed = WARM_POOL_TARGET - available;
  if (needed <= 0) {
    return { created: 0, target: WARM_POOL_TARGET, existing: available };
  }

  const CONCURRENCY = 5;
  let created = 0;

  for (let i = 0; i < needed; i += CONCURRENCY) {
    const batch = Array.from({ length: Math.min(CONCURRENCY, needed - i) }, () =>
      createSandbox(snapshotId)
        .then(async (sandbox) => {
          await db.insert(warmPool).values({
            sandboxId: sandbox.sandboxId,
            snapshotId,
            status: "available",
          });
          created++;
        })
        .catch((err) => {
          console.error("[warm-pool] Failed to create warm VM:", err);
        }),
    );
    await Promise.all(batch);
  }

  return { created, target: WARM_POOL_TARGET, existing: available };
}

/**
 * Clean up stale/expired pool entries.
 * Marks old available VMs as expired so they aren't claimed.
 */
export async function prunePool(): Promise<number> {
  const staleThreshold = new Date(Date.now() - WARM_VM_MAX_AGE_MS);

  const stale = await db
    .update(warmPool)
    .set({ status: "expired" })
    .where(
      and(
        eq(warmPool.status, "available"),
        sql`${warmPool.createdAt} <= ${staleThreshold}`,
      ),
    )
    .returning();

  // Clean up all non-available rows older than 24h (just housekeeping)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db
    .delete(warmPool)
    .where(sql`${warmPool.createdAt} <= ${dayAgo}`);

  return stale.length;
}

/**
 * Expire pool VMs that belong to a snapshot other than the current golden one.
 * Call this *after* replenishPool() so new VMs are available before old ones
 * are removed (zero-downtime rotation).
 */
export async function expireOldSnapshotVMs(): Promise<number> {
  const snapshotId = await getGoldenSnapshotId();
  if (!snapshotId) return 0;

  const expired = await db
    .update(warmPool)
    .set({ status: "expired" })
    .where(
      and(
        eq(warmPool.status, "available"),
        ne(warmPool.snapshotId, snapshotId),
      ),
    )
    .returning();

  return expired.length;
}

/**
 * Trigger a background replenish. Fire-and-forget via internal API call
 * so it doesn't block the current request.
 */
export function triggerBackgroundReplenish(baseUrl: string): void {
  const url = `${baseUrl}/api/pool/replenish`;
  fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
  }).catch((err) => {
    console.error("[warm-pool] Background replenish failed:", err);
  });
}

/**
 * Get current pool stats for debugging.
 */
export async function getPoolStats() {
  const staleThreshold = new Date(Date.now() - WARM_VM_MAX_AGE_MS);

  const [[{ available }], [{ total }]] = await Promise.all([
    db
      .select({ available: count() })
      .from(warmPool)
      .where(
        and(
          eq(warmPool.status, "available"),
          sql`${warmPool.createdAt} > ${staleThreshold}`,
        ),
      ),
    db.select({ total: count() }).from(warmPool),
  ]);

  return { available, total, target: WARM_POOL_TARGET };
}
