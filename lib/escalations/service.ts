import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AchievementUpdate, EscalationItem, EscalationSeverity, EscalationStatus, EscalationType, Goal, Quarter, User } from "@/lib/domain/types";
import { notifyEscalationAlert } from "@/lib/notifications/service";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type EscalationClient = SupabaseClient;

type EscalationRow = {
  id: string;
  escalation_type: EscalationType;
  status: EscalationStatus;
  severity: EscalationSeverity;
  employee_id: string | null;
  manager_id: string | null;
  goal_id: string | null;
  quarter: Quarter | null;
  title: string;
  detail: string;
  due_at: string;
  triggered_at: string;
  resolved_at: string | null;
  last_evaluated_at: string;
  dedupe_key: string;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: User["role"];
  manager_id: string | null;
  created_at: string;
};

type GoalRow = {
  id: string;
  employee_id: string;
  title: string;
  status: Goal["status"];
  created_at: string;
  updated_at: string;
};

type AchievementRow = {
  id: string;
  goal_id: string;
  employee_id: string;
  quarter: Quarter;
  updated_at: string;
};

type DesiredEscalation = Omit<EscalationItem, "id" | "triggeredAt" | "resolvedAt" | "lastEvaluatedAt"> & {
  metadata: Record<string, unknown>;
};

const rules = {
  goalSubmissionDueMonth: 4,
  goalSubmissionDueDay: 1,
  approvalCutoffMonth: 4,
  approvalCutoffDay: 8,
  approvalAllowedDays: 3,
  highSeverityDays: 7,
  criticalSeverityDays: 14
};

const checkInDueDates: Array<{ quarter: Quarter; month: number; day: number }> = [
  { quarter: "Q3", month: 0, day: 31 },
  { quarter: "Q4", month: 3, day: 30 },
  { quarter: "Q1", month: 6, day: 31 },
  { quarter: "Q2", month: 9, day: 31 }
];

async function getEscalationClient(): Promise<EscalationClient> {
  const { url } = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceRoleKey) {
    return createSupabaseClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return createClient();
}

export function toEscalation(row: EscalationRow): EscalationItem {
  return {
    id: row.id,
    escalationType: row.escalation_type,
    status: row.status,
    severity: row.severity,
    employeeId: row.employee_id,
    managerId: row.manager_id,
    goalId: row.goal_id,
    quarter: row.quarter,
    title: row.title,
    detail: row.detail,
    dueAt: row.due_at,
    triggeredAt: row.triggered_at,
    resolvedAt: row.resolved_at,
    lastEvaluatedAt: row.last_evaluated_at,
    dedupeKey: row.dedupe_key
  };
}

export function isMissingEscalationRelation(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || error?.message?.includes("Could not find the table");
}

export async function loadEscalations() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("escalations").select("*").order("triggered_at", { ascending: false }).limit(100);

  if (error) {
    if (isMissingEscalationRelation(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => toEscalation(row as EscalationRow));
}

export async function syncEscalations(actorId: string) {
  const client = await getEscalationClient();
  const [{ data: userRows, error: usersError }, { data: goalRows, error: goalsError }, { data: achievementRows, error: achievementsError }] =
    await Promise.all([
      client.from("users").select("id, name, email, role, manager_id, created_at"),
      client.from("goals").select("id, employee_id, title, status, created_at, updated_at"),
      client.from("achievement_updates").select("id, goal_id, employee_id, quarter, updated_at")
    ]);

  if (usersError) throw new Error(usersError.message);
  if (goalsError) throw new Error(goalsError.message);
  if (achievementsError) throw new Error(achievementsError.message);

  const users = (userRows ?? []).map(toUser);
  const goals = (goalRows ?? []).map(toGoal);
  const achievements = (achievementRows ?? []).map(toAchievement);
  const desired = buildDesiredEscalations(users, goals, achievements, new Date());

  const { data: existingRows, error: existingError } = await client.from("escalations").select("*").is("resolved_at", null);
  if (existingError) throw new Error(existingError.message);

  const existing = (existingRows ?? []).map((row) => toEscalation(row as EscalationRow));
  const existingByKey = new Map(existing.map((item) => [item.dedupeKey, item]));
  const desiredKeys = new Set(desired.map((item) => item.dedupeKey));
  const now = new Date().toISOString();
  const changed: EscalationItem[] = [];
  let created = 0;
  let resolved = 0;

  for (const item of desired) {
    const current = existingByKey.get(item.dedupeKey);
    if (current) {
      const { data, error } = await client
        .from("escalations")
        .update({
          status: item.status,
          severity: item.severity,
          title: item.title,
          detail: item.detail,
          due_at: item.dueAt,
          last_evaluated_at: now,
          metadata: item.metadata
        })
        .eq("id", current.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      changed.push(toEscalation(data as EscalationRow));
      continue;
    }

    const { data, error } = await client
      .from("escalations")
      .insert({
        escalation_type: item.escalationType,
        status: item.status,
        severity: item.severity,
        employee_id: item.employeeId,
        manager_id: item.managerId,
        goal_id: item.goalId,
        quarter: item.quarter,
        title: item.title,
        detail: item.detail,
        due_at: item.dueAt,
        dedupe_key: item.dedupeKey,
        metadata: item.metadata
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const inserted = toEscalation(data as EscalationRow);
    created += 1;
    changed.push(inserted);
    await insertEscalationLog(client, inserted.id, actorId, "triggered", `${inserted.title} was escalated.`);
    await notifyEscalationRecipients(client, actorId, inserted, users);
  }

  for (const item of existing) {
    if (desiredKeys.has(item.dedupeKey)) continue;
    const { data, error } = await client
      .from("escalations")
      .update({ status: "resolved", resolved_at: now, last_evaluated_at: now })
      .eq("id", item.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const resolvedItem = toEscalation(data as EscalationRow);
    resolved += 1;
    changed.push(resolvedItem);
    await insertEscalationLog(client, item.id, actorId, "auto_resolved", `${item.title} no longer matches escalation rules.`);
  }

  const { data: rows, error: finalError } = await client.from("escalations").select("*").order("triggered_at", { ascending: false }).limit(100);
  if (finalError) throw new Error(finalError.message);

  return {
    escalations: (rows ?? []).map((row) => toEscalation(row as EscalationRow)),
    created,
    resolved,
    evaluated: desired.length,
    changed
  };
}

export async function resolveEscalation(escalationId: string, actorId: string) {
  const client = await getEscalationClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("escalations")
    .update({ status: "resolved", resolved_at: now, last_evaluated_at: now })
    .eq("id", escalationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const escalation = toEscalation(data as EscalationRow);
  await insertEscalationLog(client, escalation.id, actorId, "manual_resolved", `${escalation.title} was manually resolved.`);
  return escalation;
}

function buildDesiredEscalations(users: User[], goals: Goal[], achievements: AchievementUpdate[], now: Date): DesiredEscalation[] {
  const year = now.getUTCFullYear();
  const employees = users.filter((user) => user.role === "employee");
  const goalsByEmployee = new Map(employees.map((employee) => [employee.id, goals.filter((goal) => goal.ownerId === employee.id)]));
  const desired: DesiredEscalation[] = [];
  const submissionDue = dateFor(year, rules.goalSubmissionDueMonth, rules.goalSubmissionDueDay);
  const approvalCutoff = dateFor(year, rules.approvalCutoffMonth, rules.approvalCutoffDay);
  const overdueQuarter = latestOverdueQuarter(now);

  for (const employee of employees) {
    const employeeGoals = goalsByEmployee.get(employee.id) ?? [];
    const hasSubmittedPlan = employeeGoals.some((goal) => goal.status === "submitted" || goal.status === "approved");

    if (!hasSubmittedPlan && now > submissionDue) {
      desired.push(makeEscalation({
        type: "goal_submission_delay",
        employee,
        managerId: employee.managerId ?? null,
        dueAt: submissionDue,
        now,
        title: "Goal submission overdue",
        detail: `${employee.name} has not submitted a goal plan for manager review.`,
        dedupeKey: `goal_submission_delay:${employee.id}:${year}`,
        metadata: { rule: "No submitted or approved goals after goal submission due date." }
      }));
    }

    const submittedGoals = employeeGoals.filter((goal) => goal.status === "submitted");
    if (submittedGoals.length) {
      const earliestSubmitted = submittedGoals.map((goal) => new Date(goal.updatedAt || goal.createdAt)).sort((a, b) => a.getTime() - b.getTime())[0];
      const dueAt = minDate(addDays(earliestSubmitted, rules.approvalAllowedDays), approvalCutoff);
      if (now > dueAt) {
        desired.push(makeEscalation({
          type: "approval_delay",
          employee,
          managerId: employee.managerId ?? null,
          dueAt,
          now,
          title: "Manager approval overdue",
          detail: `${employee.name}'s submitted goal plan is awaiting manager approval or rejection.`,
          dedupeKey: `approval_delay:${employee.id}:${submittedGoals.map((goal) => goal.id).sort().join(".")}`,
          metadata: { pendingGoalIds: submittedGoals.map((goal) => goal.id), pendingGoals: submittedGoals.length }
        }));
      }
    }

    if (overdueQuarter) {
      const approvedGoals = employeeGoals.filter((goal) => goal.status === "approved");
      const pendingGoals = approvedGoals.filter(
        (goal) => !achievements.some((achievement) => achievement.goalId === goal.id && achievement.quarter === overdueQuarter.quarter)
      );

      if (pendingGoals.length) {
        desired.push(makeEscalation({
          type: "quarterly_checkin_delay",
          employee,
          managerId: employee.managerId ?? null,
          dueAt: overdueQuarter.dueAt,
          now,
          quarter: overdueQuarter.quarter,
          title: `${overdueQuarter.quarter} check-in overdue`,
          detail: `${employee.name} has ${pendingGoals.length} approved goal check-in${pendingGoals.length === 1 ? "" : "s"} pending for ${overdueQuarter.quarter}.`,
          dedupeKey: `quarterly_checkin_delay:${employee.id}:${overdueQuarter.quarter}:${year}`,
          metadata: { pendingGoalIds: pendingGoals.map((goal) => goal.id), pendingGoals: pendingGoals.length }
        }));
      }
    }
  }

  return desired;
}

function makeEscalation(input: {
  type: EscalationType;
  employee: User;
  managerId: string | null;
  dueAt: Date;
  now: Date;
  quarter?: Quarter;
  title: string;
  detail: string;
  dedupeKey: string;
  metadata: Record<string, unknown>;
}): DesiredEscalation {
  const daysOverdue = differenceInDays(input.now, input.dueAt);
  return {
    escalationType: input.type,
    employeeId: input.employee.id,
    managerId: input.managerId,
    goalId: null,
    quarter: input.quarter ?? null,
    status: daysOverdue >= rules.highSeverityDays ? "escalated" : "overdue",
    severity: severityFor(daysOverdue),
    title: input.title,
    detail: input.detail,
    dueAt: input.dueAt.toISOString(),
    dedupeKey: input.dedupeKey,
    metadata: { ...input.metadata, daysOverdue }
  };
}

function severityFor(daysOverdue: number): EscalationSeverity {
  if (daysOverdue >= rules.criticalSeverityDays) return "critical";
  if (daysOverdue >= rules.highSeverityDays) return "high";
  return "medium";
}

function latestOverdueQuarter(now: Date) {
  const year = now.getUTCFullYear();
  const dueDates = checkInDueDates
    .map((item) => ({ quarter: item.quarter, dueAt: dateFor(year, item.month, item.day) }))
    .filter((item) => item.dueAt < now)
    .sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime());

  return dueDates[0] ?? null;
}

function dateFor(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day, 18, 29, 59));
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function minDate(left: Date, right: Date) {
  return left < right ? left : right;
}

function differenceInDays(later: Date, earlier: Date) {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / 86400000));
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    managerId: row.manager_id,
    createdAt: row.created_at
  };
}

function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    ownerId: row.employee_id,
    thrustArea: "",
    title: row.title,
    description: "",
    uom: "numeric",
    goalType: "max",
    target: "",
    weightage: 0,
    status: row.status,
    locked: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toAchievement(row: AchievementRow): AchievementUpdate {
  return {
    id: row.id,
    goalId: row.goal_id,
    employeeId: row.employee_id,
    quarter: row.quarter,
    actualValue: "",
    status: "not_started",
    employeeComment: "",
    managerComment: "",
    progressPercent: 0,
    createdAt: row.updated_at,
    updatedAt: row.updated_at
  };
}

async function insertEscalationLog(client: EscalationClient, escalationId: string, actorId: string, eventType: string, message: string) {
  const { error } = await client.from("escalation_logs").insert({
    escalation_id: escalationId,
    actor_id: actorId,
    event_type: eventType,
    message
  });

  if (error) console.error("Escalation log insert failed", error.message);
}

async function notifyEscalationRecipients(client: EscalationClient, actorId: string, escalation: EscalationItem, users: User[]) {
  const recipients = new Set<string>();
  if (escalation.escalationType === "approval_delay" && escalation.managerId) recipients.add(escalation.managerId);
  if (escalation.escalationType !== "approval_delay" && escalation.employeeId) recipients.add(escalation.employeeId);

  users.filter((user) => user.role === "admin").forEach((admin) => recipients.add(admin.id));

  await Promise.all(
    Array.from(recipients).map((recipientId) =>
      notifyEscalationAlert(actorId, recipientId, {
        title: escalation.title,
        detail: escalation.detail,
        severity: escalation.severity,
        status: escalation.status,
        dueAt: escalation.dueAt,
        triggeredAt: escalation.triggeredAt,
        dedupeKey: escalation.dedupeKey
      }).catch((error) => {
        console.error("Escalation notification failed", error instanceof Error ? error.message : error);
      })
    )
  );
}
