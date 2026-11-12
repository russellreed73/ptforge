import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { Card, PageHeader, TextLink } from "@/components/ui";
import { requireTenant } from "@/server/auth/session";
import { exercisePermissions, getExercise } from "@/server/exercises/queries";
import { streamConfig } from "@/server/video/stream";

export const metadata: Metadata = { title: "Edit exercise" };

export default async function EditExercisePage({
  params,
}: PageProps<"/[tenant]/exercises/[id]/edit">) {
  const { tenant, id } = await params;
  const ctx = await requireTenant(tenant);
  if (!exercisePermissions(ctx).edit) notFound();
  const found = await getExercise(ctx, id);
  if (!found) notFound();
  const { exercise: e, video } = found;
  const base = `/${ctx.tenantSlug}/exercises`;
  // Starter exercises are shared; send people to their copy instead.
  if (e.tenantId === null)
    redirect(found.copyId ? `${base}/${found.copyId}/edit` : `${base}/${e.id}`);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <TextLink href={`${base}/${e.id}`}>← {e.name}</TextLink>
      <div className="mt-6">
        <PageHeader eyebrow={ctx.tenantName} title="Edit exercise" />
      </div>
      <Card>
        <ExerciseForm
          slug={ctx.tenantSlug}
          exerciseId={e.id}
          uploadsEnabled={streamConfig() !== null}
          initial={{
            name: e.name,
            muscles: e.primaryMuscles?.join(", ") ?? "",
            family: e.category ?? "",
            equipment: e.equipment ?? "",
            movement: e.movement ?? "",
            tags: e.tags.join(", "),
            cues: e.cues ?? "",
            competitionLift: e.isCompetitionLift,
            videoUrl: e.demoVideoUrl ?? "",
            videoAssetId: video?.id ?? null,
            videoFileName: video?.fileName ?? null,
          }}
        />
      </Card>
    </main>
  );
}
