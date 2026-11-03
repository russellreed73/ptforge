import { asc } from "drizzle-orm";
import type { Metadata } from "next";
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
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-1 text-slate-500">
        {heading} ({athletes.length})
      </p>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Service</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {athletes.map((a) => (
            <tr key={a.id} className="border-b border-slate-100 dark:border-slate-900">
              <td className="py-2 font-medium">
                {a.firstName} {a.lastName}
              </td>
              <td className="py-2">{a.serviceType.replace("_", " ")}</td>
              <td className="py-2">{a.status}</td>
            </tr>
          ))}
          {athletes.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-slate-500">
                No athletes yet. Client management arrives in phase 1.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
