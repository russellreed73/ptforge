import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Card, PageHeader, Pill, SectionTitle } from "@/components/ui";
import { STATUS_LABELS, statusTone, type ClientStatus } from "@/lib/clients";
import { requireTenant } from "@/server/auth/session";
import { clientPermissions, countClients, listClients } from "@/server/clients/queries";
import { athleteProfiles } from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";

export const metadata: Metadata = { title: "Dashboard" };

const dateFmt = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" });

export default async function TenantDashboard({ params }: PageProps<"/[tenant]">) {
  const ctx = await requireTenant((await params).tenant);
  const perms = clientPermissions(ctx);
  const base = `/${ctx.tenantSlug}`;

  if (!perms.create) {
    // Athletes: their own profile (Row-Level Security returns only theirs).
    const [me] = await withTenant(ctx, (tx) =>
      tx
        .select({
          firstName: athleteProfiles.firstName,
          serviceType: athleteProfiles.serviceType,
        })
        .from(athleteProfiles)
        .limit(1),
    );
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <PageHeader
          eyebrow={ctx.tenantName}
          title={me ? `Hi, ${me.firstName}` : "Welcome"}
          description={me?.serviceType || undefined}
        />
        <Card>
          <p className="text-subtle">
            Your programs, workout logging and messages with your coach will appear here.
          </p>
        </Card>
      </main>
    );
  }

  const [counts, leads] = await Promise.all([
    countClients(ctx),
    listClients(ctx, { view: "lead" }),
  ]);
  const tiles: { label: string; n: number; href: string }[] = [
    { label: "New leads", n: counts.lead, href: `${base}/clients?view=lead` },
    { label: "Active clients", n: counts.active, href: `${base}/clients?view=active` },
    { label: "Paused", n: counts.paused, href: `${base}/clients?view=paused` },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          eyebrow={ctx.tenantName}
          title="Dashboard"
          description={perms.seesAll ? "Everyone in the business." : "Clients you coach."}
        />
        <ButtonLink href={`${base}/clients/new`} className="mb-8">
          Add client
        </ButtonLink>
      </div>

      <div className="mb-12 grid gap-4 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="border-border bg-surface hover:border-primary border p-5 transition-colors"
          >
            <p className="font-heading text-muted text-xs font-semibold tracking-[0.15em] uppercase">
              {t.label}
            </p>
            <p className="display mt-2 text-5xl tabular-nums">{t.n}</p>
          </Link>
        ))}
      </div>

      <SectionTitle count={leads.length}>Leads to follow up</SectionTitle>
      {leads.length === 0 ? (
        <p className="text-muted border-border border p-6">
          No new leads. Share your Apply form from Settings so people can apply.
        </p>
      ) : (
        <ul className="border-border divide-border divide-y border">
          {leads.slice(0, 10).map((l) => (
            <li key={l.id}>
              <Link
                href={`${base}/clients/${l.id}`}
                className="hover:bg-surface flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span>
                  <span className="font-semibold">
                    {l.firstName} {l.lastName}
                  </span>
                  <span className="text-muted ml-3 text-sm">{l.serviceType}</span>
                </span>
                <span className="flex items-center gap-3 text-sm">
                  <span className="text-muted">{dateFmt.format(l.appliedAt ?? l.createdAt)}</span>
                  <Pill tone={statusTone(l.status)}>{STATUS_LABELS[l.status as ClientStatus]}</Pill>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
