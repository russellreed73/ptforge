"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard, Button, ErrorText, Field } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { RESERVED_SLUGS, slugify } from "@/lib/slug";

/**
 * Where the email confirmation link lands (signed in by then).
 * Creates the coach's business with the name they typed at sign-up.
 */
function WelcomeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const linkError = params.get("error");
  const [business, setBusiness] = useState(params.get("business") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const slug = slugify(business);

  if (linkError) {
    return (
      <div className="flex flex-col gap-3">
        <p>That confirmation link has expired or was already used.</p>
        <p className="text-muted text-sm">
          <Link
            href="/sign-in"
            className="text-foreground decoration-primary underline underline-offset-4"
          >
            Sign in
          </Link>{" "}
          with your email and password and we&apos;ll send you a fresh link.
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!slug || RESERVED_SLUGS.has(slug)) {
      return setError("Please choose a different business name.");
    }
    setPending(true);
    const { error } = await authClient.organization.create({ name: business.trim(), slug });
    setPending(false);
    if (error) {
      return setError(
        error.code === "ORGANIZATION_SLUG_ALREADY_TAKEN" ||
          error.code === "ORGANIZATION_ALREADY_EXISTS"
          ? `ptforge.app/${slug} is taken. Try a different business name.`
          : (error.message ?? "Could not create your business."),
      );
    }
    router.push(`/${slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p>Your email is confirmed. One last step: name your business.</p>
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
        {pending ? "Creating…" : "Create business"}
      </Button>
      <p className="text-muted text-sm">
        Joining someone else&apos;s business instead? Use the invitation link they emailed you.
      </p>
    </form>
  );
}

export default function WelcomePage() {
  return (
    <AuthCard title="Welcome to PTForge">
      <Suspense>
        <WelcomeForm />
      </Suspense>
    </AuthCard>
  );
}
