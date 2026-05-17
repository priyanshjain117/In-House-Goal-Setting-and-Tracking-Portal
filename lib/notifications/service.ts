import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Goal, Quarter, User } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { sendMail } from "./mailer";
import { buildEscalationEmail, buildWorkflowEmail, type NotificationEventType } from "./templates";

type NotificationClient = SupabaseClient;

type NotificationRecord = {
  recipientId: string;
  actorId: string;
  eventType: NotificationEventType;
  title: string;
  message: string;
  ctaHref: string;
  dedupeKey: string;
  metadata?: Record<string, unknown>;
};

const eventSubjects: Record<NotificationEventType, string> = {
  goal_submitted: "Goal Sheet Submitted",
  goals_approved: "Goals Approved",
  goals_rejected: "Goals Returned for Rework",
  quarterly_checkin_reminder: "Quarterly Check-in Reminder",
  escalation_alert: "GoalOS Escalation Alert"
};

function appUrl(path: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

async function getNotificationClient(): Promise<NotificationClient> {
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

async function getUser(client: NotificationClient, userId: string) {
  const { data, error } = await client.from("users").select("id, name, email, role, manager_id, created_at").eq("id", userId).single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    managerId: data.manager_id,
    createdAt: data.created_at
  } satisfies User;
}

async function insertNotification(client: NotificationClient, record: NotificationRecord) {
  const { error } = await client.from("notifications").upsert(
    {
      recipient_id: record.recipientId,
      actor_id: record.actorId,
      event_type: record.eventType,
      title: record.title,
      message: record.message,
      cta_href: record.ctaHref,
      metadata: record.metadata ?? {},
      dedupe_key: record.dedupeKey
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true }
  );

  if (error) {
    console.error("Notification insert failed", error.message);
  }
}

async function reserveEmailLog(
  client: NotificationClient,
  input: {
    recipientId: string;
    recipientEmail: string;
    eventType: NotificationEventType;
    subject: string;
    dedupeKey: string;
  }
) {
  const { data, error } = await client
    .from("email_logs")
    .insert({
      recipient_id: input.recipientId,
      recipient_email: input.recipientEmail,
      event_type: input.eventType,
      subject: input.subject,
      dedupe_key: input.dedupeKey
    })
    .select("id")
    .single();

  if (error) {
    if (error.code !== "23505") console.error("Email log insert failed", error.message);
    return null;
  }

  return data.id as string;
}

async function updateEmailLog(client: NotificationClient, id: string, patch: Record<string, string | null>) {
  const { error } = await client.from("email_logs").update(patch).eq("id", id);
  if (error) console.error("Email log update failed", error.message);
}

async function sendEmail(
  client: NotificationClient,
  input: {
    recipientId: string;
    to: string;
    cc?: string;
    subject: string;
    html: string;
    eventType: NotificationEventType;
    dedupeKey: string;
  }
) {
  const logId = await reserveEmailLog(client, {
    recipientId: input.recipientId,
    recipientEmail: input.to,
    eventType: input.eventType,
    subject: input.subject,
    dedupeKey: input.dedupeKey
  });
  if (!logId) return { status: "duplicate" as const };

  try {
    const result = await sendMail({
      to: input.to,
      cc: input.cc,
      subject: input.subject,
      html: input.html
    });

    if (result.status === "sent") {
      await updateEmailLog(client, logId, { status: "sent", provider_message_id: result.messageId });
      return { status: "sent" as const };
    }

    await updateEmailLog(client, logId, { status: result.status, error: result.error });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed.";
    await updateEmailLog(client, logId, { status: "failed", error: message });
    return { status: "failed" as const, error: message };
  }
}

function goalDedupePart(goals: Goal[]) {
  const latestUpdate = goals.map((goal) => goal.updatedAt ?? goal.createdAt).sort().at(-1) ?? new Date().toISOString();
  return `${goals.map((goal) => goal.id).sort().join(".")}:${latestUpdate}`;
}

export async function notifyGoalSubmitted(actorId: string, employeeId: string, goals: Goal[]) {
  if (!goals.length) return { emailStatus: "skipped" as const };

  const client = await getNotificationClient();
  const employee = await getUser(client, employeeId);
  if (!employee.managerId) return { emailStatus: "skipped" as const };
  const manager = await getUser(client, employee.managerId);
  const timestamp = new Date().toISOString();
  const ctaHref = appUrl("/manager");
  const dedupeKey = `goal_submitted:${employeeId}:${goalDedupePart(goals)}`;

  await insertNotification(client, {
    recipientId: manager.id,
    actorId,
    eventType: "goal_submitted",
    title: "Goal Sheet Submitted",
    message: `${employee.name} submitted ${goals.length} goals for approval.`,
    ctaHref,
    dedupeKey,
    metadata: { employeeId, goalIds: goals.map((goal) => goal.id) }
  });

  return sendEmail(client, {
    recipientId: manager.id,
    to: manager.email,
    eventType: "goal_submitted",
    subject: eventSubjects.goal_submitted,
    dedupeKey,
    html: buildWorkflowEmail({
      title: "Goal Sheet Submitted",
      eyebrow: "Manager approval required",
      recipientName: manager.name,
      actorName: employee.name,
      action: "submitted a goal sheet for your review",
      goals,
      timestamp,
      ctaHref,
      ctaLabel: "Review Goals"
    })
  });
}

export async function notifyGoalDecision(actorId: string, employeeId: string, status: "approved" | "rejected", goals: Goal[], comment: string) {
  if (!goals.length) return { emailStatus: "skipped" as const };

  const client = await getNotificationClient();
  const [employee, manager] = await Promise.all([getUser(client, employeeId), getUser(client, actorId)]);
  const eventType: NotificationEventType = status === "approved" ? "goals_approved" : "goals_rejected";
  const timestamp = new Date().toISOString();
  const ctaHref = appUrl("/employee");
  const dedupeKey = `${eventType}:${employeeId}:${goalDedupePart(goals)}`;
  const title = eventSubjects[eventType];

  await insertNotification(client, {
    recipientId: employee.id,
    actorId,
    eventType,
    title,
    message:
      status === "approved"
        ? `${manager.name} approved your goal sheet.`
        : `${manager.name} returned your goal sheet for rework.`,
    ctaHref,
    dedupeKey,
    metadata: { managerId: manager.id, goalIds: goals.map((goal) => goal.id), comment }
  });

  return sendEmail(client, {
    recipientId: employee.id,
    to: employee.email,
    eventType,
    subject: title,
    dedupeKey,
    html: buildWorkflowEmail({
      title,
      eyebrow: status === "approved" ? "Approval complete" : "Rework requested",
      recipientName: employee.name,
      actorName: manager.name,
      action: status === "approved" ? "approved your goals" : "returned your goals for rework",
      goals,
      timestamp,
      ctaHref,
      ctaLabel: status === "approved" ? "View Approved Goals" : "Update Goals",
      note: comment ? `Manager note: ${comment}` : undefined
    })
  });
}

export async function notifyQuarterlyCheckInReminder(actorId: string, employeeId: string, quarter: Quarter, goals: Goal[]) {
  if (!goals.length) return { emailStatus: "skipped" as const };

  const client = await getNotificationClient();
  const [employee, actor] = await Promise.all([getUser(client, employeeId), getUser(client, actorId)]);
  const timestamp = new Date().toISOString();
  const ctaHref = appUrl("/employee#tracking");
  const dedupeKey = `quarterly_checkin_reminder:${employeeId}:${quarter}:${goalDedupePart(goals)}`;

  await insertNotification(client, {
    recipientId: employee.id,
    actorId,
    eventType: "quarterly_checkin_reminder",
    title: "Quarterly Check-in Reminder",
    message: `${actor.name} sent a ${quarter} reminder for ${goals.length} pending goal update${goals.length === 1 ? "" : "s"}.`,
    ctaHref,
    dedupeKey,
    metadata: { quarter, goalIds: goals.map((goal) => goal.id) }
  });

  return sendEmail(client, {
    recipientId: employee.id,
    to: employee.email,
    cc: actor.email !== employee.email ? actor.email : undefined,
    eventType: "quarterly_checkin_reminder",
    subject: `${eventSubjects.quarterly_checkin_reminder}: ${quarter}`,
    dedupeKey,
    html: buildWorkflowEmail({
      title: "Quarterly Check-in Reminder",
      eyebrow: `${quarter} update pending`,
      recipientName: employee.name,
      actorName: actor.name,
      action: `sent a reminder to complete your ${quarter} check-in`,
      goals,
      timestamp,
      ctaHref,
      ctaLabel: "Complete Check-in",
      note: "Please update actual achievement, progress status, and employee comments for the pending goals."
    })
  });
}

export async function notifyEscalationAlert(
  actorId: string,
  recipientId: string,
  input: {
    title: string;
    detail: string;
    severity: string;
    status: string;
    dueAt: string;
    triggeredAt: string;
    dedupeKey: string;
  }
) {
  const client = await getNotificationClient();
  const recipient = await getUser(client, recipientId);
  const ctaHref = appUrl("/admin#escalations");
  const dedupeKey = `escalation_alert:${recipientId}:${input.dedupeKey}`;

  await insertNotification(client, {
    recipientId,
    actorId,
    eventType: "escalation_alert",
    title: input.title,
    message: input.detail,
    ctaHref,
    dedupeKey,
    metadata: {
      severity: input.severity,
      status: input.status,
      dueAt: input.dueAt
    }
  });

  return sendEmail(client, {
    recipientId,
    to: recipient.email,
    eventType: "escalation_alert",
    subject: `${eventSubjects.escalation_alert}: ${input.title}`,
    dedupeKey,
    html: buildEscalationEmail({
      recipientName: recipient.name,
      title: input.title,
      detail: input.detail,
      severity: input.severity,
      status: input.status,
      dueAt: input.dueAt,
      triggeredAt: input.triggeredAt,
      ctaHref
    })
  });
}
