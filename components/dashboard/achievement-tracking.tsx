"use client";

import { BarChart3, Bell, CheckCircle2, Clock3, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { calculateProgressPercent, getLatestAchievement, getWeightedProgress, progressStatusLabels, quarters } from "@/lib/domain/progress";
import type { AchievementFormValues, AchievementUpdate, Goal, GoalProgressStatus, Quarter, Role, User } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Props = {
  role: Role;
  currentUser: User;
  users: User[];
  goals: Goal[];
  achievements: AchievementUpdate[];
  onSave: (goal: Goal, values: AchievementFormValues) => Promise<void>;
  onSendReminders?: (quarter: Quarter) => Promise<void>;
};

export function AchievementTracking({ role, currentUser, users, goals, achievements, onSave, onSendReminders }: Props) {
  const [reminderQuarter, setReminderQuarter] = useState<Quarter>("Q1");
  const [sendingReminders, setSendingReminders] = useState(false);
  const approvedGoals = useMemo(() => {
    if (role === "employee") {
      return goals.filter((goal) => goal.ownerId === currentUser.id && goal.status === "approved");
    }

    if (role === "manager") {
      const teamIds = new Set(users.filter((user) => user.managerId === currentUser.id).map((user) => user.id));
      return goals.filter((goal) => teamIds.has(goal.ownerId) && goal.status === "approved");
    }

    return goals.filter((goal) => goal.status === "approved");
  }, [currentUser.id, goals, role, users]);

  const weightedProgress = getWeightedProgress(approvedGoals, achievements);
  const completedCount = approvedGoals.filter((goal) => getLatestAchievement(goal.id, achievements)?.status === "completed").length;
  const onTrackCount = approvedGoals.filter((goal) => getLatestAchievement(goal.id, achievements)?.status === "on_track").length;
  const pendingReminderCount = approvedGoals.filter(
    (goal) => !achievements.some((achievement) => achievement.goalId === goal.id && achievement.quarter === reminderQuarter)
  ).length;

  async function sendReminders() {
    if (!onSendReminders || sendingReminders) return;
    setSendingReminders(true);
    try {
      await onSendReminders(reminderQuarter);
    } finally {
      setSendingReminders(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <TrackingMetric label="Weighted progress" value={`${weightedProgress}%`} icon={BarChart3} />
        <TrackingMetric label="On track" value={onTrackCount} icon={Clock3} />
        <TrackingMetric label="Completed" value={completedCount} icon={CheckCircle2} />
      </div>

      <Card>
        <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Quarterly achievement tracking</CardTitle>
            <p className="text-sm text-muted-foreground">
              Track planned vs actual progress for approved goals. Progress is calculated from the goal UoM and Min/Max rule.
            </p>
          </div>
          {onSendReminders ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={reminderQuarter} onValueChange={(quarter: Quarter) => setReminderQuarter(quarter)}>
                <SelectTrigger className="w-full sm:w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {quarters.map((quarter) => (
                    <SelectItem key={quarter} value={quarter}>{quarter}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" disabled={!pendingReminderCount || sendingReminders} onClick={sendReminders}>
                {sendingReminders ? <Clock3 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Send reminders
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-4">
          {onSendReminders ? (
            <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
              {pendingReminderCount
                ? `${pendingReminderCount} approved goal update${pendingReminderCount === 1 ? "" : "s"} still pending for ${reminderQuarter}.`
                : `No pending ${reminderQuarter} check-ins in this view.`}
            </div>
          ) : null}
          <CheckInSchedule />
          {approvedGoals.length ? (
            <div className="grid gap-4">
              {approvedGoals.map((goal) => (
                <AchievementGoalRow
                  key={goal.id}
                  role={role}
                  owner={users.find((user) => user.id === goal.ownerId)}
                  goal={goal}
                  achievement={getLatestAchievement(goal.id, achievements)}
                  onSave={onSave}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 p-8 text-center">
              <BarChart3 className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No approved goals to track</p>
              <p className="text-sm text-muted-foreground">Quarterly updates unlock once goals are approved.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CheckInSchedule() {
  const windows = [
    ["Goal Setting", "1 May", "Creation, submission, approval"],
    ["Q1", "July", "Planned vs actual update"],
    ["Q2", "October", "Planned vs actual update"],
    ["Q3", "January", "Planned vs actual update"],
    ["Q4 / Annual", "March / April", "Final achievement capture"]
  ];

  return (
    <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 md:grid-cols-5">
      {windows.map(([period, opens, action]) => (
        <div key={period} className="rounded-lg bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">{period}</p>
          <p className="mt-1 text-sm font-semibold">{opens}</p>
          <p className="mt-1 text-xs text-muted-foreground">{action}</p>
        </div>
      ))}
    </div>
  );
}

function AchievementGoalRow({
  role,
  owner,
  goal,
  achievement,
  onSave
}: {
  role: Role;
  owner?: User;
  goal: Goal;
  achievement?: AchievementUpdate;
  onSave: (goal: Goal, values: AchievementFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<AchievementFormValues>({
    quarter: achievement?.quarter ?? "Q1",
    actualValue: achievement?.actualValue ?? "",
    status: achievement?.status ?? "not_started",
    employeeComment: achievement?.employeeComment ?? "",
    managerComment: achievement?.managerComment ?? ""
  });
  const [saving, setSaving] = useState(false);
  const canEditEmployeeFields = role === "employee" || role === "admin";
  const canEditManagerComment = role === "manager" || role === "admin";
  const previewProgress = calculateProgressPercent(goal, values.actualValue, values.status);

  useEffect(() => {
    setValues({
      quarter: achievement?.quarter ?? "Q1",
      actualValue: achievement?.actualValue ?? "",
      status: achievement?.status ?? "not_started",
      employeeComment: achievement?.employeeComment ?? "",
      managerComment: achievement?.managerComment ?? ""
    });
  }, [achievement]);

  async function save() {
    setSaving(true);
    try {
      await onSave(goal, values);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{goal.title}</p>
            <ProgressPill status={achievement?.status ?? values.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {owner?.name ? `${owner.name} · ` : ""}
            Target: {goal.target} · {goal.goalType.toUpperCase()} · {goal.uom.replace("_", " ")}
          </p>
        </div>
        <div className="w-full max-w-xs">
          <div className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>{achievement ? "Saved progress" : "Preview progress"}</span>
            <span>{achievement?.progressPercent ?? previewProgress}%</span>
          </div>
          <Progress value={achievement?.progressPercent ?? previewProgress} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[120px_1fr_160px]">
        <Select
          value={values.quarter}
          disabled={!canEditEmployeeFields}
          onValueChange={(quarter: Quarter) => setValues((current) => ({ ...current, quarter }))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {quarters.map((quarter) => (
              <SelectItem key={quarter} value={quarter}>{quarter}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={values.actualValue}
          onChange={(event) => setValues((current) => ({ ...current, actualValue: event.target.value }))}
          placeholder={goal.uom === "timeline" ? "2026-06-30" : "Actual achievement"}
          disabled={!canEditEmployeeFields}
        />
        <Select
          value={values.status}
          disabled={!canEditEmployeeFields}
          onValueChange={(status: GoalProgressStatus) => setValues((current) => ({ ...current, status }))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="not_started">Not Started</SelectItem>
            <SelectItem value="on_track">On Track</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Textarea
          value={values.employeeComment}
          onChange={(event) => setValues((current) => ({ ...current, employeeComment: event.target.value }))}
          placeholder="Employee quarterly update"
          disabled={!canEditEmployeeFields}
        />
        <Textarea
          value={values.managerComment}
          onChange={(event) => setValues((current) => ({ ...current, managerComment: event.target.value }))}
          placeholder={role === "employee" ? "Manager check-in comments appear here" : "Manager check-in comment"}
          disabled={!canEditManagerComment}
        />
      </div>

      <div className="mt-3 flex justify-end">
        <Button type="button" onClick={save} disabled={saving}>
          <Save className="h-4 w-4" />
          Save update
        </Button>
      </div>
    </div>
  );
}

function TrackingMetric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof BarChart3 }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-semibold">{value}</p>
        </div>
        <div className="rounded-xl bg-accent p-3 text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressPill({ status }: { status: GoalProgressStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        status === "completed" && "bg-emerald-50 text-emerald-700",
        status === "on_track" && "bg-blue-50 text-blue-700",
        status === "not_started" && "bg-slate-100 text-slate-700"
      )}
    >
      {progressStatusLabels[status]}
    </span>
  );
}
