"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard, Button, ErrorText, Field } from "@/components/ui";
import { authClient, signUp } from "@/lib/auth-client";
import { RESERVED_SLUGS, slugify } from "@/lib/slug";

/** Self-serve signup for a coach: creates their login and their business. */
export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [business, setBusiness] = useState("");
  const slug = slugify(business);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!slug || RESERVED_SLUGS.has(slug)) {
      return setError("Please choose a different business name.");
    }
    setPending(true);
    const form = new FormData(e.currentTarget);
    const { error: signUpError } = await signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (signUpError) {
      setPending(false);
      return setError(signUpError.message ?? "Could not create your account.");
    }
    const { error: orgError } = await authClient.organization.create({ name: business, slug });
    setPending(false);
    if (orgError) {
      return setError(
        orgError.message ??
          "Your account was created, but the business name is taken. Try another.",
      );
    }
    router.push(`/${slug}`);
    router.refresh();
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
