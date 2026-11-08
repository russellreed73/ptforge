"use server";

import { APIError } from "better-auth/api";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import {
  applicationSchema,
  CLIENT_STATUSES,
  intakeSchema,
  normalizeInstagram,
  type Application,
  type ApplicationInput,
  type IntakeInput,
} from "@/lib/clients";
import { writeAudit } from "@/server/audit";
import { auth } from "@/server/auth";
import { requireTenant } from "@/server/auth/session";
import { clientPermissions, listCoaches } from "@/server/clients/queries";
import { athleteIntakes, athleteProfiles, athleteTrainers } from "@/server/db/schema";
import { withTenant, type TenantContext } from "@/server/db/tenant";

export type ClientActionResult =
  { ok: true; message?: string; id?: string } | { ok: false; error: string };
const fail = (error: string): ClientActionResult => ({ ok: false, error });

function dbError(err: unknown): ClientActionResult {
  const code = (err as { cause?: { code?: string } })?.cause?.code;
  if (code === "23505") return fail("Another client in this business already uses that email.");
  if (err instanceof APIError) return fail(err.body?.message ?? err.message);
  console.error(err);
  return fail("Something went wrong. Please try again.");
}

const idSchema = z.uuid();

/** Turns the coach-preference answer into the stored columns. */
async function coachColumns(tenantId: string, a: Application) {
  const pref = a.coachPreference;
  if (!pref) return { coachPreference: null, preferredTrainerUserId: null };
  if (pref === "unsure" || pref === "none")
    return { coachPreference: pref, preferredTrainerUserId: null };
  const coaches = await listCoaches(tenantId);
  return coaches.some((c) => c.userId === pref)
    ? { coachPreference: "trainer", preferredTrainerUserId: pref }
    : { coachPreference: null, preferredTrainerUserId: null };
}

async function applicationColumns(ctx: TenantContext, a: Application) {
  return {
    firstName: a.firstName,
    lastName: a.lastName,
    email: a.email,
    pronouns: a.pronouns,
    sex: a.sex,
    country: a.country,
    region: a.region,
    city: a.city,
    instagram: a.instagram ? (normalizeInstagram(a.instagram) ?? a.instagram) : null,
    serviceType: a.serviceType,
    coachQualities: a.coachQualities,
    goals: a.goals,
    heardAbout: a.heardAbout,
    funFact: a.funFact,
    ...(await coachColumns(ctx.tenantId, a)),
  };
}

const createSchema = z.object({
  application: applicationSchema,
  status: z.enum(CLIENT_STATUSES).default("active"),
  /** Admins and managers can pick a trainer straight away. */
  trainerUserId: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** A coach adds a client by hand. Trainers become that client's trainer automatically. */
export async function createClient(
  slug: string,
  raw: { application: ApplicationInput; status?: string; trainerUserId?: string },
): Promise<ClientActionResult> {
  const ctx = await requireTenant(slug);
  const perms = clientPermissions(ctx);
  if (!perms.create) return fail("You can't add clients.");
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { application, status, trainerUserId } = parsed.data;

  const id = crypto.randomUUID();
  try {
    const values = await applicationColumns(ctx, application);
    await withTenant(ctx, async (tx) => {
      // No RETURNING: a trainer can't see the row until they're assigned to it.
      await tx.insert(athleteProfiles).values({
        id,
        tenantId: ctx.tenantId,
        ...values,
        status,
        source: "manual",
        createdBy: ctx.userId,
      });
      if (perms.assign) {
        if (trainerUserId) {
          const coaches = await listCoaches(ctx.tenantId);
          if (!coaches.some((c) => c.userId === trainerUserId)) throw new Error("not a trainer");
          await tx.insert(athleteTrainers).values({
            tenantId: ctx.tenantId,
            athleteProfileId: id,
            trainerUserId,
            assignedBy: ctx.userId,
          });
        }
      } else {
        await tx.execute(sql`select app_claim_new_athlete(${id})`);
      }
    });
  } catch (err) {
    return dbError(err);
  }
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "client.created",
    targetType: "athlete_profile",
    targetId: id,
  });
  revalidatePath(`/${slug}/clients`);
  return { ok: true, id };
}

/** Edit the Step 1 answers. */
export async function updateApplication(
  slug: string,
  clientId: string,
  raw: ApplicationInput,
): Promise<ClientActionResult> {
  const ctx = await requireTenant(slug);
  if (!clientPermissions(ctx).create) return fail("You can't edit clients.");
  if (!idSchema.safeParse(clientId).success) return fail("Client not found.");
  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  try {
    const values = await applicationColumns(ctx, parsed.data);
    const updated = await withTenant(ctx, (tx) =>
      tx
        .update(athleteProfiles)
        .set(values)
        .where(eq(athleteProfiles.id, clientId))
        .returning({ id: athleteProfiles.id }),
    );
    if (!updated.length) return fail("Client not found.");
  } catch (err) {
    return dbError(err);
  }
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "client.application_updated",
    targetType: "athlete_profile",
    targetId: clientId,
  });
  revalidatePath(`/${slug}/clients`, "layout");
  return { ok: true, message: "Saved." };
}

/** Save the Step 2 detailed intake. The form sends loads already converted to kg. */
export async function saveIntake(
  slug: string,
  clientId: string,
  raw: IntakeInput,
): Promise<ClientActionResult> {
  const ctx = await requireTenant(slug);
  if (!clientPermissions(ctx).create) return fail("Only coaches can edit the intake.");
  if (!idSchema.safeParse(clientId).success) return fail("Client not found.");
  const parsed = intakeSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { phone, dateOfBirth, ...intake } = parsed.data;
  try {
    const ok = await withTenant(ctx, async (tx) => {
      const [profile] = await tx
        .update(athleteProfiles)
        .set({ phone, dateOfBirth })
        .where(eq(athleteProfiles.id, clientId))
        .returning({ id: athleteProfiles.id });
      if (!profile) return false;
      const row = { ...intake, updatedBy: ctx.userId };
      await tx
        .insert(athleteIntakes)
        .values({ athleteProfileId: clientId, tenantId: ctx.tenantId, ...row })
        .onConflictDoUpdate({ target: athleteIntakes.athleteProfileId, set: row });
      return true;
    });
    if (!ok) return fail("Client not found.");
  } catch (err) {
    return dbError(err);
  }
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "client.intake_updated",
    targetType: "athlete_profile",
    targetId: clientId,
  });
  revalidatePath(`/${slug}/clients/${clientId}`);
  return { ok: true, message: "Intake saved." };
}

export async function setClientStatus(
  slug: string,
  clientId: string,
  status: string,
): Promise<ClientActionResult> {
  const ctx = await requireTenant(slug);
  if (!clientPermissions(ctx).create) return fail("You can't change clients.");
  const s = z.enum(CLIENT_STATUSES).safeParse(status);
  if (!s.success || !idSchema.safeParse(clientId).success) return fail("Invalid request.");
  const updated = await withTenant(ctx, (tx) =>
    tx
      .update(athleteProfiles)
      .set({ status: s.data })
      .where(eq(athleteProfiles.id, clientId))
      .returning({ id: athleteProfiles.id }),
  );
  if (!updated.length) return fail("Client not found.");
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "client.status_changed",
    targetType: "athlete_profile",
    targetId: clientId,
    metadata: { status: s.data },
  });
  revalidatePath(`/${slug}/clients`, "layout");
  return { ok: true };
}

/** Archive (or bring back) a client. Archived clients are hidden from lists. */
export async function setClientArchived(
  slug: string,
  clientId: string,
  archived: boolean,
): Promise<ClientActionResult> {
  const ctx = await requireTenant(slug);
  if (!clientPermissions(ctx).archive) return fail("Only administrators can archive clients.");
  if (!idSchema.safeParse(clientId).success) return fail("Client not found.");
  const updated = await withTenant(ctx, (tx) =>
    tx
      .update(athleteProfiles)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(athleteProfiles.id, clientId))
      .returning({ id: athleteProfiles.id }),
  );
  if (!updated.length) return fail("Client not found.");
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: archived ? "client.archived" : "client.unarchived",
    targetType: "athlete_profile",
    targetId: clientId,
  });
  revalidatePath(`/${slug}/clients`, "layout");
  return { ok: true, message: archived ? "Client archived." : "Client restored." };
}

export async function assignTrainer(
  slug: string,
  clientId: string,
  trainerUserId: string,
): Promise<ClientActionResult> {
  const ctx = await requireTenant(slug);
  if (!clientPermissions(ctx).assign)
    return fail("Only administrators and managers assign trainers.");
  if (!idSchema.safeParse(clientId).success || !idSchema.safeParse(trainerUserId).success)
    return fail("Choose a trainer.");
  const coaches = await listCoaches(ctx.tenantId);
  const coach = coaches.find((c) => c.userId === trainerUserId);
  if (!coach) return fail("That person isn't a trainer in this business.");
  try {
    await withTenant(ctx, async (tx) => {
      const visible = await tx.query.athleteProfiles.findFirst({
        where: eq(athleteProfiles.id, clientId),
        columns: { id: true },
      });
      if (!visible) throw new Error("not found");
      await tx
        .insert(athleteTrainers)
        .values({
          tenantId: ctx.tenantId,
          athleteProfileId: clientId,
          trainerUserId,
          assignedBy: ctx.userId,
        })
        .onConflictDoNothing();
    });
  } catch (err) {
    return dbError(err);
  }
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "client.trainer_assigned",
    targetType: "athlete_profile",
    targetId: clientId,
    metadata: { trainerUserId, trainerName: coach.name },
  });
  revalidatePath(`/${slug}/clients`, "layout");
  return { ok: true, message: `${coach.name} assigned.` };
}

export async function unassignTrainer(
  slug: string,
  clientId: string,
  trainerUserId: string,
): Promise<ClientActionResult> {
  const ctx = await requireTenant(slug);
  if (!clientPermissions(ctx).assign)
    return fail("Only administrators and managers assign trainers.");
  if (!idSchema.safeParse(clientId).success || !idSchema.safeParse(trainerUserId).success)
    return fail("Invalid request.");
  await withTenant(ctx, (tx) =>
    tx
      .delete(athleteTrainers)
      .where(
        and(
          eq(athleteTrainers.athleteProfileId, clientId),
          eq(athleteTrainers.trainerUserId, trainerUserId),
        ),
      ),
  );
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "client.trainer_unassigned",
    targetType: "athlete_profile",
    targetId: clientId,
    metadata: { trainerUserId },
  });
  revalidatePath(`/${slug}/clients`, "layout");
  return { ok: true };
}

/**
 * Invite the client to the app. When they accept, their login is linked to
 * this profile by email (src/server/team/on-accept.ts) and they become active.
 */
export async function inviteClientToApp(
  slug: string,
  clientId: string,
): Promise<ClientActionResult> {
  const ctx = await requireTenant(slug);
  if (!clientPermissions(ctx).invite) return fail("You can't send invitations.");
  if (!idSchema.safeParse(clientId).success) return fail("Client not found.");
  const profile = await withTenant(ctx, (tx) =>
    tx.query.athleteProfiles.findFirst({
      where: eq(athleteProfiles.id, clientId),
      columns: { email: true, userId: true, archivedAt: true },
    }),
  );
  if (!profile) return fail("Client not found.");
  if (profile.userId) return fail("This client already uses the app.");
  if (!profile.email) return fail("Add the client's email address first.");
  if (profile.archivedAt) return fail("Restore this client before inviting them.");
  try {
    const created = await auth.api.createInvitation({
      body: { email: profile.email, role: "athlete", organizationId: ctx.tenantId, resend: true },
      headers: await headers(),
    });
    await writeAudit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: "invitation.created",
      targetType: "invitation",
      targetId: created?.id,
      metadata: { email: profile.email, roles: ["athlete"], clientId },
    });
  } catch (err) {
    return dbError(err);
  }
  revalidatePath(`/${slug}/clients/${clientId}`);
  return { ok: true, message: `Invitation sent to ${profile.email}.` };
}
