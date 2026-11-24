import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProgramView } from "@/components/programs/program-view";
import { TextLink } from "@/components/ui";
import { requireTenant } from "@/server/auth/session";
import { getProgram, programPermissions } from "@/server/programs/queries";
import { currentWeek, programViewInfo } from "@/server/programs/view";

export const metadata: Metadata = { title: "Preview" };

/** Coaches: see a block the way the athlete will. */
export default async function ProgramPreviewPage({
  params,
}: PageProps<"/[tenant]/programs/[id]/preview">) {
  const { tenant, id } = await params;
  const ctx = await requireTenant(tenant);
  if (!programPermissions(ctx).edit) notFound();
  const found = await getProgram(ctx, id);
  if (!found) notFound();
  const { program: p, client } = found;
  const info = await programViewInfo(ctx, p.content);
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <TextLink href={`/${ctx.tenantSlug}/programs/${p.id}`}>← Back to the builder</TextLink>
      <p className="border-border bg-surface text-subtle mt-6 mb-8 border px-4 py-3 text-sm">
        Preview: this is what {client ? `${client.firstName} sees` : "a client will see"} in the app
        {p.status === "active" ? "." : " once you assign it."} Weights aren&apos;t shown: athletes
        pick their own and log them (coming next).
      </p>
      <ProgramView
        slug={ctx.tenantSlug}
        name={p.name}
        goals={p.goals}
        weeks={p.weeks}
        initialWeek={currentWeek(p.startDate, p.weeks)}
        content={p.content}
        info={info}
      />
    </main>
  );
}
