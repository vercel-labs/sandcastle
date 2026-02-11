import { NextResponse } from "next/server";
import { extendSandboxTimeout, getSandbox } from "@/lib/sandbox/client";
import { getAuthedWorkspace } from "@/lib/api/get-authed-workspace";
import { markWorkspaceStopped } from "@/lib/sandbox/mark-workspace-stopped";
import { MAX_SANDBOX_LIFETIME_MS } from "@/lib/sandbox/limits";
import { enforceRateLimit, RATE_LIMIT_IDS } from "@/lib/rate-limit";

function isSandboxGone(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes("410") ||
    msg.includes("404") ||
    msg.includes("not found") ||
    msg.includes("gone") ||
    msg.includes("expired")
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await getAuthedWorkspace(params);
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  const rateLimited = await enforceRateLimit(
    RATE_LIMIT_IDS.sandboxExtend,
    req,
    result.session.id,
    result.session.role,
  );
  if (rateLimited) return rateLimited;

  if (!workspace.sandboxId) {
    return NextResponse.json(
      { error: "No active sandbox", sandboxLost: true },
      { status: 400 },
    );
  }

  const { duration = 10 * 60 * 1000 } = await req.json();

  try {
    const sandbox = await getSandbox(workspace.sandboxId);
    const createdAtMs = new Date(sandbox.createdAt).getTime();
    const currentEnd = createdAtMs + sandbox.timeout;
    const maxEnd = createdAtMs + MAX_SANDBOX_LIFETIME_MS;

    if (currentEnd >= maxEnd) {
      return NextResponse.json({
        ok: false,
        maxLifetimeReached: true,
        expiresAt: currentEnd,
      });
    }

    const allowedDuration = Math.min(duration, maxEnd - currentEnd);

    if (allowedDuration <= 0) {
      return NextResponse.json({
        ok: false,
        maxLifetimeReached: true,
        expiresAt: currentEnd,
      });
    }

    await extendSandboxTimeout(workspace.sandboxId, allowedDuration);
    return NextResponse.json({
      ok: true,
      extended: allowedDuration,
      maxLifetimeReached: currentEnd + allowedDuration >= maxEnd,
    });
  } catch (err) {
    const gone = isSandboxGone(err);
    console.warn(
      `[sandbox/${workspace.id}/extend] Failed to extend sandbox ${workspace.sandboxId}` +
        ` for workspace "${workspace.name}".` +
        ` ${gone ? "Sandbox is gone (expired/deleted)." : "Unexpected error."}` +
        ` Error: ${err instanceof Error ? err.message : err}`,
    );

    if (gone) {
      await markWorkspaceStopped(workspace.id);

      return NextResponse.json(
        {
          error: "Sandbox expired",
          sandboxLost: true,
          canRecover: !!workspace.snapshotId,
        },
        { status: 410 },
      );
    }

    return NextResponse.json(
      { error: "Failed to extend timeout" },
      { status: 500 },
    );
  }
}
