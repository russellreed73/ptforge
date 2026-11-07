"use client";

import { useState } from "react";
import { AuthCard, Button, ErrorText, Field, TextLink } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (error?.status === 429) {
      return setError("Too many attempts. Please wait a minute and try again.");
    }
    // Same message whether or not the account exists, so nobody can probe for emails.
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email">
        <p>
          If an account exists for <strong>{sentTo}</strong>, we&apos;ve sent a link to choose a new
          password. It expires in 1 hour.
        </p>
        <p className="text-muted text-sm">
          Nothing there? Check your spam folder.{" "}
          <TextLink href="/sign-in">Back to sign in</TextLink>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot password">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <p className="text-subtle text-sm">
          Enter your email and we&apos;ll send you a link to choose a new password.
        </p>
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
        <p className="text-muted text-sm">
          Remembered it? <TextLink href="/sign-in">Sign in</TextLink>
        </p>
      </form>
    </AuthCard>
  );
}
