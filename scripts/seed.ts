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
import type { ProgramSet } from "../src/lib/programs";
import { auth } from "../src/server/auth";
import type { RoleName } from "../src/server/auth/permissions";
import { db } from "../src/server/db";
import {
  athleteIntakes,
  athleteProfiles,
  athleteTrainers,
  exercises,
  member,
  organization,
  programs,
  user,
} from "../src/server/db/schema";

const PASSWORD = "forge-ahead-demo-2026";

async function ensureUser(name: string, email: string) {
  const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
  if (existing) return existing.id;
  // Server-side create: no confirmation email, and marked as confirmed so the
  // demo accounts can sign in straight away.
  const res = await auth.api.createUser({
    body: { name, email, password: PASSWORD, role: "user", data: { emailVerified: true } },
  });
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
  } & Partial<typeof athleteProfiles.$inferInsert>,
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

async function main() {
  // PTForge's shared starter library comes from migration 0007.

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

  // Jacob's services and Apply form, as in his prototype.
  await db
    .update(organization)
    .set({
      metadata: JSON.stringify({
        theme: "next-level",
        defaultUnit: "kg",
        services: [
          "Online 1 on 1 Powerlifting Coaching",
          "Online 1 on 1 Performance Coaching",
          "In-person Personal Training",
        ],
      }),
    })
    .where(eq(organization.id, jacobStrength));

  const alexProfile = await ensureAthlete(jacobStrength, {
    firstName: "Alex",
    lastName: "Morgan",
    email: "alex@example.com",
    serviceType: "Online 1 on 1 Powerlifting Coaching",
    userId: alex,
    pronouns: "They / them",
    sex: "other",
    country: "Canada",
    region: "Ontario",
    city: "Burlington",
    instagram: "@alex.lifts",
    coachPreference: "unsure",
    coachQualities: "Direct feedback, explains the why, checks in without nagging.",
    goals: "First meet this winter: build the total and stay healthy doing it.",
    heardAbout: "Instagram",
    funFact: "Can solve a Rubik's cube in under two minutes.",
    source: "website_form",
    appliedAt: new Date("2026-10-01T15:00:00Z"),
  });
  await db
    .insert(athleteIntakes)
    .values({
      athleteProfileId: alexProfile,
      tenantId: jacobStrength,
      exerciseHistory:
        "Training 4x/week for the past 6 months, SBD-focused with upper-body accessories.",
      signupReason: "Structure and accountability heading into a first meet.",
      heightCm: 175,
      bodyWeightKg: 82.5,
      occupation: "Desk job, 9 to 5. Trains evenings Mon / Tue / Thu / Sat.",
      stressLevel: 5,
      trainingDaysPerWeek: 4,
      sleep: "7 to 8 hours most nights, worse before early shifts.",
      diet: "Three meals and a shake. Protein slips on busy days.",
      injuries: "Right knee gets cranky with high squat volume.",
      compSquatKg: 180,
      compBenchKg: 92.5,
      compDeadliftKg: 180,
      gymSquatKg: 185,
      gymBenchKg: 95,
      gymDeadliftKg: 187.5,
      weeklySetsSquat: 14,
      weeklySetsBench: 18,
      weeklySetsDeadlift: 10,
      weeklySetsVerticalPull: 12,
      weeklySetsCore: 6,
      powerliftingExperience: "Planning on competing soon (within 6 months)",
      otherInfo: "Main question is meet-day handling.",
    })
    .onConflictDoNothing();
  const jordan = await ensureAthlete(jacobStrength, {
    firstName: "Jordan",
    lastName: "Lee",
    email: "jordan@example.com",
    serviceType: "In-person Personal Training",
  });
  const casey = await ensureAthlete(jacobStrength, {
    firstName: "Casey",
    lastName: "Nguyen",
    email: "casey@example.com",
    serviceType: "Online 1 on 1 Performance Coaching",
    status: "paused",
  });
  // A new lead from the website, not assigned to anyone yet.
  await ensureAthlete(jacobStrength, {
    firstName: "Morgan",
    lastName: "Diaz",
    email: "morgan@example.com",
    serviceType: "Online 1 on 1 Powerlifting Coaching",
    status: "lead",
    source: "website_form",
    pronouns: "She / her",
    sex: "female",
    country: "Canada",
    region: "Ontario",
    city: "Hamilton",
    coachPreference: jacob,
    preferredTrainerUserId: jacob,
    coachQualities: "Someone who programs around a busy shift schedule.",
    goals: "Compete at provincials next year.",
    heardAbout: "A friend at the gym",
    funFact: "Has run three marathons.",
    appliedAt: new Date(),
  });
  await assign(jacobStrength, alexProfile, sam);
  await assign(jacobStrength, jordan, maya);
  await assign(jacobStrength, casey, jacob);

  // A few of Jacob's own exercises, as in his prototype.
  const jacobExercises = await db.$count(exercises, eq(exercises.tenantId, jacobStrength));
  if (jacobExercises === 0) {
    await db.insert(exercises).values([
      {
        tenantId: jacobStrength,
        name: "Banded Step-ups",
        primaryMuscles: ["Quads"],
        category: "Squat accessory",
        equipment: "Band",
        movement: "Single leg",
        tags: ["squat", "quads", "single leg", "knee friendly"],
        createdBy: jacob,
      },
      {
        tenantId: jacobStrength,
        name: "SL Hamstring Curls",
        primaryMuscles: ["Hamstrings"],
        category: "Deadlift accessory",
        equipment: "Machine",
        movement: "Isolation",
        tags: ["hamstrings", "single leg", "machine", "isolation"],
        createdBy: jacob,
      },
      {
        tenantId: jacobStrength,
        name: "Incline Curls",
        primaryMuscles: ["Biceps"],
        category: "Arms",
        equipment: "Dumbbell",
        movement: "Isolation",
        tags: ["biceps", "arms", "stretch", "curl"],
        cues: "Let the arms hang behind you; no swinging.",
        createdBy: jacob,
      },
    ]);
  }

  // A 4-day powerlifting block like Jacob's prototype: as a template, and
  // assigned to Alex as their current block.
  if ((await db.$count(programs, eq(programs.tenantId, jacobStrength))) === 0) {
    const lib = await db.select({ id: exercises.id, name: exercises.name }).from(exercises);
    const ex = (name: string) => lib.find((e) => e.name === name)?.id ?? null;
    let n = 0;
    const nid = () => `seed${(++n).toString().padStart(4, "0")}`;
    const rpe = (...w: string[]) => w;
    const set = (reps: string, targets: string[]) => ({
      id: nid(),
      reps,
      rpe: targets,
      backdownPct: null,
    });
    const backdown = (reps: string, pct: number): ProgramSet => ({
      id: nid(),
      reps,
      rpe: ["", "", "", ""],
      backdownPct: pct,
    });
    const item = (
      name: string,
      sets: ProgramSet[],
      extra: { notes?: string; est?: boolean } = {},
    ) => ({
      id: nid(),
      exerciseId: ex(name),
      name,
      notes: extra.notes ?? "",
      showEstimatedLoad: extra.est ?? false,
      sets,
    });
    const warm = (name: string, dose: string) => ({ id: nid(), exerciseId: ex(name), name, dose });
    const content = {
      days: [
        {
          id: nid(),
          title: "Day 1 — Squat 1, Deadlift 2",
          notes: "",
          warmups: [warm("Dowel Complex", "10e"), warm("Hip CARs", "6e")],
          exercises: [
            item("Competition Squat", [set("5", rpe("6.5", "7", "7.5", "8")), backdown("5", 8)], {
              est: true,
            }),
            item("Romanian Deadlift", [
              set("8", rpe("7", "7", "8", "8")),
              set("8", rpe("7", "8", "8", "9")),
              set("8", rpe("8", "8", "9", "9")),
            ]),
            item(
              "Banded Step-ups",
              [set("10e", rpe("7", "7", "8", "8")), set("10e", rpe("7", "7", "8", "8"))],
              { notes: "Knee friendly; pick a box height that stays pain-free." },
            ),
          ],
        },
        {
          id: nid(),
          title: "Day 2 — Bench 1",
          notes: "",
          warmups: [warm("Dowel Complex", "10e"), warm("90-90 Hip Switch", "8e")],
          exercises: [
            item(
              "Competition Bench Press",
              [set("5", rpe("6.5", "7", "7.5", "8")), backdown("5", 8)],
              { est: true },
            ),
            item("Lat Pulldown", [
              set("10", rpe("7", "7", "8", "8")),
              set("10", rpe("8", "8", "8", "8")),
            ]),
            item("Chest-Supported Row", [
              set("10", rpe("7", "7", "8", "8")),
              set("10", rpe("8", "8", "8", "8")),
            ]),
          ],
        },
        {
          id: nid(),
          title: "Day 3 — Deadlift 1, Squat 2",
          notes: "",
          warmups: [warm("Hip CARs", "6e"), warm("Ankle Dorsiflexion Mobilization", "10e")],
          exercises: [
            item("Competition Deadlift", [
              set("3", rpe("6.5", "7", "7.5", "8")),
              backdown("3", 10),
            ]),
            item("Competition Squat", [
              set("6", rpe("6", "6.5", "7", "7.5")),
              set("6", rpe("7", "7", "7.5", "8")),
            ]),
            item("SL Hamstring Curls", [
              set("10e", rpe("7", "7", "7", "7")),
              set("10e", rpe("8", "8", "8", "8")),
            ]),
          ],
        },
        {
          id: nid(),
          title: "Day 4 — Bench 2, Arms",
          notes: "",
          warmups: [warm("Dowel Complex", "10e")],
          exercises: [
            item("Competition Bench Press", [
              set("8", rpe("6", "6.5", "7", "7.5")),
              set("8", rpe("7", "7.5", "8", "8")),
            ]),
            item("Dumbbell Biceps Curl", [
              set("12", rpe("8", "8", "9", "9")),
              set("12", rpe("9", "9", "9", "9")),
            ]),
            item("Hammer Curl", [
              set("12", rpe("8", "8", "9", "9")),
              set("12", rpe("9", "9", "9", "9")),
            ]),
          ],
        },
      ],
    };
    const [template] = await db
      .insert(programs)
      .values({
        tenantId: jacobStrength,
        name: "4-day powerlifting split",
        goals: "Build SBD strength and work capacity.",
        weeks: 4,
        status: "draft",
        content,
        createdBy: jacob,
      })
      .returning({ id: programs.id });
    await db.insert(programs).values({
      tenantId: jacobStrength,
      athleteProfileId: alexProfile,
      name: "Y1M2",
      goals: "Keep building work capacity · work around the knee · continue to build SBD strength",
      weeks: 4,
      status: "active",
      startDate: new Date().toISOString().slice(0, 10),
      content,
      sourceProgramId: template.id,
      createdBy: sam,
    });
    // A draft for Jordan, only coaches see it.
    await db.insert(programs).values({
      tenantId: jacobStrength,
      athleteProfileId: jordan,
      name: "Block 1",
      weeks: 4,
      status: "draft",
      content: { days: [] },
      createdBy: maya,
    });
  }

  const riverside = await ensureTenant("Riverside PT", "riverside-pt", riley);
  await ensureAthlete(riverside, {
    firstName: "Taylor",
    lastName: "Kim",
    email: "taylor@example.com",
    serviceType: "Personal training",
  });

  console.info(`
Seeded. Every demo account's password: ${PASSWORD}

  http://localhost:3000/jacob-strength
    jacob@example.com  admin + trainer   sees all 4 clients (incl. lead Morgan)
    maya@example.com   manager + trainer sees all 4 clients
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
