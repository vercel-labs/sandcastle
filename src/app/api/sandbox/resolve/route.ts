import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { isUUID, slugify } from "@/lib/workspace-slug";

/**
 * GET /api/sandbox/resolve?slug=my-workspace
 *
 * Resolves a workspace slug (URL-safe name) or UUID to a workspace ID.
 * Only returns workspaces owned by the current user.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  // If it's a UUID, look up directly
  if (isUUID(slug)) {
    const [ws] = await db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.id, slug), eq(workspaces.userId, session.id)))
      .limit(1);

    if (!ws) {
      const [foreign] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, slug))
        .limit(1);

      if (foreign) {
        return NextResponse.json({ error: "Access denied", code: "FORBIDDEN" }, { status: 403 });
      }
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({
      workspace: ws,
      slug: slugify(ws.name),
    });
  }

  // Otherwise, match by slugified name (case-insensitive)
  const candidateWorkspaces = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.userId, session.id));

  const targetSlug = slugify(slug);
  const match = candidateWorkspaces.find((ws) => slugify(ws.name) === targetSlug);

  if (match) {
    return NextResponse.json({
      workspace: match,
      slug: targetSlug,
    });
  }

  return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
}
