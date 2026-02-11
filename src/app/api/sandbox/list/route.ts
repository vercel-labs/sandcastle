import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const items = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.userId, session.id))
    .orderBy(workspaces.createdAt);

  return NextResponse.json({ workspaces: items });
}
