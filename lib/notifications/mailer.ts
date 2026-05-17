import "server-only";

import nodemailer from "nodemailer";

export type MailDeliveryResult =
  | { status: "sent"; messageId: string | null }
  | { status: "skipped"; error: string }
  | { status: "failed"; error: string };

type SendMailInput = {
  to: string;
  cc?: string;
  subject: string;
  html: string;
};

function getSmtpConfig() {
  const email = process.env.SMTP_EMAIL;
  const password = process.env.SMTP_PASSWORD;

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

function createTransporter() {
  const config = getSmtpConfig();
  if (!config) return null;

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: config.email,
      pass: config.password
    }
  });
}

export async function sendMail({ to, cc, subject, html }: SendMailInput): Promise<MailDeliveryResult> {
  const config = getSmtpConfig();
  const transporter = createTransporter();

  if (!config || !transporter) {
    const message = "SMTP_EMAIL or SMTP_PASSWORD is not configured.";
    console.warn(`Email skipped: ${message}`);
    return { status: "skipped", error: message };
  }

  try {
    const info = await transporter.sendMail({
      from: `"GoalOS Notifications" <${config.email}>`,
      to,
      cc,
      subject,
      html
    });

    return { status: "sent", messageId: info.messageId ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP email send failed.";
    console.error("SMTP email send failed", { to, subject, error: message });
    return { status: "failed", error: message };
  }
}
