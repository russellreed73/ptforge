"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  DEFAULT_WEEKS,
  fitWeeks,
  programContentSchema,
  programDetailsSchema,
  readProgramContent,
  withNewIds,
  type ProgramContent,
  type ProgramDetails,
} from "@/lib/programs";
import { writeAudit } from "@/server/audit";
import { requireTenant } from "@/server/auth/session";
import { programs } from "@/server/db/schema";
import { withTenant, type TenantContext } from "@/server/db/tenant";
import { programPermissions } from "@/server/programs/queries";

export type ProgramActionResult =
  { ok: true; id?: string; message?: string } | { ok: false; error: string };
const fail = (error: string): ProgramActionResult => ({ ok: false, error });
const uuid = z.uuid();
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

function refresh(slug: string) {
  revalidatePath(`/${slug}`, "layout");
}

function dbError(err: unknown): ProgramActionResult {
  const code = (err as { cause?: { code?: string } })?.cause?.code;
  if (code === "23505") return fail("This client already has a current block. Finish it first.");
  console.error(err);
  return fail("Couldn't save. Please try again.");
}

async function audit(
  ctx: TenantContext,
  action: string,
  id: string,
  metadata?: Record<string, unknown>,
) {
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action,
    targetType: "program",
    targetId: id,
    metadata,
  });
}

const createSchema = z.object({
  /** null = a template */
  athleteProfileId: uuid.nullable(),
  /** Start from an existing template or block (copied), or blank. */
  sourceId: uuid.nullable(),
  name: z.string().trim().max(80).optional(),
});

/** New block for a client, or a new template. Copies the source's days if given. */
export async function createProgram(
  slug: string,
  raw: z.input<typeof createSchema>,
): Promise<ProgramActionResult> {
  const ctx = await requireTenant(slug);
  if (!programPermissions(ctx).edit) return fail("You can't build programs.");
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return fail("Invalid request.");
  const { athleteProfileId, sourceId, name } = parsed.data;
  try {
    const id = await withTenant(ctx, async (tx) => {
      const source = sourceId
        ? await tx.query.programs.findFirst({ where: eq(programs.id, sourceId) })
        : null;
      if (sourceId && !source) throw new Error("source not found");
      const content: ProgramContent = source
        ? withNewIds(readProgramContent(source.content), newId)
        : {
            days: [{ id: newId(), title: "Day 1", notes: "", warmups: [], exercises: [] }],
          };
      const [row] = await tx
        .insert(programs)
        .values({
          tenantId: ctx.tenantId,
          athleteProfileId,
          name: name || (source ? source.name : athleteProfileId ? "New block" : "New template"),
          goals: source?.goals ?? null,
          weeks: source?.weeks ?? DEFAULT_WEEKS,
          status: "draft",
          content,
          sourceProgramId: source?.id ?? null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .returning({ id: programs.id });
      return row.id;
    });
    await audit(ctx, athleteProfileId ? "program.created" : "template.created", id, { sourceId });
    refresh(slug);
    return { ok: true, id };
  } catch (err) {
    return dbError(err);
  }
}

/** Save the builder: block details and every day, warm-up, exercise and set. */
export async function saveProgram(
  slug: string,
  id: string,
  raw: { details: ProgramDetails; content: ProgramContent },
): Promise<ProgramActionResult> {
  const ctx = await requireTenant(slug);
  if (!programPermissions(ctx).edit) return fail("You can't edit programs.");
  if (!uuid.safeParse(id).success) return fail("Program not found.");
  const details = programDetailsSchema.safeParse(raw?.details);
  if (!details.success) return fail(details.error.issues[0].message);
  const content = programContentSchema.safeParse(raw?.content);
  if (!content.success) {
    const issue = content.error.issues[0];
    return fail(
      issue.message === "Invalid input" ? "Something in the program isn't valid." : issue.message,
    );
  }
  const d = details.data;
  try {
    const updated = await withTenant(ctx, (tx) =>
      tx
        .update(programs)
        .set({
          name: d.name,
          goals: d.goals || null,
          weeks: d.weeks,
          startDate: d.startDate,
          content: fitWeeks(content.data, d.weeks),
          updatedBy: ctx.userId,
        })
        .where(and(eq(programs.id, id), ne(programs.status, "archived")))
        .returning({ id: programs.id }),
    );
    if (!updated.length) return fail("This program can't be edited.");
  } catch (err) {
    return dbError(err);
  }
  await audit(ctx, "program.saved", id);
  refresh(slug);
  return { ok: true, id, message: "Saved." };
}

/**
 * Make this the client's current block: they see it in the app. Their
 * previous current block is marked finished.
 */
export async function assignProgram(slug: string, id: string): Promise<ProgramActionResult> {
  const ctx = await requireTenant(slug);
  if (!programPermissions(ctx).assign) return fail("You can't assign programs.");
  if (!uuid.safeParse(id).success) return fail("Program not found.");
  try {
    const result = await withTenant(ctx, async (tx) => {
      const p = await tx.query.programs.findFirst({ where: eq(programs.id, id) });
      if (!p?.athleteProfileId) return "not-found";
      if (readProgramContent(p.content).days.every((d) => d.exercises.length === 0)) return "empty";
      await tx
        .update(programs)
        .set({ status: "completed", updatedBy: ctx.userId })
        .where(
          and(
            eq(programs.athleteProfileId, p.athleteProfileId),
            eq(programs.status, "active"),
            ne(programs.id, id),
          ),
        );
      await tx
        .update(programs)
        .set({
          status: "active",
          startDate: p.startDate ?? new Date().toISOString().slice(0, 10),
          updatedBy: ctx.userId,
        })
        .where(eq(programs.id, id));
      return "ok";
    });
    if (result === "not-found") return fail("Only a client's block can be assigned.");
    if (result === "empty") return fail("Add at least one exercise before assigning.");
  } catch (err) {
    return dbError(err);
  }
  await audit(ctx, "program.assigned", id);
  refresh(slug);
  return { ok: true, message: "Assigned. The client sees it in the app now." };
}

/** Finish, archive or bring back a block or template. */
export async function setProgramStatus(
  slug: string,
  id: string,
  status: "draft" | "completed" | "archived",
): Promise<ProgramActionResult> {
  const ctx = await requireTenant(slug);
  if (!programPermissions(ctx).edit) return fail("You can't change programs.");
  if (!uuid.safeParse(id).success || !["draft", "completed", "archived"].includes(status))
    return fail("Invalid request.");
  const updated = await withTenant(ctx, (tx) =>
    tx
      .update(programs)
      .set({ status, updatedBy: ctx.userId })
      .where(eq(programs.id, id))
      .returning({ id: programs.id }),
  );
  if (!updated.length) return fail("Program not found.");
  await audit(ctx, `program.${status}`, id);
  refresh(slug);
  return {
    ok: true,
    message:
      status === "archived"
        ? "Archived."
        : status === "completed"
          ? "Marked finished."
          : "Moved back to drafts.",
  };
}

/** Copy a client's block (or a template) into a new template. */
export async function saveAsTemplate(
  slug: string,
  id: string,
  name: string,
): Promise<ProgramActionResult> {
  const ctx = await requireTenant(slug);
  if (!programPermissions(ctx).edit) return fail("You can't create templates.");
  const n = z.string().trim().min(1, "Name the template.").max(80).safeParse(name);
  if (!n.success) return fail(n.error.issues[0].message);
  return createProgram(slug, { athleteProfileId: null, sourceId: id, name: n.data });
}
