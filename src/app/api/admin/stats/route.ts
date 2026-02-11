import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users, workspaces, warmPool, accounts } from "@/lib/db/schema";
import { eq, sql, count } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    userStats,
    workspaceStats,
    warmPoolStats,
    userList,
    recentWorkspaces,
    usersByDay,
    workspacesByStatus,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        guests: count(sql`CASE WHEN ${users.role} = 'guest' THEN 1 END`),
        admins: count(sql`CASE WHEN ${users.role} = 'admin' THEN 1 END`),
        regular: count(sql`CASE WHEN ${users.role} = 'user' THEN 1 END`),
      })
      .from(users),

    db
      .select({
        total: count(),
        active: count(
          sql`CASE WHEN ${workspaces.status} = 'active' THEN 1 END`
        ),
        stopped: count(
          sql`CASE WHEN ${workspaces.status} = 'stopped' THEN 1 END`
        ),
        snapshotted: count(
          sql`CASE WHEN ${workspaces.status} = 'snapshotted' THEN 1 END`
        ),
        creating: count(
          sql`CASE WHEN ${workspaces.status} = 'creating' THEN 1 END`
        ),
        error: count(
          sql`CASE WHEN ${workspaces.status} = 'error' THEN 1 END`
        ),
      })
      .from(workspaces),

    db
      .select({
        total: count(),
        available: count(
          sql`CASE WHEN ${warmPool.status} = 'available' THEN 1 END`
        ),
        claimed: count(
          sql`CASE WHEN ${warmPool.status} = 'claimed' THEN 1 END`
        ),
        expired: count(
          sql`CASE WHEN ${warmPool.status} = 'expired' THEN 1 END`
        ),
      })
      .from(warmPool),

    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
        workspaceCount: count(workspaces.id),
      })
      .from(users)
      .leftJoin(workspaces, eq(users.id, workspaces.userId))
      .groupBy(users.id, users.email, users.name, users.role, users.createdAt)
      .orderBy(sql`${users.createdAt} DESC`)
      .limit(100),

    db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        status: workspaces.status,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(workspaces)
      .leftJoin(users, eq(workspaces.userId, users.id))
      .orderBy(sql`${workspaces.updatedAt} DESC`)
      .limit(50),

    db
      .select({
        date: sql<string>`DATE(${users.createdAt})`.as("date"),
        count: count(),
      })
      .from(users)
      .groupBy(sql`DATE(${users.createdAt})`)
      .orderBy(sql`DATE(${users.createdAt}) ASC`)
      .limit(30),

    db
      .select({
        status: workspaces.status,
        count: count(),
      })
      .from(workspaces)
      .groupBy(workspaces.status),
  ]);

  return NextResponse.json({
    users: userStats[0],
    workspaces: workspaceStats[0],
    warmPool: warmPoolStats[0],
    userList,
    recentWorkspaces,
    usersByDay,
    workspacesByStatus,
  });
}
