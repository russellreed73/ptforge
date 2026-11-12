import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EMPTY_EXERCISE, ExerciseForm } from "@/components/exercises/exercise-form";
import { Card, PageHeader, TextLink } from "@/components/ui";
import { requireTenant } from "@/server/auth/session";
import { exercisePermissions } from "@/server/exercises/queries";
import { streamConfig } from "@/server/video/stream";

export const metadata: Metadata = { title: "Add exercise" };

export default async function NewExercisePage({ params }: PageProps<"/[tenant]/exercises/new">) {
  const ctx = await requireTenant((await params).tenant);
  if (!exercisePermissions(ctx).create) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <TextLink href={`/${ctx.tenantSlug}/exercises`}>← Exercises</TextLink>
      <div className="mt-6">
        <PageHeader
          eyebrow={ctx.tenantName}
          title="Add exercise"
          description="New exercises appear in search right away, and in the program builder when it arrives."
        />
      </div>
      <Card>
        <ExerciseForm
          slug={ctx.tenantSlug}
          initial={EMPTY_EXERCISE}
          uploadsEnabled={streamConfig() !== null}
        />
      </Card>
    </main>
  );
}
