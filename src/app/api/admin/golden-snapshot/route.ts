import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { config, warmPool } from "@/lib/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import {
  getGoldenSnapshotId,
} from "@/lib/sandbox/golden-snapshot";
import { buildGoldenSnapshot } from "@/lib/sandbox/build-golden-snapshot";
import {
  replenishPool,
  expireOldSnapshotVMs,
  prunePool,
} from "@/lib/sandbox/warm-pool";

export const maxDuration = 600;

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snapshotId = await getGoldenSnapshotId();

  const [configRow] = await db
    .select()
    .from(config)
    .where(eq(config.key, "golden_snapshot_id"));

  const staleThreshold = new Date(Date.now() - 15 * 60 * 1000);

  const [poolStats] = await db
    .select({
      total: count(),
      available: count(
        sql`CASE WHEN ${warmPool.status} = 'available' AND ${warmPool.createdAt} > ${staleThreshold} THEN 1 END`
      ),
      claimed: count(
        sql`CASE WHEN ${warmPool.status} = 'claimed' THEN 1 END`
      ),
      expired: count(
        sql`CASE WHEN ${warmPool.status} = 'expired' THEN 1 END`
      ),
      matchingSnapshot: count(
        sql`CASE WHEN ${warmPool.snapshotId} = ${snapshotId ?? ""} AND ${warmPool.status} = 'available' THEN 1 END`
      ),
    })
    .from(warmPool);

  const recentPoolEntries = await db
    .select({
      id: warmPool.id,
      sandboxId: warmPool.sandboxId,
      snapshotId: warmPool.snapshotId,
      status: warmPool.status,
      claimedAt: warmPool.claimedAt,
      createdAt: warmPool.createdAt,
    })
    .from(warmPool)
    .orderBy(sql`${warmPool.createdAt} DESC`)
    .limit(20);

  return NextResponse.json({
    goldenSnapshot: {
      snapshotId,
      updatedAt: configRow?.updatedAt?.toISOString() ?? null,
    },
    pool: {
      target: 15,
      ...poolStats,
    },
    recentPoolEntries,
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (action === "rebuild") {
    const result = await buildGoldenSnapshot({
      installScript: body.installScript,
      logPrefix: "admin:golden-snapshot",
    });

    await expireOldSnapshotVMs();
    await prunePool();
    const pool = await replenishPool();

    return NextResponse.json({ ok: true, ...result, pool });
  }

  if (action === "replenish") {
    await expireOldSnapshotVMs();
    await prunePool();
    const result = await replenishPool();
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === "prune") {
    await expireOldSnapshotVMs();
    const pruned = await prunePool();
    return NextResponse.json({ ok: true, pruned });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
