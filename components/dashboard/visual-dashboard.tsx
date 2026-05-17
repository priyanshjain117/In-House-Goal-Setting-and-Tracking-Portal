"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  Gauge,
  Lock,
  TimerReset,
  Unlock
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { buildActivityFeed, buildDashboardAnalytics, buildExportRows, type ExportRow } from "@/lib/domain/analytics";
import type { AchievementUpdate, Goal, ManagerReview, Role, User } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Props = {
  role: Role;
  currentUser: User;
  users: User[];
  goals: Goal[];
  reviews: ManagerReview[];
  achievements: AchievementUpdate[];
};

const chartColors = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#14b8a6", "#64748b", "#8b5cf6", "#ec4899"];
const statusColors = {
  Draft: "#64748b",
  Pending: "#f59e0b",
  Approved: "#10b981",
  Returned: "#ef4444"
};

export function VisualDashboard({ role, currentUser, users, goals, reviews, achievements }: Props) {
  const analytics = buildDashboardAnalytics(role, currentUser, users, goals, reviews, achievements);
  const activity = buildActivityFeed(users, analytics.visibleGoals, reviews, achievements);
  const title = role === "employee" ? "Productivity analytics" : role === "manager" ? "Team performance analytics" : "Organization analytics";
  const subtitle =
    role === "employee"
      ? "Your goal health, quarterly updates, and achievement trend in one view."
      : role === "manager"
        ? "Team completion, pending reviews, check-ins, and execution quality."
        : "Enterprise goal health across departments, managers, reviews, and check-ins.";

  function exportCsv() {
    const fallbackRow: ExportRow = {
      employee: "",
      email: "",
      goal: "",
      thrustArea: "",
      status: "",
      uom: "",
      target: "",
      weightage: 0,
      quarter: "",
      actual: "",
      progress: "",
      achievementStatus: ""
    };
    const rows = buildExportRows(users, analytics.visibleGoals, achievements);
    const headers = Object.keys(rows[0] ?? fallbackRow) as Array<keyof ExportRow>;
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => csvEscape(String(row[header] ?? ""))).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `goalos-${role}-analytics.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden">
        <CardHeader className="gap-4 border-b bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Button type="button" variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardKpi label="Total goals" value={analytics.totalGoals} icon={FileCheck2} helper={`${analytics.approvedCount} approved`} />
          <DashboardKpi label="Weighted progress" value={`${analytics.weightedProgress}%`} icon={Gauge} helper={trendText(analytics.trendDelta)} tone={analytics.trendDelta >= 0 ? "good" : "risk"} />
          <DashboardKpi label="Check-in completion" value={`${analytics.checkInCompletionRate}%`} icon={CheckCircle2} helper={`${analytics.pendingCheckIns} pending`} />
          <DashboardKpi label="Pending approvals" value={analytics.pendingCount} icon={TimerReset} helper={`${analytics.completedReviews} quarterly reviews`} tone={analytics.pendingCount ? "warn" : "good"} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <ChartCard title="QoQ achievement trend" subtitle="Average quarterly progress, completion rate, and check-in volume.">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={analytics.quarterlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="quarter" tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" domain={[0, 100]} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Bar yAxisId="right" dataKey="checkIns" name="Check-ins" fill="#cbd5e1" fillOpacity={0.45} radius={[6, 6, 0, 0]} barSize={48} />
              <Line yAxisId="left" type="monotone" dataKey="completion" name="Completion %" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="progress"
                name="Avg progress %"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>Goal health overview</CardTitle>
            <p className="text-sm text-muted-foreground">Completion, lock status, and review readiness.</p>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ProgressMetric label="Completion rate" value={analytics.completionRate} />
            <ProgressMetric label="Check-in completion" value={analytics.checkInCompletionRate} />
            <div className="grid grid-cols-2 gap-3">
              <CompactMetric icon={Lock} label="Locked" value={analytics.lockedCount} />
              <CompactMetric icon={Unlock} label="Unlocked" value={analytics.unlockedCount} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <CompactMetric icon={AlertTriangle} label="Pending approvals" value={analytics.pendingCount} />
              <CompactMetric icon={CheckCircle2} label="Reviews done" value={analytics.completedReviews} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <DistributionCard title="Goal status" data={analytics.statusDistribution} variant="donut" />
        <DistributionCard title="Thrust area distribution" data={analytics.thrustAreaDistribution} />
        <DistributionCard title="Goal type & UoM" data={[...analytics.goalTypeDistribution, ...analytics.uomDistribution]} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <ChartCard title="Department goal distribution" subtitle="Stacked view of status health by inferred department.">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.stackedStatusByDepartment} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="department" width={120} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Bar dataKey="Draft" stackId="status" fill={statusColors.Draft} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Pending" stackId="status" fill={statusColors.Pending} />
              <Bar dataKey="Approved" stackId="status" fill={statusColors.Approved} />
              <Bar dataKey="Returned" stackId="status" fill={statusColors.Returned} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>{role === "employee" ? "Employee progress" : "Progress leaderboard"}</CardTitle>
            <p className="text-sm text-muted-foreground">Progress, completion, pending approvals, and check-in depth.</p>
          </CardHeader>
          <CardContent>
            <ProgressTable rows={analytics.progressRows} />
          </CardContent>
        </Card>
      </div>

      <div className={cn("grid items-start gap-6", role === "employee" ? "xl:grid-cols-1" : "xl:grid-cols-[1.15fr_0.85fr]")}>
        <Card>
          <CardHeader>
            <CardTitle>Quarterly completion heatmap</CardTitle>
            <p className="text-sm text-muted-foreground">Employee activity matrix across quarterly check-ins.</p>
          </CardHeader>
          <CardContent>
            <QuarterHeatmap rows={analytics.heatmapRows} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent quarterly updates</CardTitle>
            <p className="text-sm text-muted-foreground">Latest goal, review, and achievement activity.</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {activity.length ? activity.map((item) => <ActivityItem key={item.id} item={item} />) : <EmptyMini title="No activity yet" />}
          </CardContent>
        </Card>
      </div>

      {role !== "employee" ? (
        <Card>
          <CardHeader>
            <CardTitle>Manager effectiveness dashboard</CardTitle>
            <p className="text-sm text-muted-foreground">Approval turnaround, check-in discipline, completion quality, and manager ranking.</p>
          </CardHeader>
          <CardContent>
            <ManagerEffectivenessTable rows={analytics.managerEffectiveness} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function DashboardKpi({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral"
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: LucideIcon;
  tone?: "neutral" | "good" | "warn" | "risk";
}) {
  const toneClass = {
    neutral: "bg-accent text-accent-foreground",
    good: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    risk: "bg-rose-50 text-rose-700"
  }[tone];

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className={cn("rounded-lg p-3", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="h-80">{children}</CardContent>
    </Card>
  );
}

function ProgressMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <Progress value={value} />
    </div>
  );
}

function CompactMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <Icon className="mb-2 h-4 w-4 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function DistributionCard({ title, data, variant = "bars" }: { title: string; data: { name: string; value: number }[]; variant?: "bars" | "donut" }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {variant === "donut" ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={3}>
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : null}
        <div className="grid gap-2">
          {data.length ? (
            data.slice(0, 6).map((item, index) => (
              <div key={item.name} className="grid gap-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                    {item.name}
                  </span>
                  <span className="font-medium">{item.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${total ? (item.value / total) * 100 : 0}%`, backgroundColor: chartColors[index % chartColors.length] }} />
                </div>
              </div>
            ))
          ) : (
            <EmptyMini title="No distribution data" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressTable({
  rows
}: {
  rows: Array<{ id: string; name: string; department: string; total: number; pending: number; approved: number; completed: number; checkIns: number; progress: number; completionRate: number }>;
}) {
  if (!rows.length) return <EmptyMini title="No employee progress yet" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-3 pr-4">Employee</th>
            <th className="py-3 pr-4">Department</th>
            <th className="py-3 pr-4">Progress</th>
            <th className="py-3 pr-4">Goals</th>
            <th className="py-3 pr-4">Completion</th>
            <th className="py-3 pr-4">Check-ins</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="py-3 pr-4 font-medium">{row.name}</td>
              <td className="py-3 pr-4 text-muted-foreground">{row.department}</td>
              <td className="py-3 pr-4">
                <div className="flex min-w-36 items-center gap-3">
                  <Progress value={row.progress} />
                  <span className="w-10 text-right font-medium">{row.progress}%</span>
                </div>
              </td>
              <td className="py-3 pr-4">{row.approved} approved · {row.pending} pending · {row.total} total</td>
              <td className="py-3 pr-4">{row.completionRate}%</td>
              <td className="py-3 pr-4">{row.checkIns}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuarterHeatmap({
  rows
}: {
  rows: Array<{ id: string; name: string; department: string; cells: Array<{ quarter: string; progress: number; checkIns: number; completed: number }> }>;
}) {
  if (!rows.length) return <EmptyMini title="No quarterly activity yet" />;

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-separate border-spacing-1 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="w-56 px-2 py-2 font-medium">Employee</th>
              {["Q1", "Q2", "Q3", "Q4"].map((quarter) => (
                <th key={quarter} className="px-2 py-2 text-center font-medium">{quarter}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th className="rounded-md border bg-card px-3 py-2 text-left font-normal">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.department}</p>
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.quarter} className="p-0">
                    <div
                      title={`${row.name} ${cell.quarter}: ${cell.progress}% progress, ${cell.checkIns} updates`}
                      className={cn(
                        "flex h-16 min-w-28 flex-col items-center justify-center rounded-md border text-center transition-transform hover:scale-[1.02]",
                        heatClass(cell.progress)
                      )}
                    >
                      <span className="text-base font-semibold">{cell.progress}%</span>
                      <span className="text-[11px] opacity-80">{cell.checkIns} updates</span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>Low</span>
        {[0, 35, 55, 75, 95].map((value) => (
          <span key={value} className={cn("h-3 w-8 rounded-sm border", heatClass(value))} />
        ))}
        <span>High</span>
      </div>
    </div>
  );
}

function ManagerEffectivenessTable({
  rows
}: {
  rows: Array<{ id: string; name: string; teamSize: number; totalGoals: number; pendingApprovals: number; reviewedGoals: number; approvalTurnaroundDays: number; checkInRate: number; employeeCompletionRate: number; score: number }>;
}) {
  if (!rows.length) return <EmptyMini title="No manager effectiveness data yet" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-3 pr-4">Rank</th>
            <th className="py-3 pr-4">Manager</th>
            <th className="py-3 pr-4">Team</th>
            <th className="py-3 pr-4">Score</th>
            <th className="py-3 pr-4">Turnaround</th>
            <th className="py-3 pr-4">Check-ins</th>
            <th className="py-3 pr-4">Completion</th>
            <th className="py-3 pr-4">Pending</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td className="py-3 pr-4 font-semibold">#{index + 1}</td>
              <td className="py-3 pr-4 font-medium">{row.name}</td>
              <td className="py-3 pr-4">{row.teamSize} employees · {row.totalGoals} goals</td>
              <td className="py-3 pr-4">
                <div className="flex min-w-36 items-center gap-3">
                  <Progress value={row.score} />
                  <span className="w-10 text-right font-medium">{row.score}</span>
                </div>
              </td>
              <td className="py-3 pr-4">{row.approvalTurnaroundDays}d</td>
              <td className="py-3 pr-4">{row.checkInRate}%</td>
              <td className="py-3 pr-4">{row.employeeCompletionRate}%</td>
              <td className="py-3 pr-4">{row.pendingApprovals}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityItem({ item }: { item: { label: string; detail: string; timestamp: string } }) {
  const progressMatch = item.detail.match(/(\d+)% progress/);
  const progressValue = progressMatch ? Number(progressMatch[1]) : null;
  const status = getActivityStatus(item, progressValue !== null);

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[1fr_220px] sm:items-center">
      <div className="flex min-w-0 gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Activity className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.label}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(item.timestamp)}</p>
        </div>
      </div>
      <div className="rounded-md bg-muted/30 px-3 py-2">
        {progressValue !== null ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">{progressValue}%</span>
            </div>
            <Progress value={progressValue} />
            <p className="text-[11px] capitalize text-muted-foreground">{status.replace("_", " ")}</p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Status</span>
            <span className={cn("rounded-full px-2 py-1 text-xs font-medium", activityStatusClass(status))}>{formatActivityStatus(status)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function getActivityStatus(item: { label: string; detail: string }, isProgressUpdate: boolean) {
  const label = item.label.toLowerCase();
  const detail = item.detail.toLowerCase();
  const lower = `${label} ${detail}`;

  if (isProgressUpdate) {
    if (detail.includes("completed")) return "completed";
    if (detail.includes("on_track") || detail.includes("on track")) return "on_track";
  }

  if (label.includes("approved goals")) return "approved";
  if (label.includes("rejected goals")) return "returned";
  if (label.includes("updated goal")) return "updated";
  if (lower.includes("submitted") || lower.includes("pending")) return "pending";
  return "updated";
}

function activityStatusClass(status: string) {
  if (status === "completed" || status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "on_track") return "bg-blue-50 text-blue-700";
  if (status === "pending") return "bg-amber-50 text-amber-700";
  if (status === "returned") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function formatActivityStatus(status: string) {
  const labels: Record<string, string> = {
    completed: "Completed",
    on_track: "On Track",
    approved: "Approved",
    pending: "Pending",
    returned: "Returned",
    updated: "Updated"
  };
  return labels[status] ?? "Updated";
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number | string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-background p-3 text-sm shadow-soft">
      <p className="mb-2 font-medium">{label}</p>
      <div className="grid gap-1">
        {payload.map((item) => (
          <p key={`${item.name}-${item.value}`} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color ?? "#64748b" }} />
              {item.name}
            </span>
            <span className="font-medium text-foreground">{item.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function EmptyMini({ title }: { title: string }) {
  return <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">{title}</div>;
}

function heatClass(progress: number) {
  if (progress >= 90) return "border-emerald-500 bg-emerald-600 text-white";
  if (progress >= 70) return "border-emerald-300 bg-emerald-200 text-emerald-950";
  if (progress >= 40) return "border-amber-300 bg-amber-200 text-amber-950";
  if (progress > 0) return "border-rose-300 bg-rose-200 text-rose-950";
  return "border-slate-200 bg-slate-100 text-slate-500";
}

function trendText(delta: number) {
  if (delta === 0) return "flat QoQ";
  return `${delta > 0 ? "+" : ""}${delta}% QoQ`;
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
