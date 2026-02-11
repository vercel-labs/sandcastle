import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  replenishPool,
  prunePool,
  expireOldSnapshotVMs,
} from "@/lib/sandbox/warm-pool";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Replenish first so new VMs are ready before clearing old ones
    const result = await replenishPool();
    const expiredOld = await expireOldSnapshotVMs();
    const pruned = await prunePool();

    console.log(
      `[cron:warm-pool] Created ${result.created}/${result.target - result.existing} needed (${result.existing} existed), expired ${expiredOld} old-snapshot VMs, pruned ${pruned} stale`,
    );

    return NextResponse.json({ ok: true, pruned, expiredOld, ...result });
  } catch (err) {
    console.error("[cron:warm-pool] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to maintain warm pool",
      },
      { status: 500 },
    );
  }
}
