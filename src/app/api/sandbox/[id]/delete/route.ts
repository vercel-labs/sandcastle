import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { stopSandbox } from "@/lib/sandbox/client";
import { getAuthedWorkspace } from "@/lib/api/get-authed-workspace";
import { enforceRateLimit, RATE_LIMIT_IDS } from "@/lib/rate-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await getAuthedWorkspace(params);
  if (result instanceof NextResponse) return result;

  const rateLimited = await enforceRateLimit(
    RATE_LIMIT_IDS.sandboxDelete,
    req,
    result.session.id,
    result.session.role,
  );
  if (rateLimited) return rateLimited;
  const { session, workspace } = result;

  if (workspace.sandboxId) {
    try {
      await stopSandbox(workspace.sandboxId);
    } catch (err) {
      console.error("Stop sandbox error during delete:", err);
    }
  }

  await db
    .delete(workspaces)
    .where(and(eq(workspaces.id, workspace.id), eq(workspaces.userId, session.id)));

  return NextResponse.json({ ok: true });
}
