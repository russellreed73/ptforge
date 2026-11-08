-- Step 5 security rules for clients. See 0001_row_level_security.sql for the helpers.

-- Clients can read their own profile but no longer edit it: coaches keep the
-- application and intake up to date (decided 2026-11-08).
DROP POLICY athlete_profiles_update ON "athlete_profiles";
CREATE POLICY athlete_profiles_update ON "athlete_profiles"
  FOR UPDATE TO ptforge_app
  USING (
    tenant_id = app_tenant_id()
    AND (
      app_sees_all_athletes()
      OR (app_has_role('trainer') AND EXISTS (
            SELECT 1 FROM "athlete_trainers" at
            WHERE at.athlete_profile_id = "athlete_profiles".id
              AND at.trainer_user_id = app_user_id()))
    )
  )
  WITH CHECK (tenant_id = app_tenant_id());
--> statement-breakpoint

-- New clients must be recorded as created by the person adding them.
DROP POLICY athlete_profiles_insert ON "athlete_profiles";
CREATE POLICY athlete_profiles_insert ON "athlete_profiles"
  FOR INSERT TO ptforge_app
  WITH CHECK (tenant_id = app_tenant_id() AND app_is_coach() AND created_by = app_user_id());
--> statement-breakpoint

-- A trainer who adds a client becomes that client's trainer. Trainers can't
-- assign athletes in general, so this narrow function does it for them: only
-- for a client they created themselves, in the current business, that has no
-- trainer yet.
CREATE OR REPLACE FUNCTION app_claim_new_athlete(profile_id uuid) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
  AS $$
BEGIN
  IF NOT app_has_role('trainer') THEN
    RETURN false;
  END IF;
  INSERT INTO athlete_trainers (tenant_id, athlete_profile_id, trainer_user_id, assigned_by)
  SELECT p.tenant_id, p.id, app_user_id(), app_user_id()
  FROM athlete_profiles p
  WHERE p.id = profile_id
    AND p.tenant_id = app_tenant_id()
    AND p.created_by = app_user_id()
    AND NOT EXISTS (SELECT 1 FROM athlete_trainers t WHERE t.athlete_profile_id = p.id);
  RETURN FOUND;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_claim_new_athlete(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_claim_new_athlete(uuid) TO ptforge_app;
--> statement-breakpoint

-- Detailed intake: visible to whoever can see the client (their coaches, all
-- coaches for admins/managers, and the client themselves); only coaches edit.
-- The EXISTS runs under athlete_profiles' own policy, so it inherits it.
ALTER TABLE "athlete_intakes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY athlete_intakes_select ON "athlete_intakes"
  FOR SELECT TO ptforge_app
  USING (
    tenant_id = app_tenant_id()
    AND EXISTS (SELECT 1 FROM "athlete_profiles" p WHERE p.id = "athlete_intakes".athlete_profile_id)
  );
--> statement-breakpoint
CREATE POLICY athlete_intakes_insert ON "athlete_intakes"
  FOR INSERT TO ptforge_app
  WITH CHECK (
    tenant_id = app_tenant_id()
    AND app_is_coach()
    AND EXISTS (
      SELECT 1 FROM "athlete_profiles" p
      WHERE p.id = "athlete_intakes".athlete_profile_id AND p.tenant_id = app_tenant_id())
  );
--> statement-breakpoint
CREATE POLICY athlete_intakes_update ON "athlete_intakes"
  FOR UPDATE TO ptforge_app
  USING (
    tenant_id = app_tenant_id()
    AND app_is_coach()
    AND EXISTS (SELECT 1 FROM "athlete_profiles" p WHERE p.id = "athlete_intakes".athlete_profile_id)
  )
  WITH CHECK (tenant_id = app_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "athlete_intakes" TO ptforge_app;
--> statement-breakpoint

-- Coaches see each other's unit choices like the existing preferred_unit.
GRANT SELECT (sbd_unit) ON "user" TO ptforge_app;
