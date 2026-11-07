"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard, Button, ErrorText, Field } from "@/components/ui";
import { signUp } from "@/lib/auth-client";
import { RESERVED_SLUGS, slugify } from "@/lib/slug";

/**
 * Self-serve signup for a coach.
 * 1. Create the login here; PTForge emails a confirmation link.
 * 2. The link signs them in and opens /welcome, which creates the business.
 */
export default function SignUpPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [business, setBusiness] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const slug = slugify(business);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!slug || RESERVED_SLUGS.has(slug)) {
      return setError("Please choose a different business name.");
    }
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const { error: signUpError } = await signUp.email({
      name: String(form.get("name")),
      email,
      password: String(form.get("password")),
      // Where the confirmation link lands; the business is created there.
      callbackURL: `/welcome?business=${encodeURIComponent(business)}`,
    });
    setPending(false);
    if (signUpError) {
      return setError(signUpError.message ?? "Could not create your account.");
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email">
        <p>
          We sent a confirmation link to <strong>{sentTo}</strong>. Open it on this device to finish
          setting up {business || "your business"}.
        </p>
        <p className="text-sm text-slate-500">
          The link expires in 1 hour. Nothing there? Check your spam folder, or{" "}
          <Link href="/sign-in" className="underline">
            sign in
          </Link>{" "}
          to get a new link.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your coaching business">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Your name" name="name" autoComplete="name" required />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={16}
          maxLength={128}
          required
          hint="At least 16 characters. A short sentence is easy to remember."
        />
        <Field
          label="Business name"
          name="business"
          required
          value={business}
          onChange={(e) => setBusiness(e.target.value)}
          hint={slug ? `Your address: ptforge.app/${slug}` : undefined}
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
        <p className="text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
