CREATE TABLE "video_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" text DEFAULT 'cloudflare_stream' NOT NULL,
	"provider_ref" text NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"file_name" text,
	"duration_seconds" numeric(8, 1),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "movement" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "video_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "source_exercise_id" uuid;--> statement-breakpoint
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_assets" ADD CONSTRAINT "video_assets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_assets_tenant_idx" ON "video_assets" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_assets_provider_ref_uq" ON "video_assets" USING btree ("provider","provider_ref");--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_video_asset_id_video_assets_id_fk" FOREIGN KEY ("video_asset_id") REFERENCES "public"."video_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_source_exercise_id_exercises_id_fk" FOREIGN KEY ("source_exercise_id") REFERENCES "public"."exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercises_source_idx" ON "exercises" USING btree ("tenant_id","source_exercise_id");