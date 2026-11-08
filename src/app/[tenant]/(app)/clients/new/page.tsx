import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, PageHeader, TextLink } from "@/components/ui";
import { requireTenant } from "@/server/auth/session";
import { getBusinessBranding } from "@/server/brand/queries";
import { clientPermissions, listCoaches } from "@/server/clients/queries";
import { NewClientForm } from "./new-client-form";

export const metadata: Metadata = { title: "Add client" };

export default async function NewClientPage({ params }: PageProps<"/[tenant]/clients/new">) {
  const ctx = await requireTenant((await params).tenant);
  const perms = clientPermissions(ctx);
  if (!perms.create) notFound();
  const [brand, coaches] = await Promise.all([
    getBusinessBranding(ctx.tenantId),
    listCoaches(ctx.tenantId),
  ]);
  const base = `/${ctx.tenantSlug}/clients`;
  const me = coaches.find((c) => c.userId === ctx.userId);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <TextLink href={base}>← Clients</TextLink>
      <div className="mt-6">
        <PageHeader
          eyebrow={ctx.tenantName}
          title="Add client"
          description={
            perms.assign
              ? "Only the name is required. You can fill in the detailed intake on their profile after the onboarding call."
              : "Only the name is required. You'll be their trainer. Fill in the detailed intake on their profile after the onboarding call."
          }
        />
      </div>
      <Card>
        <NewClientForm
          slug={ctx.tenantSlug}
          services={brand?.services ?? []}
          coaches={coaches}
          canAssign={perms.assign}
          defaultTrainer={me?.userId ?? ""}
        />
      </Card>
    </main>
  );
}
