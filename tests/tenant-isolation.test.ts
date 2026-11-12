/**
 * Proves the Row-Level Security rules against a real Postgres database.
 * Needs: `pnpm db:migrate && pnpm db:seed` first (CI does this).
 *
 * This is the phase 0 gate: these tests must pass before phase 1 starts.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { parseRoles } from "@/server/auth/permissions";
import { db } from "@/server/db";
import {
  athleteIntakes,
  athleteProfiles,
  athleteTrainers,
  exercises,
  member,
  organization,
  user,
  videoAssets,
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
      expect(await withTenant(ctx, athleteNames)).toEqual(["Alex", "Casey", "Jordan", "Morgan"]);
    });

    it("manager (also a trainer) sees every athlete", async () => {
      const ctx = await ctxFor("maya@example.com", "jacob-strength");
      expect(await withTenant(ctx, athleteNames)).toEqual(["Alex", "Casey", "Jordan", "Morgan"]);
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
          .where(isNull(exercises.tenantId))
          .returning({ id: exercises.id });
        return { visible: visible.length, changed: changed.length };
      });
      expect(result.visible).toBeGreaterThanOrEqual(50);
      expect(result.changed).toBe(0);
    });
  });

  describe("client application and intake (step 5)", () => {
    const intakeOwners = (tx: TenantTx) =>
      tx
        .select({ name: athleteProfiles.firstName })
        .from(athleteIntakes)
        .innerJoin(athleteProfiles, eq(athleteProfiles.id, athleteIntakes.athleteProfileId))
        .then((rows) => rows.map((r) => r.name));

    it("intake is visible to the client's trainer, admins and the client only", async () => {
      const sam = await ctxFor("sam@example.com", "jacob-strength");
      const jacob = await ctxFor("jacob@example.com", "jacob-strength");
      const alex = await ctxFor("alex@example.com", "jacob-strength");
      const riley = await ctxFor("riley@example.com", "riverside-pt");
      expect(await withTenant(sam, intakeOwners)).toEqual(["Alex"]);
      expect(await withTenant(jacob, intakeOwners)).toEqual(["Alex"]);
      expect(await withTenant(alex, intakeOwners)).toEqual(["Alex"]);
      expect(await withTenant(riley, intakeOwners)).toEqual([]);
    });

    it("a trainer can't read the intake of a client who isn't theirs", async () => {
      const maya = await ctxFor("maya@example.com", "jacob-strength");
      // Maya is a manager too, so use a trainer-only view of her: drop the manager role.
      const trainerOnly = { ...maya, roles: ["trainer" as const] };
      expect(await withTenant(trainerOnly, intakeOwners)).toEqual([]);
    });

    it("clients can read but not edit their own profile or intake", async () => {
      const alex = await ctxFor("alex@example.com", "jacob-strength");
      const result = await tryThenRollback(alex, async (tx) => {
        const profiles = await tx
          .update(athleteProfiles)
          .set({ status: "active", goals: "changed" })
          .returning({ id: athleteProfiles.id });
        const intakes = await tx
          .update(athleteIntakes)
          .set({ injuries: "changed" })
          .returning({ id: athleteIntakes.athleteProfileId });
        return { profiles: profiles.length, intakes: intakes.length };
      });
      expect(result).toEqual({ profiles: 0, intakes: 0 });
    });

    it("a trainer who adds a client is assigned to them, and only to their own new clients", async () => {
      const sam = await ctxFor("sam@example.com", "jacob-strength");
      const result = await tryThenRollback(sam, async (tx) => {
        const newId = crypto.randomUUID();
        await tx.insert(athleteProfiles).values({
          id: newId,
          tenantId: sam.tenantId,
          firstName: "New",
          lastName: "Client",
          createdBy: sam.userId,
        });
        const claimed = await tx.execute<{ ok: boolean }>(
          sql`select app_claim_new_athlete(${newId}) as ok`,
        );
        const jordan = await tx.execute<{ ok: boolean }>(
          sql`select app_claim_new_athlete(id) as ok from athlete_profiles where email = 'jordan@example.com'`,
        );
        const visible = await tx
          .select({ id: athleteProfiles.id })
          .from(athleteProfiles)
          .where(eq(athleteProfiles.id, newId));
        return {
          claimed: claimed.rows[0].ok,
          jordanRows: jordan.rows.length,
          visible: visible.length,
        };
      });
      expect(result.claimed).toBe(true);
      expect(result.jordanRows).toBe(0); // Jordan isn't visible to Sam, so nothing to claim
      expect(result.visible).toBe(1);
    });

    it("can't add a client on someone else's behalf", async () => {
      const sam = await ctxFor("sam@example.com", "jacob-strength");
      const jacob = await ctxFor("jacob@example.com", "jacob-strength");
      await expect(
        tryThenRollback(sam, (tx) =>
          tx.insert(athleteProfiles).values({
            tenantId: sam.tenantId,
            firstName: "Sneaky",
            lastName: "Client",
            createdBy: jacob.userId,
          }),
        ),
      ).rejects.toThrow();
    });

    it("athletes can't add clients", async () => {
      const alex = await ctxFor("alex@example.com", "jacob-strength");
      await expect(
        tryThenRollback(alex, (tx) =>
          tx.insert(athleteProfiles).values({
            tenantId: alex.tenantId,
            firstName: "Friend",
            lastName: "Of Alex",
            createdBy: alex.userId,
          }),
        ),
      ).rejects.toThrow();
    });

    it("can't write an intake for another business's client", async () => {
      const riley = await ctxFor("riley@example.com", "riverside-pt");
      const alexProfile = await db.query.athleteProfiles.findFirst({
        where: eq(athleteProfiles.email, "alex@example.com"),
      });
      await expect(
        tryThenRollback(riley, (tx) =>
          tx.insert(athleteIntakes).values({
            athleteProfileId: alexProfile!.id,
            tenantId: riley.tenantId,
            injuries: "x",
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe("exercise library and videos (step 6)", () => {
    const names = (tx: TenantTx) =>
      tx
        .select({ name: exercises.name })
        .from(exercises)
        .where(sql`${exercises.tenantId} is not null`)
        .then((rows) => rows.map((r) => r.name).sort());

    it("a business sees its own exercises, not another's", async () => {
      const sam = await ctxFor("sam@example.com", "jacob-strength");
      const riley = await ctxFor("riley@example.com", "riverside-pt");
      expect(await withTenant(sam, names)).toEqual([
        "Banded Step-ups",
        "Incline Curls",
        "SL Hamstring Curls",
      ]);
      expect(await withTenant(riley, names)).toEqual([]);
    });

    it("athletes can't add or edit exercises", async () => {
      const alex = await ctxFor("alex@example.com", "jacob-strength");
      await expect(
        tryThenRollback(alex, (tx) =>
          tx.insert(exercises).values({ tenantId: alex.tenantId, name: "Alex's curl" }),
        ),
      ).rejects.toThrow();
      const changed = await tryThenRollback(alex, (tx) =>
        tx.update(exercises).set({ name: "x" }).returning({ id: exercises.id }),
      );
      expect(changed).toHaveLength(0);
    });

    it("nobody can delete exercises (they're archived instead)", async () => {
      const jacob = await ctxFor("jacob@example.com", "jacob-strength");
      await expect(
        tryThenRollback(jacob, (tx) =>
          tx.delete(exercises).where(eq(exercises.tenantId, jacob.tenantId)),
        ),
      ).rejects.toMatchObject({ cause: { code: "42501" } });
    });

    it("an exercise can't use another business's uploaded video", async () => {
      const riley = await ctxFor("riley@example.com", "riverside-pt");
      const jacob = await ctxFor("jacob@example.com", "jacob-strength");
      const [video] = await db
        .insert(videoAssets)
        .values({ tenantId: riley.tenantId, providerRef: `test-${crypto.randomUUID()}` })
        .returning({ id: videoAssets.id });
      try {
        await expect(
          tryThenRollback(jacob, (tx) =>
            tx.insert(exercises).values({
              tenantId: jacob.tenantId,
              name: "Borrowed video",
              videoAssetId: video.id,
            }),
          ),
        ).rejects.toThrow();
        const seen = await withTenant(jacob, (tx) =>
          tx.select().from(videoAssets).where(eq(videoAssets.id, video.id)),
        );
        expect(seen).toHaveLength(0);
      } finally {
        await db.delete(videoAssets).where(eq(videoAssets.id, video.id));
      }
    });
  });
});
