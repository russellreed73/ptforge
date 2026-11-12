import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, inputClass, PageHeader, Pill } from "@/components/ui";
import { exerciseSummary } from "@/lib/exercises";
import { requireTenant } from "@/server/auth/session";
import { getBusinessBranding } from "@/server/brand/queries";
import {
  exerciseFacets,
  exercisePermissions,
  listExercises,
  readExerciseFilters,
} from "@/server/exercises/queries";
import { StarterToggle } from "./exercise-actions";

export const metadata: Metadata = { title: "Exercises" };

export default async function ExercisesPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/exercises">) {
  const ctx = await requireTenant((await params).tenant);
  if (!exercisePermissions(ctx).create) notFound();
  const perms = exercisePermissions(ctx);
  const filters = readExerciseFilters(await searchParams);
  const brand = await getBusinessBranding(ctx.tenantId);
  const showStarters = brand?.showStarterExercises ?? true;
  const [list, facets] = await Promise.all([
    listExercises(ctx, filters, { showStarters }),
    exerciseFacets(ctx),
  ]);
  const base = `/${ctx.tenantSlug}/exercises`;
  const tagHref = (tag: string) => `${base}?q=${encodeURIComponent(tag)}`;
  const filtered = Boolean(
    filters.q ||
    filters.family ||
    filters.equipment ||
    filters.source !== "all" ||
    filters.video !== "any",
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          eyebrow={ctx.tenantName}
          title={filters.archived ? "Archived exercises" : "Exercise library"}
          description="Search by name, muscle, family, equipment, movement or tag. Try “biceps”."
        />
        <ButtonLink href={`${base}/new`} className="mb-8">
          Add exercise
        </ButtonLink>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        {filters.archived && <input type="hidden" name="archived" value="1" />}
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Search exercises…"
          aria-label="Search exercises"
          className={`${inputClass} min-w-64 flex-1`}
        />
        <select
          name="family"
          defaultValue={filters.family ?? ""}
          aria-label="Lift family"
          className={inputClass}
        >
          <option value="">All families</option>
          {facets.families.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          name="equipment"
          defaultValue={filters.equipment ?? ""}
          aria-label="Equipment"
          className={inputClass}
        >
          <option value="">All equipment</option>
          {facets.equipment.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        {showStarters && (
          <select
            name="source"
            defaultValue={filters.source}
            aria-label="Source"
            className={inputClass}
          >
            <option value="all">Yours + starter</option>
            <option value="own">Yours only</option>
            <option value="starter">PTForge starter</option>
          </select>
        )}
        <select name="video" defaultValue={filters.video} aria-label="Video" className={inputClass}>
          <option value="any">Any video</option>
          <option value="with">Has video</option>
          <option value="without">No video yet</option>
        </select>
        <button className="btn-shape bg-primary text-primary-foreground hover:bg-primary-hover font-heading px-5 py-2.5 text-sm font-semibold tracking-[0.15em] uppercase">
          Search
        </button>
        {filtered && (
          <Link
            href={filters.archived ? `${base}?archived=1` : base}
            className="font-heading text-subtle hover:text-primary py-2.5 text-xs font-semibold tracking-[0.15em] uppercase"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="text-muted mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>
          {list.length} exercise{list.length === 1 ? "" : "s"}
        </span>
        <span className="flex flex-wrap items-center gap-5">
          {perms.settings && <StarterToggle slug={ctx.tenantSlug} show={showStarters} />}
          <Link
            href={filters.archived ? base : `${base}?archived=1`}
            className="hover:text-primary underline underline-offset-4"
          >
            {filters.archived ? "Back to library" : "Archived"}
          </Link>
        </span>
      </div>

      {list.length === 0 ? (
        <p className="text-subtle border-border border p-8 text-center">
          {filters.q ? <>No exercises match “{filters.q}”.</> : "No exercises here yet."}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((e) => (
            <li
              key={e.id}
              className="border-border bg-surface hover:border-subtle relative border p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`${base}/${e.id}`}
                  className="font-heading text-base font-semibold tracking-[0.06em] uppercase after:absolute after:inset-0"
                >
                  {e.name}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  {e.tenantId === null && <Pill tone="muted">Starter</Pill>}
                  {e.hasVideo ? (
                    <Pill tone="primary">▶ Video</Pill>
                  ) : (
                    <span className="text-muted text-xs">No video</span>
                  )}
                </span>
              </div>
              {exerciseSummary(e) && (
                <p className="text-subtle mt-1 text-sm">{exerciseSummary(e)}</p>
              )}
              {e.cues && (
                <p className="mt-2 text-sm">
                  <span className="font-semibold">Coaching cues:</span> {e.cues}
                </p>
              )}
              {e.tags.length > 0 && (
                <div className="relative z-10 mt-3 flex flex-wrap gap-1.5">
                  {e.tags.map((t) => (
                    <Link
                      key={t}
                      href={tagHref(t)}
                      className={`border px-2 py-0.5 text-xs transition-colors ${
                        t === "sbd"
                          ? "border-primary text-primary"
                          : "border-border text-subtle hover:text-foreground"
                      }`}
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
