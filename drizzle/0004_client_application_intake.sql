CREATE TABLE "athlete_intakes" (
	"athlete_profile_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"exercise_history" text,
	"signup_reason" text,
	"height_cm" numeric(5, 1),
	"body_weight_kg" numeric(6, 3),
	"occupation" text,
	"stress_level" smallint,
	"training_days_per_week" smallint,
	"sleep" text,
	"diet" text,
	"injuries" text,
	"comp_squat_kg" numeric(6, 3),
	"comp_bench_kg" numeric(6, 3),
	"comp_deadlift_kg" numeric(6, 3),
	"gym_squat_kg" numeric(6, 3),
	"gym_bench_kg" numeric(6, 3),
	"gym_deadlift_kg" numeric(6, 3),
	"weekly_sets_squat" smallint,
	"weekly_sets_bench" smallint,
	"weekly_sets_deadlift" smallint,
	"weekly_sets_vertical_pull" smallint,
	"weekly_sets_core" smallint,
	"powerlifting_experience" text,
	"other_info" text,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "athlete_profiles" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ALTER COLUMN "service_type" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "sbd_unit" text DEFAULT 'kg' NOT NULL;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "pronouns" text;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "sex" text;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "preferred_trainer_user_id" uuid;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "coach_preference" text;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "coach_qualities" text;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "heard_about" text;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "fun_fact" text;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD COLUMN "submitted_ip_hash" text;--> statement-breakpoint
ALTER TABLE "athlete_intakes" ADD CONSTRAINT "athlete_intakes_athlete_profile_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_profile_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_intakes" ADD CONSTRAINT "athlete_intakes_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_intakes" ADD CONSTRAINT "athlete_intakes_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD CONSTRAINT "athlete_profiles_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD CONSTRAINT "athlete_profiles_preferred_trainer_user_id_user_id_fk" FOREIGN KEY ("preferred_trainer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "athlete_profiles_tenant_status_idx" ON "athlete_profiles" USING btree ("tenant_id","status");