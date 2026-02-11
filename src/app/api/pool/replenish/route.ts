import { NextResponse } from "next/server";
import {
  replenishPool,
  prunePool,
  expireOldSnapshotVMs,
} from "@/lib/sandbox/warm-pool";

export const maxDuration = 300;

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Replenish first so new VMs are ready before clearing old ones
    const replenishResult = await replenishPool();
    const [expiredOld, pruned] = await Promise.all([
      expireOldSnapshotVMs(),
      prunePool(),
    ]);

    return NextResponse.json({
      ok: true,
      ...replenishResult,
      expiredOld,
      pruned,
    });
  } catch (err) {
    console.error("[pool:replenish] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to replenish pool",
      },
      { status: 500 },
    );
  }
}
