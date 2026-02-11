import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSandbox } from "@/lib/sandbox/client";
import type { SandboxInfo } from "@/types/sandbox";

type AuthedSandboxResult = { sandbox: SandboxInfo } | NextResponse;

export async function getAuthedSandbox(
  workspaceId: string | null,
): Promise<AuthedSandboxResult> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 },
    );
  }

  const conditions = and(eq(workspaces.id, workspaceId), eq(workspaces.userId, session.id));

  const [workspace] = await db.select().from(workspaces).where(conditions);

  if (!workspace?.sandboxId) {
    return NextResponse.json({ error: "No active sandbox" }, { status: 400 });
  }

  const sandbox = await getSandbox(workspace.sandboxId);
  return { sandbox };
}
