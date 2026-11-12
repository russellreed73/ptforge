"use server";

import { APIError } from "better-auth/api";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { exerciseSchema, type ExerciseInput } from "@/lib/exercises";
import { writeAudit } from "@/server/audit";
import { auth } from "@/server/auth";
import { requireTenant } from "@/server/auth/session";
import { db } from "@/server/db";
import { exercises, organization, videoAssets } from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { exercisePermissions } from "@/server/exercises/queries";
import {
  createDirectUpload,
  getStreamVideo,
  MAX_UPLOAD_BYTES,
  streamConfig,
} from "@/server/video/stream";

export type ExerciseActionResult =
  { ok: true; id?: string; message?: string } | { ok: false; error: string };
const fail = (error: string): ExerciseActionResult => ({ ok: false, error });
const idSchema = z.uuid();

function refresh(slug: string) {
  revalidatePath(`/${slug}/exercises`, "layout");
}

export async function createExercise(
  slug: string,
  raw: ExerciseInput,
): Promise<ExerciseActionResult> {
  const ctx = await requireTenant(slug);
  if (!exercisePermissions(ctx).create) return fail("You can't add exercises.");
  const parsed = exerciseSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  try {
    const [row] = await withTenant(ctx, (tx) =>
      tx
        .insert(exercises)
        .values({ ...parsed.data, tenantId: ctx.tenantId, createdBy: ctx.userId })
        .returning({ id: exercises.id }),
    );
    await writeAudit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: "exercise.created",
      targetType: "exercise",
      targetId: row.id,
      metadata: { name: parsed.data.name },
    });
    refresh(slug);
    return { ok: true, id: row.id };
  } catch (err) {
    console.error(err);
    return fail("Couldn't save the exercise. Please try again.");
  }
}

export async function updateExercise(
  slug: string,
  id: string,
  raw: ExerciseInput,
): Promise<ExerciseActionResult> {
  const ctx = await requireTenant(slug);
  if (!exercisePermissions(ctx).edit) return fail("You can't edit exercises.");
  if (!idSchema.safeParse(id).success) return fail("Exercise not found.");
  const parsed = exerciseSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  try {
    // Row-Level Security only lets a business change its own exercises.
    const updated = await withTenant(ctx, (tx) =>
      tx
        .update(exercises)
        .set(parsed.data)
        .where(and(eq(exercises.id, id), eq(exercises.tenantId, ctx.tenantId)))
        .returning({ id: exercises.id }),
    );
    if (!updated.length)
      return fail("You can only edit your own exercises. Copy a starter one first.");
  } catch (err) {
    console.error(err);
    return fail("Couldn't save the exercise. Please try again.");
  }
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "exercise.updated",
    targetType: "exercise",
    targetId: id,
  });
  refresh(slug);
  return { ok: true, id, message: "Saved." };
}

/** Make the business's own editable copy of a PTForge starter exercise; the original is then hidden. */
export async function copyStarterExercise(slug: string, id: string): Promise<ExerciseActionResult> {
  const ctx = await requireTenant(slug);
  if (!exercisePermissions(ctx).create) return fail("You can't add exercises.");
  if (!idSchema.safeParse(id).success) return fail("Exercise not found.");
  const result = await withTenant(ctx, async (tx) => {
    const src = await tx.query.exercises.findFirst({
      where: and(eq(exercises.id, id), isNull(exercises.tenantId)),
    });
    if (!src) return null;
    const existing = await tx.query.exercises.findFirst({
      where: and(
        eq(exercises.tenantId, ctx.tenantId),
        eq(exercises.sourceExerciseId, id),
        isNull(exercises.archivedAt),
      ),
      columns: { id: true },
    });
    if (existing) return existing.id;
    const [row] = await tx
      .insert(exercises)
      .values({
        tenantId: ctx.tenantId,
        name: src.name,
        category: src.category,
        equipment: src.equipment,
        primaryMuscles: src.primaryMuscles,
        movement: src.movement,
        tags: src.tags,
        cues: src.cues,
        isCompetitionLift: src.isCompetitionLift,
        demoVideoUrl: src.demoVideoUrl,
        sourceExerciseId: src.id,
        createdBy: ctx.userId,
      })
      .returning({ id: exercises.id });
    return row.id;
  });
  if (!result) return fail("Only PTForge starter exercises can be copied.");
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "exercise.copied",
    targetType: "exercise",
    targetId: result,
    metadata: { sourceExerciseId: id },
  });
  refresh(slug);
  return { ok: true, id: result };
}

export async function setExerciseArchived(
  slug: string,
  id: string,
  archived: boolean,
): Promise<ExerciseActionResult> {
  const ctx = await requireTenant(slug);
  if (!exercisePermissions(ctx).archive) return fail("You can't archive exercises.");
  if (!idSchema.safeParse(id).success) return fail("Exercise not found.");
  const updated = await withTenant(ctx, (tx) =>
    tx
      .update(exercises)
      .set({ archivedAt: archived ? new Date() : null })
      .where(and(eq(exercises.id, id), eq(exercises.tenantId, ctx.tenantId)))
      .returning({ id: exercises.id }),
  );
  if (!updated.length) return fail("Exercise not found.");
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: archived ? "exercise.archived" : "exercise.unarchived",
    targetType: "exercise",
    targetId: id,
  });
  refresh(slug);
  return { ok: true, message: archived ? "Archived." : "Restored." };
}

/** Administrators: show or hide PTForge's starter exercises for the whole business. */
export async function setShowStarterExercises(
  slug: string,
  show: boolean,
): Promise<ExerciseActionResult> {
  const ctx = await requireTenant(slug);
  if (!exercisePermissions(ctx).settings) return fail("Only administrators can change this.");
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, ctx.tenantId),
    columns: { metadata: true },
  });
  let existing: Record<string, unknown> = {};
  try {
    existing = org?.metadata ? JSON.parse(org.metadata) : {};
  } catch {}
  try {
    await auth.api.updateOrganization({
      headers: await headers(),
      body: {
        organizationId: ctx.tenantId,
        data: { metadata: { ...existing, showStarterExercises: Boolean(show) } },
      },
    });
  } catch (err) {
    return fail(err instanceof APIError ? (err.body?.message ?? err.message) : "Couldn't save.");
  }
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "settings.starter_exercises",
    targetType: "organization",
    targetId: ctx.tenantId,
    metadata: { show: Boolean(show) },
  });
  refresh(slug);
  return { ok: true };
}

/**
 * Step 1 of an upload: record the video and get a one-time Cloudflare Stream
 * URL. The browser then sends the file straight to Stream.
 */
export async function startVideoUpload(
  slug: string,
  file: { name: string; size: number; type: string },
): Promise<{ ok: true; videoAssetId: string; uploadURL: string } | { ok: false; error: string }> {
  const ctx = await requireTenant(slug);
  if (!exercisePermissions(ctx).edit) return { ok: false, error: "You can't upload videos." };
  const cfg = streamConfig();
  if (!cfg) return { ok: false, error: "Video uploads aren't set up yet. Paste a link instead." };
  if (!String(file?.type).startsWith("video/"))
    return { ok: false, error: "Choose a video file (MP4 or MOV)." };
  if (!(Number(file.size) > 0) || Number(file.size) > MAX_UPLOAD_BYTES)
    return { ok: false, error: "Videos must be smaller than 200 MB." };
  const name = String(file.name ?? "video").slice(0, 200);
  try {
    const upload = await createDirectUpload(cfg, { tenantId: ctx.tenantId, name });
    const [row] = await withTenant(ctx, (tx) =>
      tx
        .insert(videoAssets)
        .values({
          tenantId: ctx.tenantId,
          providerRef: upload.uid,
          fileName: name,
          status: "uploading",
          createdBy: ctx.userId,
        })
        .returning({ id: videoAssets.id }),
    );
    return { ok: true, videoAssetId: row.id, uploadURL: upload.uploadURL };
  } catch (err) {
    console.error("[stream] direct upload failed", err);
    return { ok: false, error: "Couldn't start the upload. Please try again." };
  }
}

/** Asks Stream whether an uploaded video is ready to play, and records the answer. */
export async function refreshVideoStatus(
  slug: string,
  videoAssetId: string,
): Promise<{ status: string; error?: string }> {
  const ctx = await requireTenant(slug);
  if (!idSchema.safeParse(videoAssetId).success) return { status: "error" };
  const cfg = streamConfig();
  const video = await withTenant(ctx, (tx) =>
    tx.query.videoAssets.findFirst({ where: eq(videoAssets.id, videoAssetId) }),
  );
  if (!video) return { status: "error", error: "Video not found." };
  if (!cfg || video.status === "ready" || video.status === "error") return { status: video.status };
  try {
    const s = await getStreamVideo(cfg, video.providerRef);
    const status = s.ready
      ? "ready"
      : s.state === "error"
        ? "error"
        : s.state === "pendingupload"
          ? "uploading"
          : "processing";
    if (status !== video.status || s.durationSeconds !== video.durationSeconds) {
      if (exercisePermissions(ctx).edit) {
        await withTenant(ctx, (tx) =>
          tx
            .update(videoAssets)
            .set({ status, durationSeconds: s.durationSeconds })
            .where(eq(videoAssets.id, videoAssetId)),
        );
      }
    }
    return { status, error: s.errorReason ?? undefined };
  } catch (err) {
    console.error("[stream] status check failed", err);
    return { status: video.status };
  }
}
