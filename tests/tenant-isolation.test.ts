/**
 * Proves the Row-Level Security rules against a real Postgres database.
 * Needs: `pnpm db:migrate && pnpm db:seed` first (CI does this).
 *
 * This is the phase 0 gate: these tests must pass before phase 1 starts.
 */
import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { parseRoles } from "@/server/auth/permissions";
import { db } from "@/server/db";
import {
  athleteProfiles,
  athleteTrainers,
  exercises,
  member,
  organization,
  user,
} from "@/server/db/schema";
import { withTenant, type TenantTx } from "@/server/db/tenant";

const hasDb = Boolean(process.env.DATABASE_URL);

async function ctxFor(email: string, slug: string) {
  const [row] = await db
    .select({ tenantId: organization.id, userId: user.id, role: member.role })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(and(eq(user.email, email), eq(organization.slug, slug)));
  if (!row) throw new Error(`Seed data missing for ${email} in ${slug}. Run pnpm db:seed.`);
  return { tenantId: row.tenantId, userId: row.userId, roles: parseRoles(row.role) };
}

async function tenantIdOf(slug: string) {
  const org = await db.query.organization.findFirst({ where: eq(organization.slug, slug) });
  return org!.id;
}

const athleteNames = (tx: TenantTx) =>
  tx
    .select({ name: athleteProfiles.firstName })
    .from(athleteProfiles)
    .orderBy(athleteProfiles.firstName)
    .then((rows) => rows.map((r) => r.name));

/** Run fn inside withTenant, then roll everything back. */
const ROLLBACK = new Error("rollback");
async function tryThenRollback<T>(
  ctx: Awaited<ReturnType<typeof ctxFor>>,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  let result: T;
  try {
    await withTenant(ctx, async (tx) => {
      result = await fn(tx);
      throw ROLLBACK;
    });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
  return result!;
}

describe.skipIf(!hasDb)("tenant isolation (Row-Level Security)", () => {
  afterAll(async () => {
    // Let vitest exit cleanly.
    await db.$client.end();
  });

  describe("who sees which athletes", () => {
    it("administrator sees every athlete in their business", async () => {
      const ctx = await ctxFor("jacob@example.com", "jacob-strength");
      expect(await withTenant(ctx, athleteNames)).toEqual(["Alex", "Casey", "Jordan"]);
    });

    it("manager (also a trainer) sees every athlete", async () => {
      const ctx = await ctxFor("maya@example.com", "jacob-strength");
      expect(await withTenant(ctx, athleteNames)).toEqual(["Alex", "Casey", "Jordan"]);
    });

    it("trainer sees only assigned athletes", async () => {
      const ctx = await ctxFor("sam@example.com", "jacob-strength");
      expect(await withTenant(ctx, athleteNames)).toEqual(["Alex"]);
    });

    it("athlete sees only their own profile", async () => {
      const ctx = await ctxFor("alex@example.com", "jacob-strength");
      expect(await withTenant(ctx, athleteNames)).toEqual(["Alex"]);
    });

    it("another business sees only its own athletes", async () => {
      const ctx = await ctxFor("riley@example.com", "riverside-pt");
      expect(await withTenant(ctx, athleteNames)).toEqual(["Taylor"]);
    });
  });

  describe("cross-tenant attempts fail", () => {
    it("can't read another tenant's athletes even when asking for them by tenant_id", async () => {
      const ctx = await ctxFor("jacob@example.com", "jacob-strength");
      const riverside = await tenantIdOf("riverside-pt");
      const rows = await withTenant(ctx, (tx) =>
        tx.select().from(athleteProfiles).where(eq(athleteProfiles.tenantId, riverside)),
      );
      expect(rows).toHaveLength(0);
    });

    it("can't insert a row into another tenant", async () => {
      const ctx = await ctxFor("jacob@example.com", "jacob-strength");
      const riverside = await tenantIdOf("riverside-pt");
      await expect(
        withTenant(ctx, (tx) =>
          tx.insert(athleteProfiles).values({
            tenantId: riverside,
            firstName: "Sneaky",
            lastName: "Insert",
            email: "sneaky@example.com",
          }),
        ),
      ).rejects.toThrow();
    });

    it("can't see people from another tenant in the user table", async () => {
      const ctx = await ctxFor("jacob@example.com", "jacob-strength");
      const emails = await withTenant(ctx, (tx) =>
        tx.select({ email: user.email }).from(user).orderBy(user.email),
      );
      expect(emails.map((e) => e.email)).not.toContain("riley@example.com");
      expect(emails).toHaveLength(4);
    });

    it("sees nothing at all when no tenant is set", async () => {
      const rows = await db.transaction(async (tx) => {
        await tx.execute(sql`set local role ptforge_app`);
        return tx.select().from(athleteProfiles);
      });
      expect(rows).toHaveLength(0);
    });
  });

  describe("secrets are off-limits to the app role", () => {
    it.each(["session", "account", "verification", "invitation", "two_factor", "business_assets"])(
      "cannot read %s",
      async (table) => {
        const ctx = await ctxFor("jacob@example.com", "jacob-strength");
        await expect(
          withTenant(ctx, (tx) => tx.execute(sql.raw(`select * from "${table}" limit 1`))),
        ).rejects.toMatchObject({ cause: { code: "42501" } }); // insufficient_privilege
      },
    );
  });

  describe("role rules on writes", () => {
    it("trainer cannot assign themselves to someone else's athlete", async () => {
      const ctx = await ctxFor("sam@example.com", "jacob-strength");
      const jordan = await db.query.athleteProfiles.findFirst({
        where: eq(athleteProfiles.email, "jordan@example.com"),
      });
      await expect(
        tryThenRollback(ctx, (tx) =>
          tx.insert(athleteTrainers).values({
            tenantId: ctx.tenantId,
            athleteProfileId: jordan!.id,
            trainerUserId: ctx.userId,
          }),
        ),
      ).rejects.toThrow();
    });

    it("manager can assign athletes to trainers", async () => {
      const ctx = await ctxFor("maya@example.com", "jacob-strength");
      const sam = await ctxFor("sam@example.com", "jacob-strength");
      const jordan = await db.query.athleteProfiles.findFirst({
        where: eq(athleteProfiles.email, "jordan@example.com"),
      });
      await expect(
        tryThenRollback(ctx, (tx) =>
          tx.insert(athleteTrainers).values({
            tenantId: ctx.tenantId,
            athleteProfileId: jordan!.id,
            trainerUserId: sam.userId,
          }),
        ),
      ).resolves.not.toThrow();
    });

    it("trainer's update of an unassigned athlete changes nothing", async () => {
      const ctx = await ctxFor("sam@example.com", "jacob-strength");
      const updated = await tryThenRollback(ctx, (tx) =>
        tx
          .update(athleteProfiles)
          .set({ goals: "changed" })
          .where(eq(athleteProfiles.email, "jordan@example.com"))
          .returning({ id: athleteProfiles.id }),
      );
      expect(updated).toHaveLength(0);
    });

    it("everyone reads the shared exercise library but nobody can edit it", async () => {
      const ctx = await ctxFor("jacob@example.com", "jacob-strength");
      const result = await tryThenRollback(ctx, async (tx) => {
        const visible = await tx.select().from(exercises);
        const changed = await tx
          .update(exercises)
          .set({ name: "Hacked" })
          .returning({ id: exercises.id });
        return { visible: visible.length, changed: changed.length };
      });
      expect(result.visible).toBeGreaterThanOrEqual(10);
      expect(result.changed).toBe(0);
    });
  });
});
