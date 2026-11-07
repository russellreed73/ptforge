import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader, Table, Td, Th } from "@/components/ui";
import { can } from "@/server/auth/permissions";
import { requireTenant } from "@/server/auth/session";
import { athleteProfiles } from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";

export const metadata: Metadata = { title: "Dashboard" };

export default async function TenantDashboard({ params }: PageProps<"/[tenant]">) {
  const { tenant } = await params;
  const ctx = await requireTenant(tenant);

  // Row-Level Security decides which athletes come back: all of them for
  // administrators and managers, assigned ones for trainers, self for athletes.
  const athletes = await withTenant(ctx, (tx) =>
    tx
      .select({
        id: athleteProfiles.id,
        firstName: athleteProfiles.firstName,
        lastName: athleteProfiles.lastName,
        serviceType: athleteProfiles.serviceType,
        status: athleteProfiles.status,
      })
      .from(athleteProfiles)
      .orderBy(asc(athleteProfiles.lastName), asc(athleteProfiles.firstName)),
  );

  const seesAll = can(ctx.roles, { athlete: ["view_all"] });
  const athleteOnly = ctx.roles.length === 1 && ctx.roles[0] === "athlete";
  const heading = seesAll
    ? "All athletes in the business"
    : athleteOnly
      ? "Your profile"
      : "Athletes assigned to you";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <PageHeader
        eyebrow={ctx.tenantName}
        title="Dashboard"
        description={`${heading} (${athletes.length})`}
      />

      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Service</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {athletes.map((a) => (
            <tr key={a.id} className="hover:bg-surface">
              <Td className="font-semibold">
                {a.firstName} {a.lastName}
              </Td>
              <Td className="text-subtle capitalize">{a.serviceType.replace("_", " ")}</Td>
              <Td>
                <span className={a.status === "active" ? "text-accent" : "text-muted"}>
                  {a.status}
                </span>
              </Td>
            </tr>
          ))}
          {athletes.length === 0 && (
            <tr>
              <Td colSpan={3} className="text-muted py-10 text-center">
                No athletes yet. Client management arrives in phase 1.
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
    </main>
  );
}
