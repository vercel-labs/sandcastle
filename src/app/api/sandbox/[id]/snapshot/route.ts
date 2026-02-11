import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { snapshotSandbox } from "@/lib/sandbox/client";
import { getAuthedWorkspace } from "@/lib/api/get-authed-workspace";
import { enforceRateLimit, RATE_LIMIT_IDS } from "@/lib/rate-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await getAuthedWorkspace(params);
  if (result instanceof NextResponse) return result;

  const rateLimited = await enforceRateLimit(
    RATE_LIMIT_IDS.sandboxSnapshot,
    req,
    result.session.id,
    result.session.role,
  );
  if (rateLimited) return rateLimited;
  const { workspace } = result;

  if (!workspace.sandboxId) {
    return NextResponse.json(
      { error: "No active sandbox to snapshot" },
      { status: 400 },
    );
  }

  try {
    const snapshotId = await snapshotSandbox(workspace.sandboxId);

    await db
      .update(workspaces)
      .set({
        status: "snapshotted",
        sandboxId: null,
        snapshotId,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspace.id));

    return NextResponse.json({ snapshotId });
  } catch (err) {
    console.error("Snapshot error:", err);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 },
    );
  }
}
