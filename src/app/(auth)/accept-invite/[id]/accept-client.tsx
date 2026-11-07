"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorText, Field } from "@/components/ui";
import { authClient, signIn, signOut } from "@/lib/auth-client";
import { createInvitedAccount } from "./actions";

type Props = {
  invitationId: string;
  email: string;
  businessSlug: string;
  hasAccount: boolean;
  signedInEmail: string | null;
};

export function AcceptInvite({
  invitationId,
  email,
  businessSlug,
  hasAccount,
  signedInEmail,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const here = `/accept-invite/${invitationId}`;

  async function accept() {
    const { error } = await authClient.organization.acceptInvitation({ invitationId });
    if (error) {
      setPending(false);
      return setError(error.message ?? "Could not accept the invitation.");
    }
    router.push(`/${businessSlug}`);
    router.refresh();
  }

  // Signed in as someone else
  if (signedInEmail && signedInEmail.toLowerCase() !== email.toLowerCase()) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          You&apos;re signed in as {signedInEmail}, but this invitation is for {email}.
        </p>
        <Button
          onClick={async () => {
            await signOut();
            router.refresh();
          }}
        >
          Sign out and continue
        </Button>
      </div>
    );
  }

  // Signed in as the invited person
  if (signedInEmail) {
    return (
      <div className="flex flex-col gap-3">
        <ErrorText>{error}</ErrorText>
        <Button
          disabled={pending}
          onClick={() => {
            setPending(true);
            setError(null);
            void accept();
          }}
        >
          {pending ? "Joining…" : "Accept invitation"}
        </Button>
        <button
          className="text-sm text-slate-500 underline"
          disabled={pending}
          onClick={async () => {
            await authClient.organization.rejectInvitation({ invitationId });
            router.push("/");
            router.refresh();
          }}
        >
          Decline
        </button>
      </div>
    );
  }

  // Has an account but isn't signed in
  if (hasAccount) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          You already have a PTForge account. Sign in to accept.
        </p>
        <Link
          href={`/sign-in?next=${encodeURIComponent(here)}`}
          className="rounded-md bg-slate-900 px-4 py-2 text-center font-medium text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Sign in
        </Link>
      </div>
    );
  }

  // New to PTForge: create the account, sign in, accept
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    const created = await createInvitedAccount({
      invitationId,
      name: String(form.get("name")),
      password,
    });
    if (!created.ok) {
      setPending(false);
      return setError(created.error);
    }
    const { error } = await signIn.email({ email: created.email, password, rememberMe: true });
    if (error) {
      setPending(false);
      return setError(error.message ?? "Your account was created, but signing in failed.");
    }
    await accept();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Email" value={email} readOnly disabled />
      <Field label="Your name" name="name" autoComplete="name" required />
      <Field
        label="Choose a password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={16}
        maxLength={128}
        required
        hint="At least 16 characters. A short sentence is easy to remember."
      />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={pending}>
        {pending ? "Joining…" : "Create account and join"}
      </Button>
      <p className="text-xs text-slate-500">Not expecting this? You can ignore the invitation.</p>
    </form>
  );
}
