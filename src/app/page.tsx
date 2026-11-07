import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink, TextLink, Wordmark } from "@/components/ui";
import { describeRoles } from "@/lib/roles";
import { getSession, listMyTenants } from "@/server/auth/session";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
        <Wordmark />
        <p className="eyebrow">Coaching software for trainers and strength coaches</p>
        <h1 className="display text-6xl sm:text-7xl">
          Train smart.
          <br />
          Coach <span className="text-primary">better.</span>
        </h1>
        <p className="text-subtle max-w-xl text-lg">
          Clients, programs, workout logging and progress in one place, with a phone app your
          athletes will actually use.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/sign-in">Sign in</ButtonLink>
          <ButtonLink href="/sign-up" variant="secondary">
            Create your business
          </ButtonLink>
        </div>
      </main>
    );
  }

  const tenants = await listMyTenants(session.user.id);
  if (tenants.length === 1) redirect(`/${tenants[0].slug}`);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
      <Wordmark className="mb-8" />
      <h1 className="display mb-6 text-5xl">Choose a business</h1>
      {tenants.length === 0 ? (
        <p className="text-muted">
          You aren&apos;t part of a coaching business yet. Ask your coach for an invitation, or{" "}
          <TextLink href="/welcome">create your own</TextLink>.
        </p>
      ) : (
        <ul className="border-border border">
          {tenants.map((t) => (
            <li key={t.id} className="border-border border-b last:border-b-0">
              <Link
                href={`/${t.slug}`}
                className="bg-surface hover:bg-surface-raised flex items-center justify-between px-5 py-4"
              >
                <span className="font-heading text-lg font-semibold tracking-wide uppercase">
                  {t.name}
                </span>
                <span className="text-muted text-sm">{describeRoles(t.roles)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
