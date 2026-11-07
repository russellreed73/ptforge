import { render, toPlainText } from "@react-email/render";
import nodemailer, { type Transporter } from "nodemailer";
import type { ReactElement } from "react";
import { Resend } from "resend";

/**
 * Where emails go, decided by environment variables:
 *
 *   RESEND_API_KEY set  → Resend (production on Vercel)
 *   SMTP_URL set        → that SMTP server; locally Mailpit (smtp://localhost:1025),
 *                         read the emails at http://localhost:8025
 *   neither             → printed to the terminal (tests and CI)
 *
 * In production a missing RESEND_API_KEY is an error, so emails can never be
 * silently dropped.
 */
export type EmailTransport = "resend" | "smtp" | "console";

export function chooseTransport(env: NodeJS.ProcessEnv = process.env): EmailTransport {
  if (env.RESEND_API_KEY) return "resend";
  if (env.SMTP_URL) return "smtp";
  if (env.VERCEL_ENV === "production") {
    throw new Error("RESEND_API_KEY is not set: production cannot send email.");
  }
  return "console";
}

export type SendEmailInput = {
  to: string;
  subject: string;
  /** A React Email template, e.g. <VerifyEmail name="…" url="…" /> */
  react: ReactElement;
};

export type RenderedEmail = { html: string; text: string };

export async function renderEmail(react: ReactElement): Promise<RenderedEmail> {
  const html = await render(react);
  return { html, text: toPlainText(html) };
}

const from = () => process.env.EMAIL_FROM ?? "PTForge <no-reply@mail.ptforge.app>";

let resend: Resend | undefined;
let smtp: Transporter | undefined;

export async function sendEmail({ to, subject, react }: SendEmailInput): Promise<void> {
  const { html, text } = await renderEmail(react);
  const transport = chooseTransport();

  if (transport === "resend") {
    resend ??= new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: from(), to, subject, html, text });
    if (error) throw new Error(`Resend failed to send "${subject}" to ${to}: ${error.message}`);
    return;
  }

  if (transport === "smtp") {
    smtp ??= nodemailer.createTransport(process.env.SMTP_URL);
    await smtp.sendMail({ from: from(), to, subject, html, text });
    return;
  }

  console.info(`\n[email] To: ${to}\n[email] Subject: ${subject}\n${text}\n`);
}
