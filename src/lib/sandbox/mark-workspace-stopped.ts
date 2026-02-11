import { db } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Mark a workspace as stopped with no active sandbox in the database.
 * Centralizes the DB update that was previously duplicated across
 * GET /api/sandbox/[id], POST /api/sandbox/[id]/stop, and
 * POST /api/sandbox/[id]/extend.
 */
export async function markWorkspaceStopped(workspaceId: string) {
  await db
    .update(workspaces)
    .set({ status: "stopped", sandboxId: null, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId));
}
