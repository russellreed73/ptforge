"use server";

import { and, eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { validateRoleSet } from "@/lib/roles";
import { writeAudit } from "@/server/audit";
import { auth } from "@/server/auth";
import { can, invitableRoles, parseRoles, type RoleName } from "@/server/auth/permissions";
import { requireTenant } from "@/server/auth/session";
import { db } from "@/server/db";
import { invitation, member } from "@/server/db/schema";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

function errorMessage(err: unknown): string {
  if (err instanceof APIError) return err.body?.message ?? err.message;
  console.error(err);
  return "Something went wrong. Please try again.";
}

const rolesSchema = z.array(z.enum(["admin", "manager", "trainer", "athlete"])).min(1);

/** Invite someone by email with one or more roles. */
export async function inviteAction(slug: string, input: { email: string; roles: string[] }) {
  const ctx = await requireTenant(slug);
  const email = z.email().safeParse(input.email.trim().toLowerCase());
  const roles = rolesSchema.safeParse(input.roles);
  if (!email.success) return fail("Enter a valid email address.");
  if (!roles.success) return fail("Choose at least one role.");
  const problem = validateRoleSet(roles.data);
  if (problem) return fail(problem);

  const allowed = invitableRoles(ctx.roles);
  if (!can(ctx.roles, { invitation: ["create"] }) || roles.data.some((r) => !allowed.includes(r))) {
    return fail(`You can invite: ${allowed.join(", ") || "nobody"}.`);
  }

  // Better Auth refuses people who are already members or already invited.
  try {
    const created = await auth.api.createInvitation({
      body: { email: email.data, role: roles.data as RoleName[], organizationId: ctx.tenantId },
      headers: await headers(),
    });
    await writeAudit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: "invitation.created",
      targetType: "invitation",
      targetId: created?.id,
      metadata: { email: email.data, roles: roles.data },
    });
  } catch (err) {
    return fail(errorMessage(err));
  }
  revalidatePath(`/${slug}/team`);
  return { ok: true, message: `Invitation sent to ${email.data}.` } satisfies ActionResult;
}

async function loadPendingInvitation(tenantId: string, invitationId: string) {
  return db.query.invitation.findFirst({
    where: and(
      eq(invitation.id, invitationId),
      eq(invitation.organizationId, tenantId),
      eq(invitation.status, "pending"),
    ),
  });
}

/** Send the same invitation email again (also extends its expiry). */
export async function resendInvitationAction(slug: string, invitationId: string) {
  const ctx = await requireTenant(slug);
  const inv = await loadPendingInvitation(ctx.tenantId, invitationId);
  if (!inv) return fail("That invitation is no longer pending.");
  const seesAll = can(ctx.roles, { invitation: ["cancel"] });
  if (!seesAll && inv.inviterId !== ctx.userId)
    return fail("You can only resend your own invitations.");
  try {
    await auth.api.createInvitation({
      body: {
        email: inv.email,
        role: parseRoles(inv.role),
        organizationId: ctx.tenantId,
        resend: true,
      },
      headers: await headers(),
    });
    await writeAudit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: "invitation.resent",
      targetType: "invitation",
      targetId: inv.id,
      metadata: { email: inv.email },
    });
  } catch (err) {
    return fail(errorMessage(err));
  }
  revalidatePath(`/${slug}/team`);
  return { ok: true, message: `Invitation re-sent to ${inv.email}.` } satisfies ActionResult;
}

/** Cancel a pending invitation (administrators and managers). */
export async function cancelInvitationAction(slug: string, invitationId: string) {
  const ctx = await requireTenant(slug);
  if (!can(ctx.roles, { invitation: ["cancel"] })) return fail("You can't cancel invitations.");
  const inv = await loadPendingInvitation(ctx.tenantId, invitationId);
  if (!inv) return fail("That invitation is no longer pending.");
  try {
    await auth.api.cancelInvitation({ body: { invitationId }, headers: await headers() });
    await writeAudit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: "invitation.cancelled",
      targetType: "invitation",
      targetId: inv.id,
      metadata: { email: inv.email },
    });
  } catch (err) {
    return fail(errorMessage(err));
  }
  revalidatePath(`/${slug}/team`);
  return { ok: true } satisfies ActionResult;
}

async function loadMember(tenantId: string, memberId: string) {
  return db.query.member.findFirst({
    where: and(eq(member.id, memberId), eq(member.organizationId, tenantId)),
  });
}

/** Change someone's roles (administrators only). */
export async function updateRolesAction(slug: string, memberId: string, roles: string[]) {
  const ctx = await requireTenant(slug);
  if (!can(ctx.roles, { member: ["update"] })) return fail("Only administrators can change roles.");
  const parsed = rolesSchema.safeParse(roles);
  if (!parsed.success) return fail("Choose at least one role.");
  const problem = validateRoleSet(parsed.data);
  if (problem) return fail(problem);
  const target = await loadMember(ctx.tenantId, memberId);
  if (!target) return fail("That person is no longer a member.");
  try {
    await auth.api.updateMemberRole({
      body: { memberId, role: parsed.data as RoleName[], organizationId: ctx.tenantId },
      headers: await headers(),
    });
    await writeAudit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: "member.roles_changed",
      targetType: "member",
      targetId: memberId,
      metadata: { userId: target.userId, from: parseRoles(target.role), to: parsed.data },
    });
  } catch (err) {
    return fail(errorMessage(err));
  }
  revalidatePath(`/${slug}/team`);
  return { ok: true } satisfies ActionResult;
}

/** Remove someone from the business (administrators only). Their login stays. */
export async function removeMemberAction(slug: string, memberId: string) {
  const ctx = await requireTenant(slug);
  if (!can(ctx.roles, { member: ["delete"] }))
    return fail("Only administrators can remove people.");
  const target = await loadMember(ctx.tenantId, memberId);
  if (!target) return fail("That person is no longer a member.");
  if (target.userId === ctx.userId) return fail("You can't remove yourself.");
  try {
    await auth.api.removeMember({
      body: { memberIdOrEmail: memberId, organizationId: ctx.tenantId },
      headers: await headers(),
    });
    await writeAudit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: "member.removed",
      targetType: "member",
      targetId: memberId,
      metadata: { userId: target.userId, roles: parseRoles(target.role) },
    });
  } catch (err) {
    return fail(errorMessage(err));
  }
  revalidatePath(`/${slug}/team`);
  return { ok: true } satisfies ActionResult;
}
