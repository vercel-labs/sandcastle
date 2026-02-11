import { NextResponse } from "next/server";
import { stopSandbox } from "@/lib/sandbox/client";
import { getAuthedWorkspace } from "@/lib/api/get-authed-workspace";
import { markWorkspaceStopped } from "@/lib/sandbox/mark-workspace-stopped";
import { enforceRateLimit, RATE_LIMIT_IDS } from "@/lib/rate-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await getAuthedWorkspace(params);
  if (result instanceof NextResponse) return result;

  const rateLimited = await enforceRateLimit(
    RATE_LIMIT_IDS.sandboxStop,
    req,
    result.session.id,
    result.session.role,
  );
  if (rateLimited) return rateLimited;
  const { workspace } = result;

  if (workspace.sandboxId) {
    try {
      await stopSandbox(workspace.sandboxId);
    } catch (err) {
      console.error("Stop sandbox error:", err);
    }
  }

  await markWorkspaceStopped(workspace.id);

  return NextResponse.json({ ok: true });
}
