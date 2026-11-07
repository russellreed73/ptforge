"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard, Button, ErrorText, Field, TextLink } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";

/** Second step of sign-in for people who turned on two-step login. */
function TwoFactorForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const code = String(form.get("code")).replace(/\s+/g, "");
    const trustDevice = form.get("trust") === "on";
    const { error } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });
    setPending(false);
    if (error) {
      return setError(
        error.status === 401 && /expired|session/i.test(error.message ?? "")
          ? "This sign-in has timed out. Please sign in again."
          : useBackup
            ? "That backup code isn't valid (each one works once)."
            : "That code isn't right. Check the time on your phone and try the newest code.",
      );
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-subtle text-sm">
        {useBackup
          ? "Enter one of the backup codes you saved when you set up two-step login."
          : "Open your authenticator app and enter the 6-digit code for PTForge."}
      </p>
      <Field
        key={useBackup ? "backup" : "totp"}
        label={useBackup ? "Backup code" : "Code"}
        name="code"
        autoComplete="one-time-code"
        inputMode={useBackup ? "text" : "numeric"}
        pattern={useBackup ? undefined : "[0-9 ]{6,7}"}
        required
        autoFocus
      />
      <label className="text-subtle flex items-center gap-2 text-sm">
        <input type="checkbox" name="trust" className="size-4 accent-[var(--primary)]" />
        Don&apos;t ask again on this device for 30 days
      </label>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Verify"}
      </Button>
      <button
        type="button"
        className="text-muted hover:text-foreground text-left text-sm"
        onClick={() => {
          setUseBackup(!useBackup);
          setError(null);
        }}
      >
        {useBackup ? "Use my authenticator app instead" : "Lost your phone? Use a backup code"}
      </button>
      <p className="text-muted text-sm">
        <TextLink href="/sign-in">Start over</TextLink>
      </p>
    </form>
  );
}

export default function TwoFactorPage() {
  return (
    <AuthCard title="Two-step login">
      <Suspense>
        <TwoFactorForm />
      </Suspense>
    </AuthCard>
  );
}
