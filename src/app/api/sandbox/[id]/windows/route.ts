import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthedWorkspace } from "@/lib/api/get-authed-workspace";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await getAuthedWorkspace(params);
  if (result instanceof NextResponse) return result;
  const { workspace } = result;

  return NextResponse.json({ windows: workspace.windowState || [] });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await getAuthedWorkspace(params);
  if (result instanceof NextResponse) return result;
  const { session, workspace } = result;

  const { windows } = await req.json();

  await db
    .update(workspaces)
    .set({ windowState: windows, updatedAt: new Date() })
    .where(and(eq(workspaces.id, workspace.id), eq(workspaces.userId, session.id)));

  return NextResponse.json({ ok: true });
}
