import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, inputClass, PageHeader, Pill, Table, Td, Th } from "@/components/ui";
import { STATUS_LABELS, statusTone, type ClientStatus } from "@/lib/clients";
import { readBusinessMetadata } from "@/lib/themes";
import { requireTenant } from "@/server/auth/session";
import { getBusinessBranding } from "@/server/brand/queries";
import {
  clientPermissions,
  countClients,
  listClients,
  listCoaches,
  readClientFilters,
} from "@/server/clients/queries";

export const metadata: Metadata = { title: "Clients" };

const dateFmt = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" });

export default async function ClientsPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/clients">) {
  const ctx = await requireTenant((await params).tenant);
  const perms = clientPermissions(ctx);
  if (!perms.create) notFound();
  const filters = readClientFilters(await searchParams);
  const [clients, counts, brand, coaches] = await Promise.all([
    listClients(ctx, filters),
    countClients(ctx),
    getBusinessBranding(ctx.tenantId),
    perms.seesAll ? listCoaches(ctx.tenantId) : Promise.resolve([]),
  ]);
  const services = brand?.services ?? readBusinessMetadata(null).services;
  const base = `/${ctx.tenantSlug}/clients`;

  const tabs: { view: NonNullable<typeof filters.view>; label: string; n: number }[] = [
    { view: "all", label: "All", n: counts.all },
    { view: "lead", label: "Leads", n: counts.lead },
    { view: "active", label: "Active", n: counts.active },
    { view: "paused", label: "Paused", n: counts.paused },
    { view: "archived", label: "Archived", n: counts.archived },
  ];
  const tabHref = (view: string) => {
    const sp = new URLSearchParams();
    if (view !== "all") sp.set("view", view);
    if (filters.q) sp.set("q", filters.q);
    if (filters.service) sp.set("service", filters.service);
    if (filters.trainer) sp.set("trainer", filters.trainer);
    const s = sp.toString();
    return s ? `${base}?${s}` : base;
  };
  const filtered = Boolean(filters.q || filters.service || filters.trainer);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          eyebrow={ctx.tenantName}
          title="Clients"
          description={
            perms.seesAll ? "Everyone in the business." : "Clients you're assigned to coach."
          }
        />
        <ButtonLink href={`${base}/new`} className="mb-8">
          Add client
        </ButtonLink>
      </div>

      <nav
        className="border-border mb-6 flex flex-wrap gap-x-6 gap-y-2 border-b"
        aria-label="Client status"
      >
        {tabs.map((t) => {
          const active = (filters.view ?? "all") === t.view;
          return (
            <Link
              key={t.view}
              href={tabHref(t.view)}
              aria-current={active ? "page" : undefined}
              className={`font-heading -mb-px border-b-2 pb-3 text-sm font-semibold tracking-[0.15em] uppercase ${
                active
                  ? "border-primary text-foreground"
                  : "text-subtle hover:text-foreground border-transparent"
              }`}
            >
              {t.label} <span className="text-muted font-normal">{t.n}</span>
            </Link>
          );
        })}
      </nav>

      <form className="mb-6 flex flex-wrap items-end gap-3" role="search">
        {filters.view && filters.view !== "all" && (
          <input type="hidden" name="view" value={filters.view} />
        )}
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Search name, email or Instagram"
          aria-label="Search clients"
          className={`${inputClass} min-w-64 flex-1`}
        />
        <select
          name="service"
          defaultValue={filters.service ?? ""}
          aria-label="Service"
          className={inputClass}
        >
          <option value="">All services</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {perms.seesAll && (
          <select
            name="trainer"
            defaultValue={filters.trainer ?? ""}
            aria-label="Trainer"
            className={inputClass}
          >
            <option value="">All trainers</option>
            <option value="none">No trainer yet</option>
            {coaches.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <button className="btn-shape bg-primary text-primary-foreground hover:bg-primary-hover font-heading px-5 py-2.5 text-sm font-semibold tracking-[0.15em] uppercase">
          Filter
        </button>
        {filtered && (
          <Link
            href={filters.view && filters.view !== "all" ? `${base}?view=${filters.view}` : base}
            className="font-heading text-subtle hover:text-primary py-2.5 text-xs font-semibold tracking-[0.15em] uppercase"
          >
            Clear
          </Link>
        )}
      </form>

      {clients.length === 0 ? (
        <p className="text-subtle border-border border p-8 text-center">
          {filtered || (filters.view && filters.view !== "all")
            ? "No clients match."
            : "No clients yet. Add one, or share your Apply form (Settings) so people can apply."}
        </p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Status</Th>
              <Th className="hidden md:table-cell">Service</Th>
              <Th className="hidden md:table-cell">Trainer</Th>
              <Th className="hidden lg:table-cell">Added</Th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-surface">
                <Td>
                  <Link href={`${base}/${c.id}`} className="hover:text-primary font-semibold">
                    {c.firstName} {c.lastName}
                  </Link>
                  {c.email && <p className="text-muted text-xs">{c.email}</p>}
                </Td>
                <Td>
                  <Pill tone={c.archivedAt ? "muted" : statusTone(c.status)}>
                    {c.archivedAt
                      ? "Archived"
                      : (STATUS_LABELS[c.status as ClientStatus] ?? c.status)}
                  </Pill>
                  {c.hasLogin && <span className="text-muted ml-2 text-xs">Uses app</span>}
                </Td>
                <Td className="text-subtle hidden md:table-cell">{c.serviceType || "—"}</Td>
                <Td className="text-subtle hidden md:table-cell">
                  {c.trainers.length ? (
                    c.trainers.join(", ")
                  ) : (
                    <span className="text-muted">None</span>
                  )}
                </Td>
                <Td className="text-muted hidden lg:table-cell">
                  {dateFmt.format(c.appliedAt ?? c.createdAt)}
                  {c.source === "website_form" && " · Applied online"}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </main>
  );
}
