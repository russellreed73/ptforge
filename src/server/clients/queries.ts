import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { CLIENT_STATUSES, type ClientStatus } from "@/lib/clients";
import { can, parseRoles } from "../auth/permissions";
import { db } from "../db";
import {
  athleteIntakes,
  athleteProfiles,
  athleteTrainers,
  invitation,
  member,
  user,
} from "../db/schema";
import { withTenant, type TenantContext } from "../db/tenant";

export type ClientFilters = {
  q?: string;
  /** a status, or "archived" */
  view?: ClientStatus | "archived" | "all";
  service?: string;
  /** a trainer's user id, or "none" for unassigned */
  trainer?: string;
};

export function readClientFilters(
  sp: Record<string, string | string[] | undefined>,
): ClientFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : undefined);
  const view = one("view");
  return {
    q: one("q") || undefined,
    view:
      view === "archived" || (CLIENT_STATUSES as readonly string[]).includes(view ?? "")
        ? (view as ClientFilters["view"])
        : "all",
    service: one("service") || undefined,
    trainer: one("trainer") || undefined,
  };
}

/**
 * Clients the signed-in coach can see (Row-Level Security decides: all for
 * administrators and managers, assigned ones for trainers).
 */
export async function listClients(ctx: TenantContext, f: ClientFilters) {
  return withTenant(ctx, async (tx) => {
    const where: SQL[] = [];
    if (f.view === "archived") where.push(isNotNull(athleteProfiles.archivedAt));
    else {
      where.push(isNull(athleteProfiles.archivedAt));
      if (f.view && f.view !== "all") where.push(eq(athleteProfiles.status, f.view));
    }
    if (f.service) where.push(eq(athleteProfiles.serviceType, f.service));
    if (f.q) {
      const like = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      where.push(
        or(
          ilike(sql`${athleteProfiles.firstName} || ' ' || ${athleteProfiles.lastName}`, like),
          ilike(athleteProfiles.email, like),
          ilike(athleteProfiles.instagram, like),
        )!,
      );
    }
    if (f.trainer === "none") {
      where.push(
        sql`not exists (select 1 from ${athleteTrainers} t where t.athlete_profile_id = ${athleteProfiles.id})`,
      );
    } else if (f.trainer) {
      where.push(
        sql`exists (select 1 from ${athleteTrainers} t where t.athlete_profile_id = ${athleteProfiles.id} and t.trainer_user_id = ${f.trainer})`,
      );
    }

    const rows = await tx
      .select({
        id: athleteProfiles.id,
        firstName: athleteProfiles.firstName,
        lastName: athleteProfiles.lastName,
        email: athleteProfiles.email,
        serviceType: athleteProfiles.serviceType,
        status: athleteProfiles.status,
        source: athleteProfiles.source,
        appliedAt: athleteProfiles.appliedAt,
        createdAt: athleteProfiles.createdAt,
        archivedAt: athleteProfiles.archivedAt,
        hasLogin: sql<boolean>`${athleteProfiles.userId} is not null`,
      })
      .from(athleteProfiles)
      .where(and(...where))
      .orderBy(
        // Newest leads first, everyone else by name.
        desc(sql`${athleteProfiles.status} = 'lead'`),
        desc(
          sql`case when ${athleteProfiles.status} = 'lead' then ${athleteProfiles.createdAt} end`,
        ),
        asc(athleteProfiles.lastName),
        asc(athleteProfiles.firstName),
      )
      .limit(500);

    const trainers = rows.length
      ? await tx
          .select({
            athleteProfileId: athleteTrainers.athleteProfileId,
            name: user.name,
          })
          .from(athleteTrainers)
          .innerJoin(user, eq(user.id, athleteTrainers.trainerUserId))
          .where(
            inArray(
              athleteTrainers.athleteProfileId,
              rows.map((r) => r.id),
            ),
          )
          .orderBy(asc(user.name))
      : [];
    return rows.map((r) => ({
      ...r,
      trainers: trainers.filter((t) => t.athleteProfileId === r.id).map((t) => t.name),
    }));
  });
}

/** Lead/active/paused/archived counts for the filter tabs. */
export async function countClients(ctx: TenantContext) {
  const rows = await withTenant(ctx, (tx) =>
    tx
      .select({
        archived: sql<boolean>`${athleteProfiles.archivedAt} is not null`,
        status: athleteProfiles.status,
        n: sql<number>`count(*)::int`,
      })
      .from(athleteProfiles)
      .groupBy(sql`1`, athleteProfiles.status),
  );
  const counts = { all: 0, lead: 0, active: 0, paused: 0, archived: 0 };
  for (const r of rows) {
    if (r.archived) counts.archived += r.n;
    else {
      counts.all += r.n;
      if (r.status in counts) counts[r.status as ClientStatus] += r.n;
    }
  }
  return counts;
}

/** Everyone in the business who coaches (holds the trainer role). */
export async function listCoaches(tenantId: string) {
  const rows = await db
    .select({ userId: member.userId, name: user.name, role: member.role })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, tenantId))
    .orderBy(asc(user.name));
  return rows
    .filter((r) => parseRoles(r.role).includes("trainer"))
    .map(({ userId, name }) => ({ userId, name }));
}

/** One client with their intake, trainers and app status, or null if not visible. */
export async function getClient(ctx: TenantContext, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const result = await withTenant(ctx, async (tx) => {
    const profile = await tx.query.athleteProfiles.findFirst({
      where: eq(athleteProfiles.id, id),
    });
    if (!profile) return null;
    const intake = await tx.query.athleteIntakes.findFirst({
      where: eq(athleteIntakes.athleteProfileId, id),
    });
    const trainers = await tx
      .select({ userId: athleteTrainers.trainerUserId, name: user.name, email: user.email })
      .from(athleteTrainers)
      .innerJoin(user, eq(user.id, athleteTrainers.trainerUserId))
      .where(eq(athleteTrainers.athleteProfileId, id))
      .orderBy(asc(user.name));
    return { profile, intake: intake ?? null, trainers };
  });
  if (!result) return null;

  // Invitations hold bearer links, so the app role can't read them; check with
  // the owner connection, limited to this business and this email.
  let pendingInvite: { id: string; expiresAt: Date } | null = null;
  if (!result.profile.userId && result.profile.email) {
    const [inv] = await db
      .select({ id: invitation.id, expiresAt: invitation.expiresAt })
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, ctx.tenantId),
          eq(sql`lower(${invitation.email})`, result.profile.email.toLowerCase()),
          eq(invitation.status, "pending"),
        ),
      )
      .orderBy(desc(invitation.expiresAt))
      .limit(1);
    if (inv && inv.expiresAt.getTime() > Date.now()) pendingInvite = inv;
  }
  return { ...result, pendingInvite };
}

export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClient>>>;

/** What the signed-in coach may do with clients. */
export function clientPermissions(ctx: TenantContext) {
  return {
    create: can(ctx.roles, { athlete: ["create"] }),
    seesAll: can(ctx.roles, { athlete: ["view_all"] }),
    assign: can(ctx.roles, { athlete: ["assign_trainer"] }),
    archive: can(ctx.roles, { athlete: ["archive"] }),
    invite: can(ctx.roles, { invitation: ["create"] }),
  };
}
