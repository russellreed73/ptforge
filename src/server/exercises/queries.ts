import "server-only";
import { and, asc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { can } from "../auth/permissions";
import { exercises, videoAssets } from "../db/schema";
import { withTenant, type TenantContext } from "../db/tenant";

export type ExerciseFilters = {
  q?: string;
  family?: string;
  equipment?: string;
  /** all | own | starter */
  source?: "all" | "own" | "starter";
  /** any | with | without */
  video?: "any" | "with" | "without";
  archived?: boolean;
};

export function readExerciseFilters(
  sp: Record<string, string | string[] | undefined>,
): ExerciseFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const source = one("source");
  const video = one("video");
  return {
    q: one("q") || undefined,
    family: one("family") || undefined,
    equipment: one("equipment") || undefined,
    source: source === "own" || source === "starter" ? source : "all",
    video: video === "with" || video === "without" ? video : "any",
    archived: one("archived") === "1",
  };
}

/**
 * The library a business sees: its own exercises plus PTForge's starter
 * exercises (unless switched off), hiding any starter it has customised.
 * Row-Level Security limits rows to this business and the shared library.
 */
export async function listExercises(
  ctx: TenantContext,
  f: ExerciseFilters,
  opts: { showStarters: boolean },
) {
  return withTenant(ctx, (tx) => {
    const where: SQL[] = [];
    where.push(f.archived ? isNotNull(exercises.archivedAt) : isNull(exercises.archivedAt));
    const own = eq(exercises.tenantId, ctx.tenantId);
    const starter = and(
      isNull(exercises.tenantId),
      sql`not exists (select 1 from ${exercises} c where c.tenant_id = ${ctx.tenantId} and c.source_exercise_id = ${exercises.id} and c.archived_at is null)`,
    )!;
    if (f.source === "own" || (!opts.showStarters && f.source !== "starter")) where.push(own);
    else if (f.source === "starter") where.push(starter);
    else where.push(or(own, starter)!);
    if (f.family) where.push(eq(exercises.category, f.family));
    if (f.equipment) where.push(eq(exercises.equipment, f.equipment));
    if (f.video === "with")
      where.push(or(isNotNull(exercises.demoVideoUrl), isNotNull(exercises.videoAssetId))!);
    if (f.video === "without")
      where.push(and(isNull(exercises.demoVideoUrl), isNull(exercises.videoAssetId))!);
    if (f.q) {
      const like = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      where.push(
        or(
          ilike(exercises.name, like),
          ilike(exercises.category, like),
          ilike(exercises.equipment, like),
          ilike(exercises.movement, like),
          ilike(sql`array_to_string(${exercises.primaryMuscles}, ' ')`, like),
          ilike(sql`array_to_string(${exercises.tags}, ' ')`, like),
        )!,
      );
    }
    return tx
      .select({
        id: exercises.id,
        tenantId: exercises.tenantId,
        name: exercises.name,
        category: exercises.category,
        equipment: exercises.equipment,
        primaryMuscles: exercises.primaryMuscles,
        movement: exercises.movement,
        tags: exercises.tags,
        cues: exercises.cues,
        isCompetitionLift: exercises.isCompetitionLift,
        hasVideo: sql<boolean>`(${exercises.demoVideoUrl} is not null or ${exercises.videoAssetId} is not null)`,
        archivedAt: exercises.archivedAt,
      })
      .from(exercises)
      .where(and(...where))
      .orderBy(
        sql`${exercises.isCompetitionLift} desc`,
        asc(exercises.category),
        asc(exercises.name),
      )
      .limit(1000);
  });
}

/** Families and equipment used across the visible library, for the filters. */
export async function exerciseFacets(ctx: TenantContext) {
  const rows = await withTenant(ctx, (tx) =>
    tx
      .selectDistinct({ family: exercises.category, equipment: exercises.equipment })
      .from(exercises)
      .where(isNull(exercises.archivedAt)),
  );
  const uniq = (xs: (string | null)[]) =>
    [...new Set(xs.filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b));
  return {
    families: uniq(rows.map((r) => r.family)),
    equipment: uniq(rows.map((r) => r.equipment)),
  };
}

/** One exercise with its uploaded video (if any), or null if not visible. */
export async function getExercise(ctx: TenantContext, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return withTenant(ctx, async (tx) => {
    const ex = await tx.query.exercises.findFirst({ where: eq(exercises.id, id) });
    if (!ex) return null;
    const video = ex.videoAssetId
      ? ((await tx.query.videoAssets.findFirst({ where: eq(videoAssets.id, ex.videoAssetId) })) ??
        null)
      : null;
    // A starter this business has already customised: point to their copy.
    const copy =
      ex.tenantId === null
        ? ((await tx.query.exercises.findFirst({
            where: and(
              eq(exercises.tenantId, ctx.tenantId),
              eq(exercises.sourceExerciseId, ex.id),
              isNull(exercises.archivedAt),
            ),
            columns: { id: true },
          })) ?? null)
        : null;
    return { exercise: ex, video, copyId: copy?.id ?? null };
  });
}

export function exercisePermissions(ctx: TenantContext) {
  return {
    edit: can(ctx.roles, { exercise: ["update"] }),
    create: can(ctx.roles, { exercise: ["create"] }),
    archive: can(ctx.roles, { exercise: ["delete"] }),
    settings: can(ctx.roles, { settings: ["update"] }),
  };
}
