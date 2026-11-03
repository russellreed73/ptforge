import { sql } from "drizzle-orm";
import { db } from "./index";
import type { RoleName } from "../auth/permissions";

/** Who is asking, and in which business. Built by requireTenant() from the session. */
export type TenantContext = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  userId: string;
  roles: RoleName[];
};

export type TenantTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run database work for one tenant, with Row-Level Security switched on.
 *
 * Inside `fn`, every query only sees rows the current member is allowed to see:
 * their tenant only; all athletes for admins/managers; assigned athletes for
 * trainers; their own profile for athletes. Use this for ALL tenant data.
 *
 * @example
 * const athletes = await withTenant(ctx, (tx) => tx.select().from(athleteProfiles));
 *
 * Note for inserts: Postgres checks RETURNING rows against the SELECT policy,
 * so a trainer inserting an athlete they aren't assigned to yet should
 * generate the id with crypto.randomUUID() and skip `.returning()`.
 */
export async function withTenant<T>(
  ctx: Pick<TenantContext, "tenantId" | "userId" | "roles">,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // `true` = local to this transaction, so pooled connections never leak
    // one request's tenant into another.
    await tx.execute(sql`
      select
        set_config('app.tenant_id', ${ctx.tenantId}, true),
        set_config('app.user_id', ${ctx.userId}, true),
        set_config('app.roles', ${ctx.roles.join(",")}, true)
    `);
    await tx.execute(sql`set local role ptforge_app`);
    return fn(tx);
  });
}
