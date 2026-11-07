import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "../db";
import { member, organization, session as sessionTable } from "../db/schema";
import type { TenantContext } from "../db/tenant";
import { auth } from "./index";
import { parseRoles } from "./permissions";
import { staffSessionExpired } from "./session-policy";

/** All roles a user holds, across every business they belong to. */
async function rolesAcrossBusinesses(userId: string) {
  const rows = await db.select({ role: member.role }).from(member).where(eq(member.userId, userId));
  return rows.flatMap((r) => parseRoles(r.role));
}

/**
 * The signed-in session, or null. Cached for the rest of this request.
 * Coaches' sign-ins end 7 days after they signed in (see session-policy.ts).
 */
export const getSession = cache(async () => {
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current) return null;
  if (
    staffSessionExpired(current.session.createdAt, await rolesAcrossBusinesses(current.user.id))
  ) {
    await db.delete(sessionTable).where(eq(sessionTable.id, current.session.id));
    return null;
  }
  return current;
});

/** The signed-in user, or a redirect to the sign-in page. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

/** Businesses the user belongs to, with their roles in each. */
export async function listMyTenants(userId: string) {
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(organization.name);
  return rows.map((r) => ({ ...r, roles: parseRoles(r.role) }));
}

/**
 * Resolve /[tenant]/... to a TenantContext for the signed-in user.
 * Not signed in → sign-in page. Not a member of that business → 404, so
 * nobody can discover which business names exist.
 */
export const requireTenant = cache(async (slug: string): Promise<TenantContext> => {
  const user = await requireUser();
  const [row] = await db
    .select({
      tenantId: organization.id,
      tenantName: organization.name,
      tenantSlug: organization.slug,
      role: member.role,
    })
    .from(organization)
    .innerJoin(member, eq(member.organizationId, organization.id))
    .where(and(eq(organization.slug, slug), eq(member.userId, user.id)))
    .limit(1);

  if (!row) notFound();
  return {
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    tenantSlug: row.tenantSlug,
    userId: user.id,
    roles: parseRoles(row.role),
  };
});
