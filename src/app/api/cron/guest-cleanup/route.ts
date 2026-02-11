import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users, workspaces } from "@/lib/db/schema";
import { eq, and, lt, sql } from "drizzle-orm";

export const maxDuration = 60;

const GUEST_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const staleThreshold = new Date(Date.now() - GUEST_MAX_AGE_MS);

    const deleted = await db
      .delete(users)
      .where(
        and(
          eq(users.role, "guest"),
          lt(users.createdAt, staleThreshold),
          sql`NOT EXISTS (
            SELECT 1 FROM ${workspaces}
            WHERE ${workspaces.userId} = ${users.id}
          )`,
        ),
      )
      .returning({ id: users.id });

    console.log(
      `[cron:guest-cleanup] Deleted ${deleted.length} orphaned guest users`,
    );

    return NextResponse.json({ ok: true, deleted: deleted.length });
  } catch (err) {
    console.error("[cron:guest-cleanup] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
