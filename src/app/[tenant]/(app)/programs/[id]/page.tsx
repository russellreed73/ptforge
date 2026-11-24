import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProgramBuilder } from "@/components/programs/program-builder";
import { TextLink } from "@/components/ui";
import type { ProgramStatus } from "@/lib/programs";
import { requireTenant } from "@/server/auth/session";
import { exercisePickerList, getProgram, programPermissions } from "@/server/programs/queries";
import { ProgramStatusButtons } from "../program-buttons";

export const metadata: Metadata = { title: "Program builder" };

export default async function ProgramBuilderPage({ params }: PageProps<"/[tenant]/programs/[id]">) {
  const { tenant, id } = await params;
  const ctx = await requireTenant(tenant);
  const perms = programPermissions(ctx);
  if (!perms.edit) notFound();
  const [found, library] = await Promise.all([getProgram(ctx, id), exercisePickerList(ctx)]);
  if (!found) notFound();
  const { program: p, client } = found;
  const base = `/${ctx.tenantSlug}`;
  const backHref = client ? `${base}/clients/${client.id}?tab=program` : `${base}/programs`;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <TextLink href={backHref}>
        ← {client ? `${client.firstName} ${client.lastName}` : "Program templates"}
      </TextLink>
      <header className="mt-6 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">
            {client ? `Program for ${client.firstName} ${client.lastName}` : "Program template"}
          </p>
          <h1 className="display text-5xl">Program builder</h1>
          <p className="text-subtle mt-3 max-w-2xl">
            Type an exercise name and pick it from the library; its video and details come with it.
            Each set gets an RPE target for every week, or a backdown % off the set before.
          </p>
        </div>
        <ProgramStatusButtons slug={ctx.tenantSlug} id={p.id} status={p.status} />
      </header>
      <ProgramBuilder
        slug={ctx.tenantSlug}
        library={library}
        backHref={backHref}
        previewHref={`${base}/programs/${p.id}/preview`}
        canAssign={perms.assign}
        program={{
          id: p.id,
          name: p.name,
          goals: p.goals ?? "",
          weeks: p.weeks,
          startDate: p.startDate ?? "",
          status: p.status as ProgramStatus,
          content: p.content,
          isTemplate: !client,
        }}
      />
    </main>
  );
}
