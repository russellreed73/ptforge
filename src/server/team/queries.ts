import "server-only";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { can, parseRoles } from "../auth/permissions";
import { db } from "../db";
import { invitation, member, organization, user } from "../db/schema";
import { withTenant, type TenantContext } from "../db/tenant";

export type TeamMember = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  roles: ReturnType<typeof parseRoles>;
  joinedAt: Date;
};

export type PendingInvitation = {
  id: string;
  email: string;
  roles: ReturnType<typeof parseRoles>;
  expiresAt: Date;
  inviterName: string | null;
  sentByMe: boolean;
};

/**
 * Members of the current business. Read through withTenant (Row-Level
 * Security). Athlete members are listed only for administrators and managers;
 * trainers see their athletes in Clients (phase 1 step 5).
 */
export async function listMembers(ctx: TenantContext): Promise<TeamMember[]> {
  const rows = await withTenant(ctx, (tx) =>
    tx
      .select({
        memberId: member.id,
        userId: member.userId,
        role: member.role,
        joinedAt: member.createdAt,
        name: user.name,
        email: user.email,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .orderBy(asc(user.name)),
  );
  const seesAthletes = can(ctx.roles, { athlete: ["view_all"] });
  return rows
    .map((r) => ({ ...r, roles: parseRoles(r.role) }))
    .filter((m) => seesAthletes || !(m.roles.length === 1 && m.roles[0] === "athlete"));
}

/**
 * Pending, unexpired invitations. The invitation table is off-limits to the
 * app's database role (it holds bearer links), so this reads it with the
 * owner connection, always filtered to this tenant. Trainers see only the
 * invitations they sent.
 */
export async function listPendingInvitations(ctx: TenantContext): Promise<PendingInvitation[]> {
  const seesAll = can(ctx.roles, { invitation: ["cancel"] });
  const rows = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      inviterId: invitation.inviterId,
      inviterName: user.name,
    })
    .from(invitation)
    .leftJoin(user, eq(user.id, invitation.inviterId))
    .where(
      and(
        eq(invitation.organizationId, ctx.tenantId),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date()),
        seesAll ? undefined : eq(invitation.inviterId, ctx.userId),
      ),
    )
    .orderBy(desc(invitation.createdAt));
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    roles: parseRoles(r.role),
    expiresAt: r.expiresAt,
    inviterName: r.inviterName,
    sentByMe: r.inviterId === ctx.userId,
  }));
}

/** Everything the public accept-invitation page needs, or null if the link is bad. */
export async function getInvitationForAcceptPage(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      businessName: organization.name,
      businessSlug: organization.slug,
      businessMetadata: organization.metadata,
      inviterName: user.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .leftJoin(user, eq(user.id, invitation.inviterId))
    .where(eq(invitation.id, id))
    .limit(1);
  if (!row) return null;
  const existingUser = await db.query.user.findFirst({
    where: eq(user.email, row.email.toLowerCase()),
    columns: { id: true },
  });
  return {
    ...row,
    roles: parseRoles(row.role),
    expired: row.expiresAt.getTime() < Date.now(),
    hasAccount: Boolean(existingUser),
  };
}
