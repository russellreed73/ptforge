-- PTForge tenant isolation: Row-Level Security.
--
-- How it works
--   * The app connects as the database OWNER. RLS is enabled but not forced,
--     so the owner (Better Auth, migrations, seed) is not filtered.
--   * withTenant() (src/server/db/tenant.ts) opens a transaction, sets
--     app.tenant_id / app.user_id / app.roles, then SET LOCAL ROLE ptforge_app.
--     Every query inside it is filtered by the policies below.
--   * ptforge_app has no access at all to sessions, passwords, invitations or
--     2FA secrets, and only a few columns of "user".
--   * No tenant set = no rows. Forgetting withTenant() fails closed.
--
-- New tenant table checklist: tenant_id NOT NULL, ENABLE RLS, policies, GRANT.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ptforge_app') THEN
    CREATE ROLE ptforge_app NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
GRANT ptforge_app TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO ptforge_app;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Request context helpers (values set by withTenant)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
-- app.roles holds the member's tenant roles, comma separated: "manager,trainer"
CREATE OR REPLACE FUNCTION app_has_role(role_name text) RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT role_name = ANY (string_to_array(coalesce(current_setting('app.roles', true), ''), ',')) $$;
--> statement-breakpoint
-- Administrators and managers see every athlete in the tenant.
CREATE OR REPLACE FUNCTION app_sees_all_athletes() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT app_has_role('admin') OR app_has_role('manager') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_coach() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT app_has_role('admin') OR app_has_role('manager') OR app_has_role('trainer') $$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_tenant_id(), app_user_id(), app_has_role(text),
  app_sees_all_athletes(), app_is_coach() TO ptforge_app;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Better Auth tables the app may read (owner connection is unaffected)
-- ---------------------------------------------------------------------------
ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_current_tenant ON "organization"
  FOR SELECT TO ptforge_app
  USING (id = app_tenant_id());
--> statement-breakpoint
GRANT SELECT ON "organization" TO ptforge_app;
--> statement-breakpoint

ALTER TABLE "member" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY member_current_tenant ON "member"
  FOR SELECT TO ptforge_app
  USING (organization_id = app_tenant_id());
--> statement-breakpoint
GRANT SELECT ON "member" TO ptforge_app;
--> statement-breakpoint

ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Only people who belong to the current tenant, and only harmless columns.
CREATE POLICY user_in_current_tenant ON "user"
  FOR SELECT TO ptforge_app
  USING (EXISTS (
    SELECT 1 FROM "member" m
    WHERE m.user_id = "user".id AND m.organization_id = app_tenant_id()
  ));
--> statement-breakpoint
GRANT SELECT (id, name, email, image, preferred_unit) ON "user" TO ptforge_app;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- athlete_trainers: who coaches whom
-- (must not reference athlete_profiles, or the two policies would recurse)
-- ---------------------------------------------------------------------------
ALTER TABLE "athlete_trainers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY athlete_trainers_select ON "athlete_trainers"
  FOR SELECT TO ptforge_app
  USING (tenant_id = app_tenant_id()
         AND (app_sees_all_athletes() OR trainer_user_id = app_user_id()));
--> statement-breakpoint
CREATE POLICY athlete_trainers_insert ON "athlete_trainers"
  FOR INSERT TO ptforge_app
  WITH CHECK (tenant_id = app_tenant_id() AND app_sees_all_athletes());
--> statement-breakpoint
CREATE POLICY athlete_trainers_delete ON "athlete_trainers"
  FOR DELETE TO ptforge_app
  USING (tenant_id = app_tenant_id() AND app_sees_all_athletes());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "athlete_trainers" TO ptforge_app;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- athlete_profiles: admins/managers see all, trainers see assigned,
-- athletes see themselves
-- ---------------------------------------------------------------------------
ALTER TABLE "athlete_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY athlete_profiles_select ON "athlete_profiles"
  FOR SELECT TO ptforge_app
  USING (
    tenant_id = app_tenant_id()
    AND (
      app_sees_all_athletes()
      OR user_id = app_user_id()
      OR (app_has_role('trainer') AND EXISTS (
            SELECT 1 FROM "athlete_trainers" at
            WHERE at.athlete_profile_id = "athlete_profiles".id
              AND at.trainer_user_id = app_user_id()))
    )
  );
--> statement-breakpoint
CREATE POLICY athlete_profiles_insert ON "athlete_profiles"
  FOR INSERT TO ptforge_app
  WITH CHECK (tenant_id = app_tenant_id() AND app_is_coach());
--> statement-breakpoint
CREATE POLICY athlete_profiles_update ON "athlete_profiles"
  FOR UPDATE TO ptforge_app
  USING (
    tenant_id = app_tenant_id()
    AND (
      app_sees_all_athletes()
      OR user_id = app_user_id()
      OR (app_has_role('trainer') AND EXISTS (
            SELECT 1 FROM "athlete_trainers" at
            WHERE at.athlete_profile_id = "athlete_profiles".id
              AND at.trainer_user_id = app_user_id()))
    )
  )
  WITH CHECK (tenant_id = app_tenant_id());
--> statement-breakpoint
CREATE POLICY athlete_profiles_delete ON "athlete_profiles"
  FOR DELETE TO ptforge_app
  USING (tenant_id = app_tenant_id() AND app_has_role('admin'));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "athlete_profiles" TO ptforge_app;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- exercises: shared library (tenant_id NULL) is read-only to tenants
-- ---------------------------------------------------------------------------
ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY exercises_select ON "exercises"
  FOR SELECT TO ptforge_app
  USING (tenant_id IS NULL OR tenant_id = app_tenant_id());
--> statement-breakpoint
CREATE POLICY exercises_insert ON "exercises"
  FOR INSERT TO ptforge_app
  WITH CHECK (tenant_id = app_tenant_id() AND app_is_coach());
--> statement-breakpoint
CREATE POLICY exercises_update ON "exercises"
  FOR UPDATE TO ptforge_app
  USING (tenant_id = app_tenant_id() AND app_is_coach())
  WITH CHECK (tenant_id = app_tenant_id());
--> statement-breakpoint
CREATE POLICY exercises_delete ON "exercises"
  FOR DELETE TO ptforge_app
  USING (tenant_id = app_tenant_id() AND app_is_coach());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "exercises" TO ptforge_app;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- audit_logs: anyone may write their own entries; administrators read them
-- ---------------------------------------------------------------------------
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY audit_logs_insert ON "audit_logs"
  FOR INSERT TO ptforge_app
  WITH CHECK (tenant_id = app_tenant_id() AND actor_user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY audit_logs_select ON "audit_logs"
  FOR SELECT TO ptforge_app
  USING (tenant_id = app_tenant_id() AND app_has_role('admin'));
--> statement-breakpoint
GRANT SELECT, INSERT ON "audit_logs" TO ptforge_app;
