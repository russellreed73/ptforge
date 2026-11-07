"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard, Button, ErrorText, Field } from "@/components/ui";
import { signIn } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";

function SignInForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const { data, error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      rememberMe: true,
    });
    setPending(false);
    if (error?.code === "EMAIL_NOT_VERIFIED") {
      // Better Auth has just emailed a fresh confirmation link (sendOnSignIn).
      return setError(
        "Please confirm your email first. We've sent a new confirmation link; it expires in 1 hour.",
      );
    }
    if (error) return setError(error.message ?? "Sign-in failed.");
    // Two-step login is on: ask for the code from their authenticator app.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      router.push(`/two-factor?next=${encodeURIComponent(safeNext(next))}`);
      return;
    }
    router.push(safeNext(next));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <p className="-mt-2 text-right text-sm">
        <Link href="/forgot-password" className="text-muted hover:text-foreground">
          Forgot password?
        </Link>
      </p>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-muted text-sm">
        New coach?{" "}
        <Link
          href="/sign-up"
          className="text-foreground decoration-primary underline underline-offset-4"
        >
          Create your business
        </Link>
      </p>
    </form>
  );
}

export default function SignInPage() {
  return (
    <AuthCard title="Sign in">
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
