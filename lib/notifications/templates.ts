import type { Goal } from "@/lib/domain/types";

export type NotificationEventType = "goal_submitted" | "goals_approved" | "goals_rejected" | "quarterly_checkin_reminder" | "escalation_alert";

type WorkflowEmail = {
  title: string;
  eyebrow: string;
  recipientName: string;
  actorName: string;
  action: string;
  goals: Goal[];
  timestamp: string;
  ctaHref: string;
  ctaLabel: string;
  note?: string;
};

type EscalationEmail = {
  recipientName: string;
  title: string;
  detail: string;
  severity: string;
  status: string;
  dueAt: string;
  triggeredAt: string;
  ctaHref: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(new Date(timestamp));
}

function summarizeGoals(goals: Goal[]) {
  const totalWeight = goals.reduce((sum, goal) => sum + Number(goal.weightage || 0), 0);
  return `${goals.length} goal${goals.length === 1 ? "" : "s"} · ${totalWeight}% total weightage`;
}

export function buildWorkflowEmail(input: WorkflowEmail) {
  const goalRows = input.goals
    .slice(0, 6)
    .map(
      (goal) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;">
            <div style="font-weight:700;color:#0f172a;">${escapeHtml(goal.title)}</div>
            <div style="margin-top:3px;font-size:12px;color:#64748b;">${escapeHtml(goal.thrustArea)} · ${goal.weightage}% · ${escapeHtml(goal.target)}</div>
          </td>
        </tr>`
    )
    .join("");

  const overflow = input.goals.length > 6 ? `<p style="margin:12px 0 0;color:#64748b;font-size:13px;">+${input.goals.length - 6} more goals in GoalOS.</p>` : "";
  const timestamp = formatTimestamp(input.timestamp);

  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:28px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 28px;background:#0f172a;color:#ffffff;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#67e8f9;">${escapeHtml(input.eyebrow)}</div>
                    <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">${escapeHtml(input.title)}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;">
                    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(input.recipientName)},</p>
                    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">${escapeHtml(input.actorName)} ${escapeHtml(input.action)}.</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #e2e8f0;border-radius:12px;padding:0 16px;">
                      <tr>
                        <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;">
                          <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;">Goal summary</div>
                          <div style="margin-top:4px;font-size:16px;font-weight:700;color:#0f172a;">${summarizeGoals(input.goals)}</div>
                        </td>
                      </tr>
                      ${goalRows}
                    </table>
                    ${overflow}
                    ${input.note ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(input.note)}</p>` : ""}
                    <p style="margin:18px 0;color:#64748b;font-size:13px;">Timestamp: ${timestamp}</p>
                    <a href="${escapeHtml(input.ctaHref)}" style="display:inline-block;margin-top:6px;border-radius:10px;background:#0891b2;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:700;">${escapeHtml(input.ctaLabel)}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;">
                    GoalOS automated notification. Microsoft Teams delivery can be added later from the same event stream.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>`;
}

export function buildEscalationEmail(input: EscalationEmail) {
  const dueAt = formatTimestamp(input.dueAt);
  const triggeredAt = formatTimestamp(input.triggeredAt);

  return `
    <!doctype html>
    <html>
      <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:28px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 28px;background:#7f1d1d;color:#ffffff;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fecaca;">Escalation alert</div>
                    <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">${escapeHtml(input.title)}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;">
                    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(input.recipientName)},</p>
                    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">${escapeHtml(input.detail)}</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border:1px solid #e2e8f0;border-radius:12px;padding:0 16px;">
                      <tr>
                        <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;">
                          <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;">Severity</div>
                          <div style="margin-top:4px;font-size:16px;font-weight:700;color:#7f1d1d;">${escapeHtml(input.severity)}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;">
                          <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;">Due date</div>
                          <div style="margin-top:4px;font-size:15px;font-weight:700;color:#0f172a;">${dueAt}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 0;">
                          <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;">Triggered</div>
                          <div style="margin-top:4px;font-size:15px;font-weight:700;color:#0f172a;">${triggeredAt}</div>
                        </td>
                      </tr>
                    </table>
                    <a href="${escapeHtml(input.ctaHref)}" style="display:inline-block;margin-top:6px;border-radius:10px;background:#b91c1c;color:#ffffff;padding:12px 18px;text-decoration:none;font-weight:700;">Open Governance Dashboard</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;">
                    GoalOS governance alert. This escalation was generated by rule-based compliance checks.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>`;
}
