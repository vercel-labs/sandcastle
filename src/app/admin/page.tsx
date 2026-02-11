"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface AdminStats {
  users: {
    total: number;
    guests: number;
    admins: number;
    regular: number;
  };
  workspaces: {
    total: number;
    active: number;
    stopped: number;
    snapshotted: number;
    creating: number;
    error: number;
  };
  warmPool: {
    total: number;
    available: number;
    claimed: number;
    expired: number;
  };
  userList: Array<{
    id: string;
    email: string | null;
    name: string | null;
    role: string;
    createdAt: string;
    workspaceCount: number;
  }>;
  recentWorkspaces: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    userName: string | null;
    userEmail: string | null;
  }>;
  usersByDay: Array<{ date: string; count: number }>;
  workspacesByStatus: Array<{ status: string; count: number }>;
}

interface SnapshotData {
  goldenSnapshot: {
    snapshotId: string | null;
    updatedAt: string | null;
  };
  pool: {
    target: number;
    total: number;
    available: number;
    claimed: number;
    expired: number;
    matchingSnapshot: number;
  };
  recentPoolEntries: Array<{
    id: string;
    sandboxId: string;
    snapshotId: string;
    status: string;
    claimedAt: string | null;
    createdAt: string;
  }>;
}

const statusColors: Record<string, "green" | "gray" | "blue" | "amber" | "red"> = {
  active: "green",
  stopped: "gray",
  snapshotted: "blue",
  creating: "amber",
  error: "red",
};

const roleColors: Record<string, "blue" | "purple" | "gray"> = {
  admin: "purple",
  user: "blue",
  guest: "gray",
};

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-alpha-400 bg-background-100 p-5">
      <p className="text-copy-13 text-gray-900">{title}</p>
      <p className="mt-1 text-[28px] font-semibold tracking-tight text-gray-1000">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-copy-13 text-gray-700">{subtitle}</p>
      )}
    </div>
  );
}

function BarChart({
  data,
  title,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  title: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="rounded-lg border border-gray-alpha-400 bg-background-100 p-5">
      <h3 className="text-label-14 font-medium text-gray-1000 mb-4">
        {title}
      </h3>
      <div className="flex items-end gap-3 h-40">
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-copy-13 text-gray-900 font-medium tabular-nums">
              {d.value}
            </span>
            <div className="w-full flex justify-center">
              <div
                className="w-10 rounded-t-md transition-all"
                style={{
                  height: `${Math.max((d.value / max) * 120, 4)}px`,
                  backgroundColor: d.color,
                }}
              />
            </div>
            <span className="text-[11px] text-gray-700 text-center leading-tight">
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AreaChart({
  data,
  title,
}: {
  data: Array<{ date: string; count: number }>;
  title: string;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-gray-alpha-400 bg-background-100 p-5">
        <h3 className="text-label-14 font-medium text-gray-1000 mb-4">
          {title}
        </h3>
        <p className="text-copy-13 text-gray-700">No data yet</p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);
  const width = 500;
  const height = 140;
  const padding = { top: 10, right: 10, bottom: 30, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padding.top + chartH - (d.count / max) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  return (
    <div className="rounded-lg border border-gray-alpha-400 bg-background-100 p-5">
      <h3 className="text-label-14 font-medium text-gray-1000 mb-4">
        {title}
      </h3>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <line
            key={tick}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + chartH * (1 - tick)}
            y2={padding.top + chartH * (1 - tick)}
            stroke="var(--ds-gray-alpha-200)"
            strokeWidth="1"
          />
        ))}

        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ds-blue-500)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--ds-blue-500)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#areaGrad)" />
        <path d={linePath} fill="none" stroke="var(--ds-blue-700)" strokeWidth="2" />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="var(--ds-blue-700)"
          />
        ))}

        {data.length <= 15 &&
          data.map((d, i) => (
            <text
              key={i}
              x={points[i].x}
              y={height - 5}
              textAnchor="middle"
              fontSize="9"
              fill="var(--ds-gray-700)"
            >
              {new Date(d.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </text>
          ))}

        {data.length > 15 &&
          [0, Math.floor(data.length / 2), data.length - 1].map((i) => (
            <text
              key={i}
              x={points[i].x}
              y={height - 5}
              textAnchor="middle"
              fontSize="9"
              fill="var(--ds-gray-700)"
            >
              {new Date(data[i].date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </text>
          ))}
      </svg>
    </div>
  );
}

function DonutChart({
  data,
  title,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  title: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="rounded-lg border border-gray-alpha-400 bg-background-100 p-5">
        <h3 className="text-label-14 font-medium text-gray-1000 mb-4">
          {title}
        </h3>
        <p className="text-copy-13 text-gray-700">No data yet</p>
      </div>
    );
  }

  const radius = 60;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="rounded-lg border border-gray-alpha-400 bg-background-100 p-5">
      <h3 className="text-label-14 font-medium text-gray-1000 mb-4">
        {title}
      </h3>
      <div className="flex items-center gap-6">
        <svg width="160" height="160" viewBox="0 0 160 160">
          {data.map((d) => {
            const pct = d.value / total;
            const dashArray = `${pct * circumference} ${circumference}`;
            const currentOffset = offset;
            offset += pct * circumference;
            return (
              <circle
                key={d.label}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={-currentOffset}
                strokeLinecap="butt"
                transform="rotate(-90 80 80)"
              />
            );
          })}
          <text
            x="80"
            y="80"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="24"
            fontWeight="600"
            fill="var(--ds-gray-1000)"
          >
            {total}
          </text>
        </svg>
        <div className="flex flex-col gap-2">
          {data.map((d) => (
            <div key={d.label} className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-copy-13 text-gray-900">
                {d.label}
              </span>
              <span className="text-copy-13 text-gray-700 tabular-nums">
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<
    "overview" | "users" | "workspaces" | "snapshots"
  >("overview");

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load stats");
        return r.json();
      })
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-copy-14 text-red-700">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-gray-alpha-400">
        {(["overview", "users", "workspaces", "snapshots"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-copy-14 font-medium capitalize transition-colors border-b-2 -mb-px cursor-pointer",
              tab === t
                ? "border-gray-1000 text-gray-1000"
                : "border-transparent text-gray-700 hover:text-gray-900"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab stats={stats} />}
      {tab === "users" && <UsersTab stats={stats} />}
      {tab === "workspaces" && <WorkspacesTab stats={stats} />}
      {tab === "snapshots" && <SnapshotsTab />}
    </div>
  );
}

function OverviewTab({ stats }: { stats: AdminStats }) {
  const chartColors = {
    active: "var(--ds-green-600)",
    stopped: "var(--ds-gray-600)",
    snapshotted: "var(--ds-blue-600)",
    creating: "var(--ds-amber-600)",
    error: "var(--ds-red-600)",
  };

  const roleChartColors = {
    admin: "var(--ds-purple-600)",
    user: "var(--ds-blue-600)",
    guest: "var(--ds-gray-500)",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={stats.users.total}
          subtitle={`${stats.users.regular} registered, ${stats.users.guests} guests`}
        />
        <StatCard
          title="Total Workspaces"
          value={stats.workspaces.total}
          subtitle={`${stats.workspaces.active} active`}
        />
        <StatCard
          title="Warm Pool"
          value={stats.warmPool.available}
          subtitle={`${stats.warmPool.available} available of ${stats.warmPool.total}`}
        />
        <StatCard
          title="Error Workspaces"
          value={stats.workspaces.error}
          subtitle="Workspaces in error state"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AreaChart data={stats.usersByDay} title="User Signups Over Time" />
        <DonutChart
          title="Workspaces by Status"
          data={stats.workspacesByStatus.map((d) => ({
            label: d.status,
            value: d.count,
            color:
              chartColors[d.status as keyof typeof chartColors] ??
              "var(--ds-gray-500)",
          }))}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DonutChart
          title="Users by Role"
          data={[
            {
              label: "Admin",
              value: stats.users.admins,
              color: roleChartColors.admin,
            },
            {
              label: "User",
              value: stats.users.regular,
              color: roleChartColors.user,
            },
            {
              label: "Guest",
              value: stats.users.guests,
              color: roleChartColors.guest,
            },
          ]}
        />
        <BarChart
          title="Warm Pool Distribution"
          data={[
            {
              label: "Available",
              value: stats.warmPool.available,
              color: "var(--ds-green-600)",
            },
            {
              label: "Claimed",
              value: stats.warmPool.claimed,
              color: "var(--ds-blue-600)",
            },
            {
              label: "Expired",
              value: stats.warmPool.expired,
              color: "var(--ds-gray-600)",
            },
          ]}
        />
      </div>
    </div>
  );
}

function UsersTab({ stats }: { stats: AdminStats }) {
  return (
    <div className="rounded-lg border border-gray-alpha-400 bg-background-100 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-alpha-400 bg-background-200">
            <th className="px-4 py-3 text-left text-label-13 font-medium text-gray-900">
              Name
            </th>
            <th className="px-4 py-3 text-left text-label-13 font-medium text-gray-900">
              Email
            </th>
            <th className="px-4 py-3 text-left text-label-13 font-medium text-gray-900">
              Role
            </th>
            <th className="px-4 py-3 text-right text-label-13 font-medium text-gray-900">
              Workspaces
            </th>
            <th className="px-4 py-3 text-right text-label-13 font-medium text-gray-900">
              Joined
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.userList.map((user) => (
            <tr
              key={user.id}
              className="border-b border-gray-alpha-200 last:border-0 hover:bg-gray-alpha-100 transition-colors"
            >
              <td className="px-4 py-3 text-copy-14 text-gray-1000">
                {user.name ?? "--"}
              </td>
              <td className="px-4 py-3 text-copy-14 text-gray-900">
                {user.email ?? "--"}
              </td>
              <td className="px-4 py-3">
                <Badge variant={roleColors[user.role] ?? "gray"} size="sm">
                  {user.role}
                </Badge>
              </td>
              <td className="px-4 py-3 text-copy-14 text-gray-900 text-right tabular-nums">
                {user.workspaceCount}
              </td>
              <td className="px-4 py-3 text-copy-13 text-gray-700 text-right">
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {stats.userList.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-8 text-center text-copy-14 text-gray-700"
              >
                No users found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function WorkspacesTab({ stats }: { stats: AdminStats }) {
  return (
    <div className="rounded-lg border border-gray-alpha-400 bg-background-100 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-alpha-400 bg-background-200">
            <th className="px-4 py-3 text-left text-label-13 font-medium text-gray-900">
              Name
            </th>
            <th className="px-4 py-3 text-left text-label-13 font-medium text-gray-900">
              Owner
            </th>
            <th className="px-4 py-3 text-left text-label-13 font-medium text-gray-900">
              Status
            </th>
            <th className="px-4 py-3 text-right text-label-13 font-medium text-gray-900">
              Created
            </th>
            <th className="px-4 py-3 text-right text-label-13 font-medium text-gray-900">
              Updated
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.recentWorkspaces.map((ws) => (
            <tr
              key={ws.id}
              className="border-b border-gray-alpha-200 last:border-0 hover:bg-gray-alpha-100 transition-colors"
            >
              <td className="px-4 py-3 text-copy-14 text-gray-1000 font-medium">
                {ws.name}
              </td>
              <td className="px-4 py-3 text-copy-14 text-gray-900">
                {ws.userEmail ?? ws.userName ?? "--"}
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant={statusColors[ws.status] ?? "gray"}
                  size="sm"
                >
                  {ws.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-copy-13 text-gray-700 text-right">
                {new Date(ws.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-copy-13 text-gray-700 text-right">
                {new Date(ws.updatedAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {stats.recentWorkspaces.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-8 text-center text-copy-14 text-gray-700"
              >
                No workspaces found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const poolStatusColors: Record<string, "green" | "blue" | "gray" | "amber"> = {
  available: "green",
  claimed: "blue",
  expired: "gray",
};

function SnapshotsTab() {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/golden-snapshot")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load snapshot data");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const runAction = async (action: string) => {
    setActionLoading(action);
    setActionResult(null);
    try {
      const r = await fetch("/api/admin/golden-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error ?? "Action failed");
      setActionResult({
        type: "success",
        message:
          action === "rebuild"
            ? `New snapshot created: ${result.snapshotId}`
            : action === "replenish"
              ? `Pool replenished: ${result.created} created (${result.existing} existing, target ${result.target})`
              : `Pool pruned: ${result.pruned} expired`,
      });
      fetchData();
    } catch (e) {
      setActionResult({
        type: "error",
        message: e instanceof Error ? e.message : "Action failed",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-copy-14 text-red-700">Failed to load snapshot data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actionResult && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-copy-14",
            actionResult.type === "success"
              ? "border-green-300 bg-green-100 text-green-900"
              : "border-red-300 bg-red-100 text-red-900"
          )}
        >
          {actionResult.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-alpha-400 bg-background-100 p-5 space-y-4">
          <h3 className="text-label-14 font-medium text-gray-1000">
            Golden Snapshot
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-copy-13 text-gray-700">Snapshot ID</span>
              <code className="text-copy-13 text-gray-1000 bg-gray-alpha-100 px-2 py-0.5 rounded font-mono">
                {data.goldenSnapshot.snapshotId
                  ? `${data.goldenSnapshot.snapshotId.slice(0, 20)}...`
                  : "None"}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-copy-13 text-gray-700">Last Updated</span>
              <span className="text-copy-13 text-gray-1000">
                {data.goldenSnapshot.updatedAt
                  ? new Date(data.goldenSnapshot.updatedAt).toLocaleString()
                  : "Never"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-copy-13 text-gray-700">
                Pool VMs on this snapshot
              </span>
              <span className="text-copy-13 text-gray-1000 tabular-nums">
                {data.pool.matchingSnapshot}
              </span>
            </div>
          </div>
          <div className="pt-2 flex gap-2">
            <Button
              size="small"
              variant="default"
              loading={actionLoading === "rebuild"}
              disabled={actionLoading !== null}
              onClick={() => runAction("rebuild")}
            >
              Rebuild Snapshot
            </Button>
          </div>
          {actionLoading === "rebuild" && (
            <p className="text-copy-13 text-amber-700">
              Building golden snapshot... this takes 3-8 minutes.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-gray-alpha-400 bg-background-100 p-5 space-y-4">
          <h3 className="text-label-14 font-medium text-gray-1000">
            Warm Pool
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-copy-13 text-gray-700">Available</p>
              <p className="text-[24px] font-semibold tracking-tight text-green-700 tabular-nums">
                {data.pool.available}
              </p>
            </div>
            <div>
              <p className="text-copy-13 text-gray-700">Target</p>
              <p className="text-[24px] font-semibold tracking-tight text-gray-1000 tabular-nums">
                {data.pool.target}
              </p>
            </div>
            <div>
              <p className="text-copy-13 text-gray-700">Claimed</p>
              <p className="text-[24px] font-semibold tracking-tight text-blue-700 tabular-nums">
                {data.pool.claimed}
              </p>
            </div>
            <div>
              <p className="text-copy-13 text-gray-700">Expired</p>
              <p className="text-[24px] font-semibold tracking-tight text-gray-700 tabular-nums">
                {data.pool.expired}
              </p>
            </div>
          </div>
          <div className="pt-2 flex gap-2">
            <Button
              size="small"
              variant="secondary"
              loading={actionLoading === "replenish"}
              disabled={actionLoading !== null}
              onClick={() => runAction("replenish")}
            >
              Replenish Pool
            </Button>
            <Button
              size="small"
              variant="ghost"
              loading={actionLoading === "prune"}
              disabled={actionLoading !== null}
              onClick={() => runAction("prune")}
            >
              Prune Stale
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-alpha-400 bg-background-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-alpha-400 bg-background-200">
          <h3 className="text-label-14 font-medium text-gray-1000">
            Recent Pool Entries
          </h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-alpha-400 bg-background-200">
              <th className="px-4 py-3 text-left text-label-13 font-medium text-gray-900">
                Sandbox ID
              </th>
              <th className="px-4 py-3 text-left text-label-13 font-medium text-gray-900">
                Snapshot
              </th>
              <th className="px-4 py-3 text-left text-label-13 font-medium text-gray-900">
                Status
              </th>
              <th className="px-4 py-3 text-right text-label-13 font-medium text-gray-900">
                Created
              </th>
              <th className="px-4 py-3 text-right text-label-13 font-medium text-gray-900">
                Claimed
              </th>
            </tr>
          </thead>
          <tbody>
            {data.recentPoolEntries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-gray-alpha-200 last:border-0 hover:bg-gray-alpha-100 transition-colors"
              >
                <td className="px-4 py-3 text-copy-13 text-gray-1000 font-mono">
                  {entry.sandboxId.slice(0, 16)}...
                </td>
                <td className="px-4 py-3 text-copy-13 text-gray-700 font-mono">
                  {entry.snapshotId === data.goldenSnapshot.snapshotId ? (
                    <Badge variant="green" size="sm">
                      current
                    </Badge>
                  ) : (
                    <span>{entry.snapshotId.slice(0, 12)}...</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={poolStatusColors[entry.status] ?? "gray"}
                    size="sm"
                  >
                    {entry.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-copy-13 text-gray-700 text-right">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-copy-13 text-gray-700 text-right">
                  {entry.claimedAt
                    ? new Date(entry.claimedAt).toLocaleString()
                    : "--"}
                </td>
              </tr>
            ))}
            {data.recentPoolEntries.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-copy-14 text-gray-700"
                >
                  No pool entries
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
