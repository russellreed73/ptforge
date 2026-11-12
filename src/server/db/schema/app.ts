/**
 * PTForge's own tables. Every tenant-owned table has a non-null `tenant_id`
 * and is protected by Row-Level Security (drizzle/0001_row_level_security.sql).
 *
 * Phase 0 covers the tables needed to prove tenant isolation and the
 * trainer/manager visibility rules. Programs, workouts, videos and messages
 * arrive in later phases.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  primaryKey,
  smallint,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

const id = () =>
  uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const tenantId = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * A client of the business: a lead from the website Apply form, or someone a
 * coach added. Linked to a login (user) once they accept an invite.
 * The "Step 1 - Apply" answers live here; "Step 2 - Detailed intake" is in
 * athlete_intakes.
 */
export const athleteProfiles = pgTable(
  "athlete_profiles",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    /** Optional for clients a coach adds by hand; required to invite them. */
    email: text("email"),
    phone: text("phone"),
    dateOfBirth: date("date_of_birth"),
    /** One of the business's services (Settings), as text so renaming a service keeps history. */
    serviceType: text("service_type").notNull().default(""),
    /** Main training goals (Apply). */
    goals: text("goals"),
    /** lead | active | paused */
    status: text("status").notNull().default("active"),
    /** manual | website_form | invitation */
    source: text("source").notNull().default("manual"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),

    // Step 1 - Apply
    pronouns: text("pronouns"),
    /** male | female | other */
    sex: text("sex"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    instagram: text("instagram"),
    /** Trainer they asked for; null with coachPreference "unsure" or "none". */
    preferredTrainerUserId: uuid("preferred_trainer_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** trainer | unsure | none */
    coachPreference: text("coach_preference"),
    coachQualities: text("coach_qualities"),
    heardAbout: text("heard_about"),
    funFact: text("fun_fact"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    /** Salted hash of the applicant's IP, only for rate limiting the public form. */
    submittedIpHash: text("submitted_ip_hash"),
    ...timestamps,
  },
  (t) => [
    index("athlete_profiles_tenant_idx").on(t.tenantId),
    uniqueIndex("athlete_profiles_tenant_email_uq").on(t.tenantId, t.email),
    index("athlete_profiles_tenant_status_idx").on(t.tenantId, t.status),
  ],
);

/**
 * Step 2 - Detailed intake, filled in by the coach around the onboarding call.
 * One row per client. Loads are kg, height is cm.
 */
export const athleteIntakes = pgTable("athlete_intakes", {
  athleteProfileId: uuid("athlete_profile_id")
    .primaryKey()
    .references(() => athleteProfiles.id, { onDelete: "cascade" }),
  tenantId: tenantId(),
  exerciseHistory: text("exercise_history"),
  signupReason: text("signup_reason"),
  heightCm: numeric("height_cm", { precision: 5, scale: 1, mode: "number" }),
  bodyWeightKg: numeric("body_weight_kg", { precision: 6, scale: 3, mode: "number" }),
  occupation: text("occupation"),
  stressLevel: smallint("stress_level"),
  trainingDaysPerWeek: smallint("training_days_per_week"),
  sleep: text("sleep"),
  diet: text("diet"),
  injuries: text("injuries"),
  compSquatKg: numeric("comp_squat_kg", { precision: 6, scale: 3, mode: "number" }),
  compBenchKg: numeric("comp_bench_kg", { precision: 6, scale: 3, mode: "number" }),
  compDeadliftKg: numeric("comp_deadlift_kg", { precision: 6, scale: 3, mode: "number" }),
  gymSquatKg: numeric("gym_squat_kg", { precision: 6, scale: 3, mode: "number" }),
  gymBenchKg: numeric("gym_bench_kg", { precision: 6, scale: 3, mode: "number" }),
  gymDeadliftKg: numeric("gym_deadlift_kg", { precision: 6, scale: 3, mode: "number" }),
  weeklySetsSquat: smallint("weekly_sets_squat"),
  weeklySetsBench: smallint("weekly_sets_bench"),
  weeklySetsDeadlift: smallint("weekly_sets_deadlift"),
  weeklySetsVerticalPull: smallint("weekly_sets_vertical_pull"),
  weeklySetsCore: smallint("weekly_sets_core"),
  /** See POWERLIFTING_EXPERIENCE in src/lib/clients.ts */
  powerliftingExperience: text("powerlifting_experience"),
  otherInfo: text("other_info"),
  updatedBy: uuid("updated_by").references(() => user.id, { onDelete: "set null" }),
  ...timestamps,
});

/** Which trainers work with which athlete. An athlete can have several. */
export const athleteTrainers = pgTable(
  "athlete_trainers",
  {
    id: id(),
    tenantId: tenantId(),
    athleteProfileId: uuid("athlete_profile_id")
      .notNull()
      .references(() => athleteProfiles.id, { onDelete: "cascade" }),
    trainerUserId: uuid("trainer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by").references(() => user.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("athlete_trainers_uq").on(t.athleteProfileId, t.trainerUserId),
    index("athlete_trainers_trainer_idx").on(t.tenantId, t.trainerUserId),
  ],
);

/**
 * Uploaded demo videos (Cloudflare Stream). Exercises point at one of these,
 * or carry a plain link (YouTube, Vimeo, Google Drive) in demo_video_url.
 */
export const videoAssets = pgTable(
  "video_assets",
  {
    id: id(),
    tenantId: tenantId(),
    /** cloudflare_stream */
    provider: text("provider").notNull().default("cloudflare_stream"),
    /** The provider's id for the video (Stream "uid"). */
    providerRef: text("provider_ref").notNull(),
    /** uploading | processing | ready | error */
    status: text("status").notNull().default("uploading"),
    fileName: text("file_name"),
    durationSeconds: numeric("duration_seconds", { precision: 8, scale: 1, mode: "number" }),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("video_assets_tenant_idx").on(t.tenantId),
    uniqueIndex("video_assets_provider_ref_uq").on(t.provider, t.providerRef),
  ],
);

/**
 * Exercise library. tenant_id NULL = PTForge's shared starter library, which
 * every business can see and copy; a business's own exercises have its tenant_id.
 * Fields follow Jacob's prototype: muscle group, lift family, equipment,
 * movement type, tags and coaching cues.
 */
export const exercises = pgTable(
  "exercises",
  {
    id: id(),
    tenantId: uuid("tenant_id").references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Lift family, e.g. Squat, Bench accessory, Arms, Warmup. */
    category: text("category"),
    equipment: text("equipment"),
    /** Muscle group(s), e.g. ["Quads"]. */
    primaryMuscles: text("primary_muscles").array(),
    /** Movement type, e.g. Compound, Isolation, Hinge, Mobility. */
    movement: text("movement"),
    /** Lower-case search tags; "sbd" marks the competition lifts. */
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    cues: text("cues"),
    isCompetitionLift: boolean("is_competition_lift").notNull().default(false),
    /** A YouTube, Vimeo, Google Drive or other https link. */
    demoVideoUrl: text("demo_video_url"),
    videoAssetId: uuid("video_asset_id").references(() => videoAssets.id, { onDelete: "set null" }),
    /** For a business's customised copy of a starter exercise: the original. */
    sourceExerciseId: uuid("source_exercise_id").references((): AnyPgColumn => exercises.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("exercises_tenant_idx").on(t.tenantId),
    index("exercises_source_idx").on(t.tenantId, t.sourceExerciseId),
  ],
);

/** Who did what, for sensitive actions and platform-owner support sessions. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    tenantId: tenantId(),
    actorUserId: uuid("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_tenant_idx").on(t.tenantId, t.createdAt)],
);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/**
 * A business's logo and the images generated from it (header logo, phone app
 * icons). Small PNGs, so they live in Postgres rather than a separate file
 * store. Public images, served by /brand/[tenant]/[asset]. The app's database
 * role has no access; only Settings (owner connection, admin-checked) writes.
 */
export const businessAssets = pgTable(
  "business_assets",
  {
    tenantId: tenantId(),
    /** header | icon-192 | icon-512 | maskable-512 | apple-180 | source (the original upload, never served) */
    kind: text("kind").notNull(),
    contentType: text("content_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    data: bytea("data").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.kind] })],
);

export const athleteProfilesRelations = relations(athleteProfiles, ({ one, many }) => ({
  user: one(user, { fields: [athleteProfiles.userId], references: [user.id] }),
  trainers: many(athleteTrainers),
  intake: one(athleteIntakes),
}));

export const athleteIntakesRelations = relations(athleteIntakes, ({ one }) => ({
  athlete: one(athleteProfiles, {
    fields: [athleteIntakes.athleteProfileId],
    references: [athleteProfiles.id],
  }),
}));

export const athleteTrainersRelations = relations(athleteTrainers, ({ one }) => ({
  athlete: one(athleteProfiles, {
    fields: [athleteTrainers.athleteProfileId],
    references: [athleteProfiles.id],
  }),
  trainer: one(user, { fields: [athleteTrainers.trainerUserId], references: [user.id] }),
}));
