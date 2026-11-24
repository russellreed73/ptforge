import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { readProgramContent, type ProgramContent } from "@/lib/programs";
import { can } from "../auth/permissions";
import { athleteProfiles, exercises, programs, videoAssets } from "../db/schema";
import { withTenant, type TenantContext } from "../db/tenant";

export function programPermissions(ctx: TenantContext) {
  return {
    edit: can(ctx.roles, { program: ["update"] }),
    assign: can(ctx.roles, { program: ["assign"] }),
  };
}

const listColumns = {
  id: programs.id,
  name: programs.name,
  status: programs.status,
  weeks: programs.weeks,
  startDate: programs.startDate,
  content: programs.content,
  updatedAt: programs.updatedAt,
  athleteProfileId: programs.athleteProfileId,
};

/** A client's blocks, current first, then drafts, then finished (newest first). */
export async function listClientPrograms(ctx: TenantContext, athleteProfileId: string) {
  const rows = await withTenant(ctx, (tx) =>
    tx
      .select(listColumns)
      .from(programs)
      .where(and(eq(programs.athleteProfileId, athleteProfileId), ne(programs.status, "archived")))
      .orderBy(desc(programs.updatedAt)),
  );
  const rank = { active: 0, draft: 1, completed: 2 } as Record<string, number>;
  return rows
    .map((r) => ({ ...r, content: readProgramContent(r.content) }))
    .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
}

export async function listTemplates(ctx: TenantContext, { archived = false } = {}) {
  const rows = await withTenant(ctx, (tx) =>
    tx
      .select(listColumns)
      .from(programs)
      .where(
        and(
          isNull(programs.athleteProfileId),
          archived ? eq(programs.status, "archived") : ne(programs.status, "archived"),
        ),
      )
      .orderBy(asc(programs.name)),
  );
  return rows.map((r) => ({ ...r, content: readProgramContent(r.content) }));
}

/** One block or template with its client's name, or null if not visible. */
export async function getProgram(ctx: TenantContext, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return withTenant(ctx, async (tx) => {
    const p = await tx.query.programs.findFirst({ where: eq(programs.id, id) });
    if (!p) return null;
    const client = p.athleteProfileId
      ? ((await tx.query.athleteProfiles.findFirst({
          where: eq(athleteProfiles.id, p.athleteProfileId),
          columns: { id: true, firstName: true, lastName: true },
        })) ?? null)
      : null;
    return { program: { ...p, content: readProgramContent(p.content) }, client };
  });
}

/** The library as the builder's picker needs it. */
export async function exercisePickerList(ctx: TenantContext) {
  return withTenant(ctx, (tx) =>
    tx
      .select({
        id: exercises.id,
        name: exercises.name,
        muscles: exercises.primaryMuscles,
        family: exercises.category,
        tags: exercises.tags,
        competition: exercises.isCompetitionLift,
        hasVideo: exercises.demoVideoUrl,
        videoAssetId: exercises.videoAssetId,
        tenantId: exercises.tenantId,
        sourceExerciseId: exercises.sourceExerciseId,
      })
      .from(exercises)
      .where(isNull(exercises.archivedAt))
      .orderBy(asc(exercises.name)),
  ).then((rows) => {
    // Hide starters the business has customised (their copy takes over).
    const copied = new Set(
      rows.filter((r) => r.tenantId && r.sourceExerciseId).map((r) => r.sourceExerciseId),
    );
    return rows
      .filter((r) => !(r.tenantId === null && copied.has(r.id)))
      .map((r) => ({
        id: r.id,
        name: r.name,
        muscles: r.muscles ?? [],
        family: r.family,
        tags: r.tags,
        competition: r.competition,
        hasVideo: Boolean(r.hasVideo || r.videoAssetId),
      }));
  });
}
export type PickerExercise = Awaited<ReturnType<typeof exercisePickerList>>[number];

/**
 * Library details for the exercises used in a block: whether each is a
 * competition lift, and its demo video. Works for athletes too (they can read
 * their business's exercises and videos, but not the Exercises pages).
 */
export async function exerciseDetailsFor(ctx: TenantContext, content: ProgramContent) {
  const ids = [
    ...new Set(
      content.days.flatMap((d) => [
        ...d.warmups.map((w) => w.exerciseId),
        ...d.exercises.map((e) => e.exerciseId),
      ]),
    ),
  ].filter((x): x is string => Boolean(x));
  if (!ids.length) return new Map<string, ExerciseDetail>();
  const rows = await withTenant(ctx, async (tx) => {
    const ex = await tx
      .select({
        id: exercises.id,
        competition: exercises.isCompetitionLift,
        cues: exercises.cues,
        demoVideoUrl: exercises.demoVideoUrl,
        videoAssetId: exercises.videoAssetId,
      })
      .from(exercises)
      .where(inArray(exercises.id, ids));
    const assetIds = ex.map((e) => e.videoAssetId).filter((x): x is string => Boolean(x));
    const assets = assetIds.length
      ? await tx
          .select({
            id: videoAssets.id,
            providerRef: videoAssets.providerRef,
            status: videoAssets.status,
          })
          .from(videoAssets)
          .where(inArray(videoAssets.id, assetIds))
      : [];
    return ex.map((e) => ({ ...e, asset: assets.find((a) => a.id === e.videoAssetId) ?? null }));
  });
  return new Map(rows.map((r) => [r.id, r]));
}
export type ExerciseDetail = {
  id: string;
  competition: boolean;
  cues: string | null;
  demoVideoUrl: string | null;
  videoAssetId: string | null;
  asset: { id: string; providerRef: string; status: string } | null;
};

/** The signed-in athlete's current block, if their coach has assigned one. */
export async function getMyCurrentProgram(ctx: TenantContext) {
  return withTenant(ctx, async (tx) => {
    const me = await tx.query.athleteProfiles.findFirst({
      where: eq(athleteProfiles.userId, ctx.userId),
      columns: { id: true, firstName: true, serviceType: true },
    });
    if (!me) return { me: null, program: null };
    const p = await tx.query.programs.findFirst({
      where: and(eq(programs.athleteProfileId, me.id), eq(programs.status, "active")),
    });
    return { me, program: p ? { ...p, content: readProgramContent(p.content) } : null };
  });
}
