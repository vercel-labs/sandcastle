import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { workspaces } from "@/lib/db/schema";
import { eq, count, inArray, and } from "drizzle-orm";
import { createSandbox } from "@/lib/sandbox/client";
import { getGoldenSnapshotId } from "@/lib/sandbox/golden-snapshot";
import {
  claimWarmVM,
  triggerBackgroundReplenish,
} from "@/lib/sandbox/warm-pool";
import { WORKSPACE_ICON_NAMES, generateWorkspaceName } from "@/types/workspace";
import { WORKSPACE_LIMITS } from "@/lib/sandbox/limits";
import { enforceRateLimit, RATE_LIMIT_IDS } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(
    RATE_LIMIT_IDS.sandboxCreate,
    req,
    session.id,
    session.role,
  );
  if (rateLimited) return rateLimited;

  const ipRateLimited = await enforceRateLimit(
    RATE_LIMIT_IDS.sandboxCreateIp,
    req,
    undefined,
    session.role,
  );
  if (ipRateLimited) return ipRateLimited;

  try {
    const { name, icon, snapshotId: explicitSnapshotId, workspaceId } = await req.json();

    // ---- Reconnect path: reuse an existing workspace row ----
    if (workspaceId) {
      const [existingWorkspace] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId));

      if (!existingWorkspace || existingWorkspace.userId !== session.id) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
      }

      const snapshotId = explicitSnapshotId || existingWorkspace.snapshotId || (await getGoldenSnapshotId()) || undefined;
      let sandbox = !explicitSnapshotId ? await claimWarmVM() : null;
      if (!sandbox) {
        sandbox = await createSandbox(snapshotId);
      }

      const h = await headers();
      const host = h.get("host");
      const proto = h.get("x-forwarded-proto") || "https";
      if (host) triggerBackgroundReplenish(`${proto}://${host}`);

      const [updated] = await db
        .update(workspaces)
        .set({
          sandboxId: sandbox.sandboxId,
          snapshotId: snapshotId || existingWorkspace.snapshotId,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, workspaceId))
        .returning();

      const fallback = "fallback" in sandbox ? (sandbox.fallback ?? false) : false;
      return NextResponse.json({ workspace: updated, sandbox, fallback });
    }

    // ---- Normal create path: new workspace ----

    // Enforce per-user workspace limit (only count workspaces consuming resources)
    const limit = WORKSPACE_LIMITS[session.role] ?? WORKSPACE_LIMITS.user;
    if (limit !== Infinity) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.userId, session.id),
            inArray(workspaces.status, ["active", "creating"]),
          ),
        );
      if (total >= limit) {
        return NextResponse.json(
          {
            error: "Workspace limit reached",
            limit,
            current: total,
            isGuest: session.role === "guest",
          },
          { status: 429 },
        );
      }
    }

    const randomIcon = WORKSPACE_ICON_NAMES[Math.floor(Math.random() * WORKSPACE_ICON_NAMES.length)];
    let wsName = name || generateWorkspaceName();

    // Ensure unique name per user (for URL slugs)
    const existing = await db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.userId, session.id));
    const existingNames = new Set(existing.map((w) => w.name.toLowerCase()));
    if (existingNames.has(wsName.toLowerCase())) {
      let suffix = 2;
      while (existingNames.has(`${wsName} ${suffix}`.toLowerCase())) suffix++;
      wsName = `${wsName} ${suffix}`;
    }

    // Start DB insert and snapshot lookup in parallel
    const [insertResult, goldenSnapshotId] = await Promise.all([
      db
        .insert(workspaces)
        .values({
          userId: session.id,
          name: wsName,
          icon: icon || randomIcon,
          status: "creating",
        })
        .returning(),
      explicitSnapshotId
        ? Promise.resolve(explicitSnapshotId)
        : getGoldenSnapshotId(),
    ]);

    const [workspace] = insertResult;
    const snapshotId = explicitSnapshotId || goldenSnapshotId || undefined;

    let sandbox;
    try {
      // Try to claim a pre-warmed VM from the pool (only for golden snapshot creates)
      sandbox = !explicitSnapshotId ? await claimWarmVM() : null;

      if (!sandbox) {
        // Pool empty or explicit snapshot -- create on-demand
        sandbox = await createSandbox(snapshotId);
      }
    } catch (provisionErr) {
      // Clean up the orphaned workspace row so it doesn't count toward limits
      await db.delete(workspaces).where(eq(workspaces.id, workspace.id));
      console.error("Sandbox provisioning failed, cleaned up workspace row:", provisionErr);
      return NextResponse.json(
        { error: "Failed to create sandbox" },
        { status: 500 },
      );
    }

    // Trigger background replenish (ISR-style: don't block the response)
    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) {
      triggerBackgroundReplenish(`${proto}://${host}`);
    }

    const [updated] = await db
      .update(workspaces)
      .set({
        sandboxId: sandbox.sandboxId,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspace.id))
      .returning();

    return NextResponse.json({
      workspace: updated,
      sandbox,
      fallback: "fallback" in sandbox ? (sandbox.fallback ?? false) : false,
    });
  } catch (err) {
    console.error("Create sandbox error:", err);
    return NextResponse.json(
      { error: "Failed to create sandbox" },
      { status: 500 },
    );
  }
}
