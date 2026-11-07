import { createElement } from "react";
import { describe, expect, it } from "vitest";
import Invitation from "@/emails/invitation";
import ResetPassword from "@/emails/reset-password";
import VerifyEmail from "@/emails/verify-email";
import { chooseTransport, renderEmail } from "@/server/email/send";

describe("chooseTransport()", () => {
  it("uses Resend when an API key is set", () => {
    expect(chooseTransport({ RESEND_API_KEY: "re_123", SMTP_URL: "smtp://x" } as never)).toBe(
      "resend",
    );
  });
  it("uses SMTP (Mailpit) locally", () => {
    expect(chooseTransport({ SMTP_URL: "smtp://localhost:1025" } as never)).toBe("smtp");
  });
  it("prints to the terminal in tests and CI", () => {
    expect(chooseTransport({} as never)).toBe("console");
  });
  it("refuses to drop emails in production", () => {
    expect(() => chooseTransport({ VERCEL_ENV: "production" } as never)).toThrow(/RESEND_API_KEY/);
  });
});

describe("email templates", () => {
  it("verification email carries the link and the person's name", async () => {
    const url = "https://ptforge.app/api/auth/verify-email?token=abc";
    const { html, text } = await renderEmail(createElement(VerifyEmail, { name: "Jacob", url }));
    expect(html).toContain(url.replace("&", "&amp;"));
    expect(text).toContain("Hi Jacob");
    expect(text).toContain(url);
  });

  it("password reset email carries the link", async () => {
    const url = "https://ptforge.app/api/auth/reset-password/tok";
    const { text } = await renderEmail(createElement(ResetPassword, { name: "Maya", url }));
    expect(text).toContain(url);
    expect(text).toContain("expires in 1 hour");
  });

  it("invitation reads naturally for each role", async () => {
    const base = {
      inviterName: "Jacob",
      businessName: "Jacob Strength",
      url: "https://ptforge.app/accept-invite/1",
    };
    const athlete = await renderEmail(createElement(Invitation, { ...base, roleLabel: "athlete" }));
    expect(athlete.text).toContain("as an athlete");
    expect(athlete.text).toContain("from your phone");

    const both = await renderEmail(
      createElement(Invitation, { ...base, roleLabel: "manager and trainer" }),
    );
    expect(both.text).toContain("as a manager and trainer");
    expect(both.text).toContain("PTForge web app");
  });
});

describe("invitation footer", () => {
  it("explains why an invitee got the email", async () => {
    const { text } = await renderEmail(
      createElement(Invitation, {
        inviterName: "Jacob",
        businessName: "Jacob Strength",
        roleLabel: "athlete",
        url: "https://ptforge.app/accept-invite/1",
      }),
    );
    expect(text).toContain("because Jacob invited this email address");
  });
});
