-- Step 6: exercise library security rules and PTForge's starter exercises.

-- Uploaded demo videos: everyone in the business can watch (athletes too);
-- only coaches add or change them.
ALTER TABLE "video_assets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY video_assets_select ON "video_assets"
  FOR SELECT TO ptforge_app
  USING (tenant_id = app_tenant_id());
--> statement-breakpoint
CREATE POLICY video_assets_insert ON "video_assets"
  FOR INSERT TO ptforge_app
  WITH CHECK (tenant_id = app_tenant_id() AND app_is_coach() AND created_by = app_user_id());
--> statement-breakpoint
CREATE POLICY video_assets_update ON "video_assets"
  FOR UPDATE TO ptforge_app
  USING (tenant_id = app_tenant_id() AND app_is_coach())
  WITH CHECK (tenant_id = app_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "video_assets" TO ptforge_app;
--> statement-breakpoint

-- A business's exercises may only use that business's own uploaded videos,
-- and nobody deletes exercises (they're archived, so programs keep working).
DROP POLICY exercises_insert ON "exercises";
--> statement-breakpoint
CREATE POLICY exercises_insert ON "exercises"
  FOR INSERT TO ptforge_app
  WITH CHECK (
    tenant_id = app_tenant_id() AND app_is_coach()
    AND (video_asset_id IS NULL OR EXISTS (
      SELECT 1 FROM "video_assets" v WHERE v.id = video_asset_id AND v.tenant_id = app_tenant_id()))
  );
--> statement-breakpoint
DROP POLICY exercises_update ON "exercises";
--> statement-breakpoint
CREATE POLICY exercises_update ON "exercises"
  FOR UPDATE TO ptforge_app
  USING (tenant_id = app_tenant_id() AND app_is_coach())
  WITH CHECK (
    tenant_id = app_tenant_id()
    AND (video_asset_id IS NULL OR EXISTS (
      SELECT 1 FROM "video_assets" v WHERE v.id = video_asset_id AND v.tenant_id = app_tenant_id()))
  );
--> statement-breakpoint
DROP POLICY exercises_delete ON "exercises";
--> statement-breakpoint
REVOKE DELETE ON "exercises" FROM ptforge_app;
--> statement-breakpoint

-- PTForge's shared starter library (tenant_id NULL). Skips any name that's
-- already there, so it is safe on databases that already have some.
INSERT INTO "exercises" (name, primary_muscles, category, equipment, movement, tags, cues, is_competition_lift)
SELECT v.* FROM (VALUES
  ('Competition Squat', ARRAY['Quads']::text[], 'Squat', 'Barbell', 'Compound', ARRAY['squat','quads','glutes','competition','barbell','sbd']::text[], 'Brace hard, knees track over toes, chest proud.', true),
  ('Competition Bench Press', ARRAY['Chest']::text[], 'Bench', 'Barbell', 'Compound', ARRAY['bench','chest','triceps','competition','barbell','sbd']::text[], 'Feet planted, tight upper back, pause on the chest.', true),
  ('Competition Deadlift', ARRAY['Posterior chain']::text[], 'Deadlift', 'Barbell', 'Compound', ARRAY['deadlift','glutes','hamstrings','back','competition','barbell','sbd']::text[], 'Push the floor away, lats on, lock out tall.', true),
  ('Sumo Deadlift', ARRAY['Posterior chain']::text[], 'Deadlift', 'Barbell', 'Compound', ARRAY['deadlift','sumo','glutes','adductors','barbell']::text[], 'Spread the floor, hips close to the bar.', false),
  ('Pause Squat', ARRAY['Quads']::text[], 'Squat', 'Barbell', 'Compound', ARRAY['squat','quads','pause','barbell']::text[], 'Stay tight in the hole for the full pause.', false),
  ('Tempo Squat', ARRAY['Quads']::text[], 'Squat', 'Barbell', 'Compound', ARRAY['squat','quads','tempo','barbell']::text[], 'Control the descent at the set tempo.', false),
  ('Pin Squat', ARRAY['Quads']::text[], 'Squat', 'Barbell', 'Compound', ARRAY['squat','quads','pins','barbell']::text[], 'Settle on the pins without losing brace.', false),
  ('High-Bar Squat', ARRAY['Quads']::text[], 'Squat accessory', 'Barbell', 'Compound', ARRAY['squat','quads','barbell']::text[], 'Upright torso, knees forward.', false),
  ('Front Squat', ARRAY['Quads']::text[], 'Squat accessory', 'Barbell', 'Compound', ARRAY['squat','quads','upper back','barbell']::text[], 'Elbows high, stay upright.', false),
  ('Safety Bar Squat', ARRAY['Quads']::text[], 'Squat accessory', 'Specialty bar', 'Compound', ARRAY['squat','quads','upper back','specialty bar']::text[], 'Push the head back into the pad.', false),
  ('Belt Squat', ARRAY['Quads']::text[], 'Squat accessory', 'Machine', 'Compound', ARRAY['squat','quads','glutes','machine','back friendly']::text[], NULL, false),
  ('Leg Press', ARRAY['Quads']::text[], 'Squat accessory', 'Machine', 'Compound', ARRAY['quads','glutes','machine']::text[], 'Full range without the hips rolling up.', false),
  ('Hack Squat', ARRAY['Quads']::text[], 'Squat accessory', 'Machine', 'Compound', ARRAY['quads','machine']::text[], NULL, false),
  ('Leg Extension', ARRAY['Quads']::text[], 'Squat accessory', 'Machine', 'Isolation', ARRAY['quads','machine','isolation']::text[], '3 second lowering.', false),
  ('Bulgarian Split Squat', ARRAY['Quads']::text[], 'Single leg', 'Dumbbell', 'Single leg', ARRAY['quads','glutes','single leg','dumbbell']::text[], 'Most of the weight through the front foot.', false),
  ('Walking Lunge', ARRAY['Quads']::text[], 'Single leg', 'Dumbbell', 'Single leg', ARRAY['quads','glutes','single leg','dumbbell']::text[], NULL, false),
  ('Step-up', ARRAY['Quads']::text[], 'Single leg', 'Dumbbell', 'Single leg', ARRAY['quads','glutes','single leg','knee friendly']::text[], 'Drive through the whole foot on the box.', false),
  ('Pause Bench Press', ARRAY['Chest']::text[], 'Bench', 'Barbell', 'Compound', ARRAY['bench','chest','pause','barbell']::text[], 'Long, still pause on the chest.', false),
  ('Close-Grip Bench Press', ARRAY['Triceps']::text[], 'Bench accessory', 'Barbell', 'Compound', ARRAY['bench','triceps','chest','barbell']::text[], 'Elbows tucked, touch slightly lower.', false),
  ('Spoto Press', ARRAY['Chest']::text[], 'Bench accessory', 'Barbell', 'Compound', ARRAY['bench','chest','pause','barbell']::text[], 'Stop an inch off the chest, stay tight.', false),
  ('Larsen Press', ARRAY['Chest']::text[], 'Bench accessory', 'Barbell', 'Compound', ARRAY['bench','chest','barbell']::text[], 'Legs off the floor, no leg drive.', false),
  ('Incline Bench Press', ARRAY['Chest']::text[], 'Bench accessory', 'Barbell', 'Compound', ARRAY['bench','chest','shoulders','incline','barbell']::text[], NULL, false),
  ('Dumbbell Bench Press', ARRAY['Chest']::text[], 'Bench accessory', 'Dumbbell', 'Compound', ARRAY['chest','triceps','dumbbell']::text[], NULL, false),
  ('Dip', ARRAY['Triceps']::text[], 'Bench accessory', 'Bodyweight', 'Compound', ARRAY['triceps','chest','bodyweight']::text[], NULL, false),
  ('Overhead Press', ARRAY['Shoulders']::text[], 'Shoulders', 'Barbell', 'Compound', ARRAY['shoulders','triceps','press','barbell']::text[], 'Squeeze glutes, head through at the top.', false),
  ('Dumbbell Shoulder Press', ARRAY['Shoulders']::text[], 'Shoulders', 'Dumbbell', 'Compound', ARRAY['shoulders','triceps','press','dumbbell']::text[], NULL, false),
  ('Lateral Raise', ARRAY['Shoulders']::text[], 'Shoulders', 'Dumbbell', 'Isolation', ARRAY['shoulders','side delts','dumbbell','isolation']::text[], 'Lead with the elbows.', false),
  ('Face Pull', ARRAY['Upper back']::text[], 'Shoulders', 'Cable', 'Isolation', ARRAY['rear delts','upper back','shoulder health','cable']::text[], 'Pull to the eyes, thumbs back.', false),
  ('Deficit Deadlift', ARRAY['Posterior chain']::text[], 'Deadlift', 'Barbell', 'Compound', ARRAY['deadlift','deficit','glutes','hamstrings','barbell']::text[], 'Same start position, just lower.', false),
  ('Paused Deadlift', ARRAY['Posterior chain']::text[], 'Deadlift', 'Barbell', 'Compound', ARRAY['deadlift','pause','barbell']::text[], 'Pause just below the knee, stay over the bar.', false),
  ('Block Pull', ARRAY['Posterior chain']::text[], 'Deadlift accessory', 'Barbell', 'Compound', ARRAY['deadlift','lockout','blocks','barbell']::text[], NULL, false),
  ('Romanian Deadlift', ARRAY['Hamstrings']::text[], 'Deadlift accessory', 'Barbell', 'Hinge', ARRAY['deadlift','hamstrings','glutes','hinge','barbell']::text[], 'Soft knees, hips back, bar close to the legs.', false),
  ('Stiff-Leg Deadlift', ARRAY['Hamstrings']::text[], 'Deadlift accessory', 'Barbell', 'Hinge', ARRAY['hamstrings','glutes','hinge','barbell']::text[], NULL, false),
  ('Good Morning', ARRAY['Hamstrings']::text[], 'Deadlift accessory', 'Barbell', 'Hinge', ARRAY['hamstrings','back','hinge','barbell']::text[], NULL, false),
  ('Hip Thrust', ARRAY['Glutes']::text[], 'Deadlift accessory', 'Barbell', 'Isolation', ARRAY['glutes','barbell']::text[], 'Chin tucked, ribs down at the top.', false),
  ('Back Extension', ARRAY['Lower back']::text[], 'Deadlift accessory', 'Bodyweight', 'Hinge', ARRAY['back','glutes','hamstrings','hinge']::text[], NULL, false),
  ('Seated Hamstring Curl', ARRAY['Hamstrings']::text[], 'Deadlift accessory', 'Machine', 'Isolation', ARRAY['hamstrings','machine','isolation']::text[], NULL, false),
  ('Lying Hamstring Curl', ARRAY['Hamstrings']::text[], 'Deadlift accessory', 'Machine', 'Isolation', ARRAY['hamstrings','machine','isolation']::text[], NULL, false),
  ('Pull-up', ARRAY['Back']::text[], 'Back', 'Bodyweight', 'Compound', ARRAY['back','lats','vertical pull','bodyweight']::text[], 'Full hang to chin over the bar.', false),
  ('Lat Pulldown', ARRAY['Back']::text[], 'Back', 'Cable', 'Compound', ARRAY['back','lats','vertical pull','cable']::text[], 'Chest up, drive the elbows down.', false),
  ('Barbell Row', ARRAY['Back']::text[], 'Back', 'Barbell', 'Compound', ARRAY['back','lats','row','barbell']::text[], NULL, false),
  ('Chest-Supported Row', ARRAY['Back']::text[], 'Back', 'Dumbbell', 'Compound', ARRAY['back','lats','row','dumbbell']::text[], NULL, false),
  ('Seated Cable Row', ARRAY['Back']::text[], 'Back', 'Cable', 'Compound', ARRAY['back','lats','row','cable']::text[], NULL, false),
  ('One-Arm Dumbbell Row', ARRAY['Back']::text[], 'Back', 'Dumbbell', 'Compound', ARRAY['back','lats','row','dumbbell','single arm']::text[], NULL, false),
  ('Dumbbell Biceps Curl', ARRAY['Biceps']::text[], 'Arms', 'Dumbbell', 'Isolation', ARRAY['biceps','arms','curl','dumbbell']::text[], 'Elbows pinned, no swing.', false),
  ('Hammer Curl', ARRAY['Biceps']::text[], 'Arms', 'Dumbbell', 'Isolation', ARRAY['biceps','brachialis','arms','curl','dumbbell']::text[], NULL, false),
  ('Triceps Pushdown', ARRAY['Triceps']::text[], 'Arms', 'Cable', 'Isolation', ARRAY['triceps','arms','cable']::text[], NULL, false),
  ('Overhead Triceps Extension', ARRAY['Triceps']::text[], 'Arms', 'Cable', 'Isolation', ARRAY['triceps','arms','cable']::text[], NULL, false),
  ('Plank', ARRAY['Core']::text[], 'Core', 'Bodyweight', 'Isometric', ARRAY['core','abs','bodyweight']::text[], 'Ribs down, squeeze glutes.', false),
  ('Hanging Leg Raise', ARRAY['Core']::text[], 'Core', 'Bodyweight', 'Isolation', ARRAY['core','abs','bodyweight']::text[], NULL, false),
  ('Ab Wheel Rollout', ARRAY['Core']::text[], 'Core', 'Ab wheel', 'Isolation', ARRAY['core','abs']::text[], NULL, false),
  ('Pallof Press', ARRAY['Core']::text[], 'Core', 'Cable', 'Isometric', ARRAY['core','anti-rotation','cable']::text[], NULL, false),
  ('Dowel Complex', ARRAY['Full body']::text[], 'Warmup', 'Dowel', 'Mobility', ARRAY['warmup','mobility','pre']::text[], NULL, false),
  ('Hip CARs', ARRAY['Hips']::text[], 'Warmup', 'Bodyweight', 'Mobility', ARRAY['warmup','mobility','hips','pre']::text[], NULL, false),
  ('90-90 Hip Switch', ARRAY['Hips']::text[], 'Warmup', 'Bodyweight', 'Mobility', ARRAY['warmup','mobility','hips','internal rotation','pre']::text[], NULL, false),
  ('Ankle Dorsiflexion Mobilization', ARRAY['Ankles']::text[], 'Warmup', 'Band', 'Mobility', ARRAY['warmup','mobility','ankles','pre']::text[], NULL, false),
  ('Band Pull-Apart', ARRAY['Upper back']::text[], 'Warmup', 'Band', 'Mobility', ARRAY['warmup','upper back','shoulder health','band','pre']::text[], NULL, false)
) AS v(name, primary_muscles, category, equipment, movement, tags, cues, is_competition_lift)
WHERE NOT EXISTS (
  SELECT 1 FROM "exercises" e WHERE e.tenant_id IS NULL AND lower(e.name) = lower(v.name)
);
