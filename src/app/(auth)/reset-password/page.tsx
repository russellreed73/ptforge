"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard, Button, ButtonLink, ErrorText, Field, TextLink } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

/** Where the emailed reset link lands: /reset-password?token=… (or ?error=INVALID_TOKEN). */
function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p>Your password has been changed and you&apos;ve been signed out everywhere else.</p>
        <ButtonLink href="/sign-in">Sign in</ButtonLink>
      </div>
    );
  }

  if (!token || params.get("error")) {
    return (
      <div className="flex flex-col gap-3">
        <p>This reset link has expired or was already used.</p>
        <p className="text-muted text-sm">
          <TextLink href="/forgot-password">Request a new link</TextLink>
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) return setError("The passwords don't match.");
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token: token! });
    setPending(false);
    if (error) {
      return setError(
        error.code === "INVALID_TOKEN"
          ? "This reset link has expired. Request a new one."
          : (error.message ?? "Could not change your password."),
      );
    }
    setDone(true);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={16}
        maxLength={128}
        required
        hint="At least 16 characters. A short sentence is easy to remember."
      />
      <Field
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        minLength={16}
        maxLength={128}
        required
      />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthCard>
  );
}
