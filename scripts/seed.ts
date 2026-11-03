/**
 * Loads demo data for local development: `pnpm db:seed`
 *
 *   Jacob Strength (ptforge.app/jacob-strength)
 *     jacob@example.com   admin + trainer
 *     maya@example.com    manager + trainer
 *     sam@example.com     trainer
 *     alex@example.com    athlete (assigned to Sam)
 *   Riverside PT (a second business, to prove isolation)
 *     riley@example.com   admin
 *
 * Every demo account uses the password printed at the end.
 * Safe to run more than once: existing users and businesses are skipped.
 */
import { eq } from "drizzle-orm";
import { auth } from "../src/server/auth";
import type { RoleName } from "../src/server/auth/permissions";
import { db } from "../src/server/db";
import {
  athleteProfiles,
  athleteTrainers,
  exercises,
  member,
  organization,
  user,
} from "../src/server/db/schema";

const PASSWORD = "forge-ahead-demo-2026";

async function ensureUser(name: string, email: string) {
  const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
  if (existing) return existing.id;
  const res = await auth.api.signUpEmail({ body: { name, email, password: PASSWORD } });
  return res.user.id;
}

async function ensureTenant(name: string, slug: string, adminUserId: string) {
  const existing = await db.query.organization.findFirst({ where: eq(organization.slug, slug) });
  if (existing) return existing.id;
  const org = await auth.api.createOrganization({ body: { name, slug, userId: adminUserId } });
  if (!org) throw new Error(`Could not create ${name}`);
  return org.id;
}

async function setRoles(tenantId: string, userId: string, roles: RoleName[]) {
  const existing = await db.query.member.findFirst({
    where: (m, { and, eq }) => and(eq(m.organizationId, tenantId), eq(m.userId, userId)),
  });
  if (existing) {
    await db
      .update(member)
      .set({ role: roles.join(",") })
      .where(eq(member.id, existing.id));
  } else {
    await auth.api.addMember({ body: { organizationId: tenantId, userId, role: roles } });
  }
}

async function ensureAthlete(
  tenantId: string,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    serviceType: string;
    userId?: string;
  },
) {
  const existing = await db.query.athleteProfiles.findFirst({
    where: (a, { and, eq }) => and(eq(a.tenantId, tenantId), eq(a.email, data.email)),
  });
  if (existing) return existing.id;
  const [row] = await db
    .insert(athleteProfiles)
    .values({ tenantId, ...data })
    .returning({ id: athleteProfiles.id });
  return row.id;
}

async function assign(tenantId: string, athleteProfileId: string, trainerUserId: string) {
  await db
    .insert(athleteTrainers)
    .values({ tenantId, athleteProfileId, trainerUserId })
    .onConflictDoNothing();
}

const STARTER_EXERCISES = [
  { name: "Back Squat", category: "Squat", equipment: "Barbell", isCompetitionLift: true },
  { name: "Bench Press", category: "Press", equipment: "Barbell", isCompetitionLift: true },
  { name: "Deadlift", category: "Hinge", equipment: "Barbell", isCompetitionLift: true },
  { name: "Overhead Press", category: "Press", equipment: "Barbell", isCompetitionLift: false },
  { name: "Romanian Deadlift", category: "Hinge", equipment: "Barbell", isCompetitionLift: false },
  { name: "Pull-up", category: "Pull", equipment: "Bodyweight", isCompetitionLift: false },
  { name: "Dumbbell Row", category: "Pull", equipment: "Dumbbell", isCompetitionLift: false },
  { name: "Goblet Squat", category: "Squat", equipment: "Kettlebell", isCompetitionLift: false },
  {
    name: "Walking Lunge",
    category: "Single leg",
    equipment: "Dumbbell",
    isCompetitionLift: false,
  },
  { name: "Plank", category: "Core", equipment: "Bodyweight", isCompetitionLift: false },
];

async function main() {
  // Shared starter library (tenant_id NULL), visible to every business.
  const globalCount = await db.$count(exercises);
  if (globalCount === 0) await db.insert(exercises).values(STARTER_EXERCISES);

  const jacob = await ensureUser("Jacob Reed", "jacob@example.com");
  const maya = await ensureUser("Maya Chen", "maya@example.com");
  const sam = await ensureUser("Sam Patel", "sam@example.com");
  const alex = await ensureUser("Alex Morgan", "alex@example.com");
  const riley = await ensureUser("Riley Brooks", "riley@example.com");

  const jacobStrength = await ensureTenant("Jacob Strength", "jacob-strength", jacob);
  await setRoles(jacobStrength, jacob, ["admin", "trainer"]);
  await setRoles(jacobStrength, maya, ["manager", "trainer"]);
  await setRoles(jacobStrength, sam, ["trainer"]);
  await setRoles(jacobStrength, alex, ["athlete"]);

  const alexProfile = await ensureAthlete(jacobStrength, {
    firstName: "Alex",
    lastName: "Morgan",
    email: "alex@example.com",
    serviceType: "powerlifting",
    userId: alex,
  });
  const jordan = await ensureAthlete(jacobStrength, {
    firstName: "Jordan",
    lastName: "Lee",
    email: "jordan@example.com",
    serviceType: "personal_training",
  });
  const casey = await ensureAthlete(jacobStrength, {
    firstName: "Casey",
    lastName: "Nguyen",
    email: "casey@example.com",
    serviceType: "both",
  });
  await assign(jacobStrength, alexProfile, sam);
  await assign(jacobStrength, jordan, maya);
  await assign(jacobStrength, casey, jacob);

  const riverside = await ensureTenant("Riverside PT", "riverside-pt", riley);
  await ensureAthlete(riverside, {
    firstName: "Taylor",
    lastName: "Kim",
    email: "taylor@example.com",
    serviceType: "personal_training",
  });

  console.info(`
Seeded. Every demo account's password: ${PASSWORD}

  http://localhost:3000/jacob-strength
    jacob@example.com  admin + trainer   sees all 3 athletes
    maya@example.com   manager + trainer sees all 3 athletes
    sam@example.com    trainer           sees Alex only
    alex@example.com   athlete           sees own profile only
  http://localhost:3000/riverside-pt
    riley@example.com  admin             sees Taylor only
`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
