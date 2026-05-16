"use client";

import { Activity, BarChart3, Download, FileCheck2, Gauge, TimerReset, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

const chartColors = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#14b8a6", "#64748b"];

export function VisualDashboard({ role, currentUser, users, goals, reviews, achievements }: Props) {
  const analytics = buildDashboardAnalytics(role, currentUser, users, goals, achievements);
  const activity = buildActivityFeed(users, analytics.visibleGoals, reviews, achievements);
  const title = role === "employee" ? "Productivity dashboard" : role === "manager" ? "Team performance dashboard" : "Organization analytics";

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
    link.download = `goalos-${role}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground">Live visibility across goals, approvals, check-ins, and completion trends.</p>
          </div>
          <Button type="button" variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardKpi label="Total goals" value={analytics.totalGoals} icon={FileCheck2} />
          <DashboardKpi label="Approved" value={analytics.approvedCount} icon={Gauge} />
          <DashboardKpi label="Pending approvals" value={analytics.pendingCount} icon={TimerReset} />
          <DashboardKpi label={role === "employee" ? "Completion" : "Team completion"} value={`${analytics.completionRate}%`} icon={BarChart3} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Quarterly progress</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.quarterlyTrend}>
                <defs>
                  <linearGradient id="progressFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="quarter" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="progress" stroke="#2563eb" fill="url(#progressFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Goal status distribution</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[180px_1fr]">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.statusDistribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>
                    {analytics.statusDistribution.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid content-center gap-2">
              {analytics.statusDistribution.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                    {item.name}
                  </span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{role === "employee" ? "Goal completion" : role === "manager" ? "Employee-wise progress" : "Manager effectiveness insights"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {analytics.ownerCards.length ? (
              analytics.ownerCards.map((owner) => (
                <div key={owner.id} className="rounded-xl border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{owner.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {owner.approved} approved · {owner.pending} pending · {owner.total} total
                      </p>
                    </div>
                    <span className="text-sm font-semibold">{owner.progress}%</span>
                  </div>
                  <Progress value={owner.progress} />
                </div>
              ))
            ) : (
              <EmptyMini title="No employee progress yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {activity.length ? (
              activity.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-xl border bg-card p-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{item.detail}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(item.timestamp)}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyMini title="No activity yet" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{role === "admin" ? "Goal distribution by UoM" : "Approval analytics"}</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={role === "admin" ? analytics.uomDistribution : analytics.statusDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {(role === "admin" ? analytics.uomDistribution : analytics.statusDistribution).map((entry, index) => (
                  <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardKpi({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Users }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-semibold">{value}</p>
        </div>
        <div className="rounded-xl bg-accent p-3 text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyMini({ title }: { title: string }) {
  return <div className={cn("rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground")}>{title}</div>;
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
