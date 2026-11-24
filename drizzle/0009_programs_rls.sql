-- Program builder security rules.
--
-- Templates (athlete_profile_id NULL): every coach in the business can see and
-- edit them; athletes never see them.
-- Client blocks: visible to whoever can see that client (the EXISTS runs under
-- athlete_profiles' own policy), except that athletes only see blocks their
-- coach has assigned (not drafts). Only coaches create or change blocks.
-- Nothing is deleted: blocks and templates are archived.

ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY programs_select ON "programs"
  FOR SELECT TO ptforge_app
  USING (
    tenant_id = app_tenant_id()
    AND (
      (athlete_profile_id IS NULL AND app_is_coach())
      OR (
        athlete_profile_id IS NOT NULL
        AND (app_is_coach() OR status IN ('active', 'completed'))
        AND EXISTS (SELECT 1 FROM "athlete_profiles" p WHERE p.id = "programs".athlete_profile_id)
      )
    )
  );
--> statement-breakpoint
CREATE POLICY programs_insert ON "programs"
  FOR INSERT TO ptforge_app
  WITH CHECK (
    tenant_id = app_tenant_id()
    AND app_is_coach()
    AND created_by = app_user_id()
    AND (
      athlete_profile_id IS NULL
      OR EXISTS (SELECT 1 FROM "athlete_profiles" p
                 WHERE p.id = "programs".athlete_profile_id AND p.tenant_id = app_tenant_id())
    )
  );
--> statement-breakpoint
CREATE POLICY programs_update ON "programs"
  FOR UPDATE TO ptforge_app
  USING (
    tenant_id = app_tenant_id()
    AND app_is_coach()
    AND (
      athlete_profile_id IS NULL
      OR EXISTS (SELECT 1 FROM "athlete_profiles" p WHERE p.id = "programs".athlete_profile_id)
    )
  )
  WITH CHECK (
    tenant_id = app_tenant_id()
    AND (
      athlete_profile_id IS NULL
      OR EXISTS (SELECT 1 FROM "athlete_profiles" p WHERE p.id = "programs".athlete_profile_id)
    )
  );
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "programs" TO ptforge_app;
--> statement-breakpoint

-- One current block per client.
CREATE UNIQUE INDEX "programs_one_active_per_athlete"
  ON "programs" ("athlete_profile_id") WHERE status = 'active';
