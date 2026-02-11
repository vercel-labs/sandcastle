import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listSandboxes, snapshotSandbox, stopSandbox } from "@/lib/sandbox/client";

export const maxDuration = 120;

const EXPIRY_THRESHOLD = 10 * 60 * 1000; // 10 minutes

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { sandboxId: string; action: string; error?: string }[] = [];

  try {
    const sandboxes = await listSandboxes();
    const now = Date.now();

    // Build a map of sandboxId -> workspace for DB updates
    const activeWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.status, "active"));

    const workspaceBySandboxId = new Map(
      activeWorkspaces
        .filter((w) => w.sandboxId)
        .map((w) => [w.sandboxId!, w]),
    );

    for (const sandbox of sandboxes) {
      if (sandbox.status !== "running") continue;

      const expiresAt = sandbox.createdAt + sandbox.timeout;
      const timeLeft = expiresAt - now;

      if (timeLeft > EXPIRY_THRESHOLD) continue;

      const workspace = workspaceBySandboxId.get(sandbox.id);

      // Snapshot if we have a linked workspace, otherwise just stop it
      if (workspace) {
        try {
          const snapshotId = await snapshotSandbox(sandbox.id);
          await db
            .update(workspaces)
            .set({
              status: "snapshotted",
              sandboxId: null,
              snapshotId,
              updatedAt: new Date(),
            })
            .where(eq(workspaces.id, workspace.id));
          results.push({ sandboxId: sandbox.id, action: "snapshotted" });
        } catch (err) {
          const message = err instanceof Error ? err.message : "unknown";
          // Snapshot failed -- try to stop cleanly
          try {
            await stopSandbox(sandbox.id);
            await db
              .update(workspaces)
              .set({
                status: "stopped",
                sandboxId: null,
                updatedAt: new Date(),
              })
              .where(eq(workspaces.id, workspace.id));
            results.push({ sandboxId: sandbox.id, action: "stopped", error: `snapshot failed: ${message}` });
          } catch {
            results.push({ sandboxId: sandbox.id, action: "failed", error: message });
          }
        }
      } else {
        // Orphaned sandbox with no workspace -- stop it
        try {
          await stopSandbox(sandbox.id);
          results.push({ sandboxId: sandbox.id, action: "stopped-orphan" });
        } catch {
          results.push({ sandboxId: sandbox.id, action: "failed-orphan" });
        }
      }
    }

    console.log(`[cron:sandbox-lifecycle] Processed ${results.length} sandboxes`, results);
    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error("[cron:sandbox-lifecycle] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
