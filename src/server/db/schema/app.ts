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
  pgTable,
  text,
  timestamp,
  primaryKey,
  uniqueIndex,
  uuid,
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

/** A client of the business. Linked to a login (user) once they accept an invite. */
export const athleteProfiles = pgTable(
  "athlete_profiles",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    dateOfBirth: date("date_of_birth"),
    /** personal_training | powerlifting | both */
    serviceType: text("service_type").notNull().default("personal_training"),
    goals: text("goals"),
    /** active | paused */
    status: text("status").notNull().default("active"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("athlete_profiles_tenant_idx").on(t.tenantId),
    uniqueIndex("athlete_profiles_tenant_email_uq").on(t.tenantId, t.email),
  ],
);

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

/** Exercise library. tenant_id NULL = PTForge's shared starter library. */
export const exercises = pgTable(
  "exercises",
  {
    id: id(),
    tenantId: uuid("tenant_id").references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category"),
    equipment: text("equipment"),
    primaryMuscles: text("primary_muscles").array(),
    cues: text("cues"),
    isCompetitionLift: boolean("is_competition_lift").notNull().default(false),
    /** Filled in phase 1: video_assets id or a YouTube URL. */
    demoVideoUrl: text("demo_video_url"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("exercises_tenant_idx").on(t.tenantId)],
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
}));

export const athleteTrainersRelations = relations(athleteTrainers, ({ one }) => ({
  athlete: one(athleteProfiles, {
    fields: [athleteTrainers.athleteProfileId],
    references: [athleteProfiles.id],
  }),
  trainer: one(user, { fields: [athleteTrainers.trainerUserId], references: [user.id] }),
}));
