import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoPlayer, type PlayerVideo } from "@/components/exercises/video-player";
import { Card, Pill, TextLink } from "@/components/ui";
import { exerciseSummary } from "@/lib/exercises";
import { requireTenant } from "@/server/auth/session";
import { exercisePermissions, getExercise } from "@/server/exercises/queries";
import { streamConfig, streamIframeUrl } from "@/server/video/stream";
import { ExerciseActions } from "../exercise-actions";

export const metadata: Metadata = { title: "Exercise" };

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-heading text-muted text-xs font-semibold tracking-[0.15em] uppercase">
        {label}
      </dt>
      <dd className={children ? "" : "text-muted"}>{children || "—"}</dd>
    </div>
  );
}

export default async function ExercisePage({ params }: PageProps<"/[tenant]/exercises/[id]">) {
  const { tenant, id } = await params;
  const ctx = await requireTenant(tenant);
  const perms = exercisePermissions(ctx);
  if (!perms.create) notFound();
  const found = await getExercise(ctx, id);
  if (!found) notFound();
  const { exercise: e, video, copyId } = found;
  const base = `/${ctx.tenantSlug}/exercises`;

  const player: PlayerVideo | null = video
    ? {
        type: "upload",
        iframeUrl: streamIframeUrl(streamConfig(), video.providerRef),
        status: video.status,
        videoAssetId: video.id,
      }
    : e.demoVideoUrl
      ? { type: "link", url: e.demoVideoUrl }
      : null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <TextLink href={base}>← Exercises</TextLink>
      <header className="mt-6 mb-8 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow mb-3">{e.category ?? "Exercise"}</p>
          <h1 className="display text-5xl">{e.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {e.tenantId === null && <Pill tone="muted">PTForge starter</Pill>}
            {e.isCompetitionLift && <Pill tone="primary">Competition lift</Pill>}
            {e.archivedAt && <Pill tone="muted">Archived</Pill>}
            {exerciseSummary(e) && <span className="text-subtle">{exerciseSummary(e)}</span>}
          </div>
        </div>
        <ExerciseActions
          slug={ctx.tenantSlug}
          id={e.id}
          isStarter={e.tenantId === null}
          copyId={copyId}
          archived={Boolean(e.archivedAt)}
          canEdit={perms.edit}
          canArchive={perms.archive}
        />
      </header>

      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div>
          {player ? (
            <VideoPlayer slug={ctx.tenantSlug} title={e.name} video={player} />
          ) : (
            <div className="border-border text-subtle flex aspect-video items-center justify-center border p-6 text-center text-sm">
              No demo video yet.
              {e.tenantId !== null && perms.edit && (
                <>
                  {" "}
                  <Link
                    href={`${base}/${e.id}/edit`}
                    className="text-foreground ml-1 underline underline-offset-4"
                  >
                    Add one
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
        <Card>
          <dl className="flex flex-col gap-5">
            <Detail label="Muscle group">{e.primaryMuscles?.join(", ")}</Detail>
            <Detail label="Lift family">{e.category}</Detail>
            <Detail label="Equipment">{e.equipment}</Detail>
            <Detail label="Movement type">{e.movement}</Detail>
            <Detail label="Coaching cues">
              {e.cues ? <span className="whitespace-pre-line">{e.cues}</span> : null}
            </Detail>
            <Detail label="Tags">
              {e.tags.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {e.tags.map((t) => (
                    <Link
                      key={t}
                      href={`${base}?q=${encodeURIComponent(t)}`}
                      className="border-border text-subtle hover:text-foreground border px-2 py-0.5 text-xs"
                    >
                      {t}
                    </Link>
                  ))}
                </span>
              ) : null}
            </Detail>
          </dl>
        </Card>
      </div>
    </main>
  );
}
