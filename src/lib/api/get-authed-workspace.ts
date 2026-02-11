import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type WorkspaceRow = typeof workspaces.$inferSelect;

type AuthedWorkspaceResult =
  | { session: { id: string; email: string | null; role: string }; workspace: WorkspaceRow }
  | NextResponse;

export async function getAuthedWorkspace(
  params: Promise<{ id: string }>,
): Promise<AuthedWorkspaceResult> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const conditions = and(eq(workspaces.id, id), eq(workspaces.userId, session.id));

  const [workspace] = await db.select().from(workspaces).where(conditions);

  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return { session, workspace };
}
