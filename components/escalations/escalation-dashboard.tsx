"use client";

import { AlertTriangle, CheckCircle2, Filter, RefreshCw, Search, ShieldAlert, TimerReset, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EscalationItem, EscalationStatus, EscalationType, User } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Props = {
  escalations: EscalationItem[];
  users: User[];
  syncing: boolean;
  resolvingId: string | null;
  onSync: () => Promise<void>;
  onResolve: (escalationId: string) => Promise<void>;
};

const typeLabels: Record<EscalationType, string> = {
  goal_submission_delay: "Goal Submission",
  approval_delay: "Manager Approval",
  quarterly_checkin_delay: "Quarterly Check-in"
};

const statusLabels: Record<EscalationStatus, string> = {
  pending: "Pending",
  escalated: "Escalated",
  overdue: "Overdue",
  resolved: "Resolved"
};

export function EscalationDashboard({ escalations, users, syncing, resolvingId, onSync, onResolve }: Props) {
  const [statusFilter, setStatusFilter] = useState<"all" | EscalationStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | EscalationType>("all");
  const [search, setSearch] = useState("");
  const activeEscalations = escalations.filter((item) => item.status !== "resolved");

  const filteredEscalations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return escalations.filter((item) => {
      const employee = findUser(users, item.employeeId);
      const manager = findUser(users, item.managerId);
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesType = typeFilter === "all" || item.escalationType === typeFilter;
      const searchable = `${item.title} ${item.detail} ${employee?.name ?? ""} ${manager?.name ?? ""}`.toLowerCase();
      return matchesStatus && matchesType && (!query || searchable.includes(query));
    });
  }, [escalations, search, statusFilter, typeFilter, users]);

  const chartData = Object.entries(typeLabels).map(([type, label]) => ({
    type: label,
    count: activeEscalations.filter((item) => item.escalationType === type).length
  }));
  const recentlyEscalated = activeEscalations.slice(0, 4);
  const criticalCount = activeEscalations.filter((item) => item.severity === "critical").length;
  const overdueCount = activeEscalations.filter((item) => item.status === "overdue").length;
  const resolvedCount = escalations.filter((item) => item.status === "resolved").length;

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden border-rose-100">
        <CardHeader className="gap-4 border-b bg-rose-50/70 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldAlert className="h-5 w-5 text-rose-700" />
              Escalation Command Center
            </CardTitle>
            <p className="mt-1 max-w-3xl text-sm text-rose-900/75">
              Rule-based governance for overdue submissions, manager approvals, and quarterly check-ins.
            </p>
          </div>
          <Button type="button" onClick={onSync} disabled={syncing}>
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            Sync escalations
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <EscalationKpi label="Active escalations" value={activeEscalations.length} helper={`${criticalCount} critical`} icon={AlertTriangle} tone="risk" />
          <EscalationKpi label="Overdue actions" value={overdueCount} helper="Needs follow-up" icon={TimerReset} tone="warn" />
          <EscalationKpi label="Escalated owners" value={new Set(activeEscalations.map((item) => item.employeeId).filter(Boolean)).size} helper="Employees impacted" icon={TrendingUp} tone="risk" />
          <EscalationKpi label="Resolved" value={resolvedCount} helper="Closed history" icon={CheckCircle2} tone="good" />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Escalation mix</CardTitle>
            <p className="text-sm text-muted-foreground">Active rule hits by workflow type.</p>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="type" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#e11d48" radius={[8, 8, 0, 0]} barSize={46} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently escalated</CardTitle>
            <p className="text-sm text-muted-foreground">Latest unresolved compliance risks.</p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {recentlyEscalated.length ? (
              recentlyEscalated.map((item) => <EscalationAlert key={item.id} escalation={item} users={users} />)
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">No active escalations after the latest sync.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Escalation register</CardTitle>
            <p className="text-sm text-muted-foreground">Search, filter, review, and resolve tracked escalations.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[220px_160px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search owner or detail" />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | EscalationStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | EscalationType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="goal_submission_delay">Goal Submission</SelectItem>
                <SelectItem value="approval_delay">Manager Approval</SelectItem>
                <SelectItem value="quarterly_checkin_delay">Quarterly Check-in</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <EscalationTable escalations={filteredEscalations} users={users} resolvingId={resolvingId} onResolve={onResolve} />
        </CardContent>
      </Card>
    </div>
  );
}

function EscalationKpi({ label, value, helper, icon: Icon, tone }: { label: string; value: number; helper: string; icon: typeof AlertTriangle; tone: "good" | "warn" | "risk" }) {
  const toneClass = {
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

function EscalationAlert({ escalation, users }: { escalation: EscalationItem; users: User[] }) {
  const employee = findUser(users, escalation.employeeId);
  const manager = findUser(users, escalation.managerId);

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <EscalationStatusBadge status={escalation.status} />
        <SeverityBadge severity={escalation.severity} />
        <span className="text-xs font-medium text-muted-foreground">{typeLabels[escalation.escalationType]}</span>
      </div>
      <p className="mt-2 font-medium">{escalation.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{escalation.detail}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {employee?.name ?? "Unassigned employee"} · Manager: {manager?.name ?? "Not assigned"} · Due {formatDate(escalation.dueAt)}
      </p>
    </div>
  );
}

function EscalationTable({ escalations, users, resolvingId, onResolve }: { escalations: EscalationItem[]; users: User[]; resolvingId: string | null; onResolve: (id: string) => Promise<void> }) {
  if (!escalations.length) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
        <Filter className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No escalations match the current filters</p>
        <p className="text-sm text-muted-foreground">Run sync or adjust filters to review history.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-3 pr-4">Type</th>
            <th className="py-3 pr-4">Owner</th>
            <th className="py-3 pr-4">Detail</th>
            <th className="py-3 pr-4">Due</th>
            <th className="py-3 pr-4">Severity</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {escalations.map((item) => {
            const employee = findUser(users, item.employeeId);
            const manager = findUser(users, item.managerId);
            return (
              <tr key={item.id} className="align-top">
                <td className="py-4 pr-4 font-medium">{typeLabels[item.escalationType]}</td>
                <td className="py-4 pr-4">
                  <p className="font-medium">{employee?.name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">Manager: {manager?.name ?? "Not assigned"}</p>
                </td>
                <td className="py-4 pr-4">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 max-w-xl text-xs text-muted-foreground">{item.detail}</p>
                </td>
                <td className="py-4 pr-4">{formatDate(item.dueAt)}</td>
                <td className="py-4 pr-4"><SeverityBadge severity={item.severity} /></td>
                <td className="py-4 pr-4"><EscalationStatusBadge status={item.status} /></td>
                <td className="py-4 text-right">
                  <Button size="sm" variant="outline" disabled={item.status === "resolved" || resolvingId === item.id} onClick={() => onResolve(item.id)}>
                    {resolvingId === item.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Resolve
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EscalationStatusBadge({ status }: { status: EscalationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        status === "resolved" && "bg-emerald-50 text-emerald-700",
        status === "pending" && "bg-slate-100 text-slate-700",
        status === "overdue" && "bg-amber-50 text-amber-700",
        status === "escalated" && "bg-rose-50 text-rose-700"
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: EscalationItem["severity"] }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        severity === "medium" && "bg-amber-50 text-amber-700",
        severity === "high" && "bg-orange-50 text-orange-700",
        severity === "critical" && "bg-rose-50 text-rose-700"
      )}
    >
      {severity}
    </span>
  );
}

function findUser(users: User[], id: string | null) {
  return id ? users.find((user) => user.id === id) : undefined;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
