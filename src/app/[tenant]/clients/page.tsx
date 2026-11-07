import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { can } from "@/server/auth/permissions";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ params }: PageProps<"/[tenant]/clients">) {
  const ctx = await requireTenant((await params).tenant);
  if (!can(ctx.roles, { athlete: ["create"] })) notFound();
  return (
    <ComingSoon
      eyebrow={ctx.tenantName}
      title="Clients"
      description="Everyone you coach, in one place."
      items={[
        "Client list with search and status filters",
        "Client profiles: goals, injuries, contact details and assigned trainer",
        "Website enquiry form that adds new leads here automatically",
      ]}
    />
  );
}
