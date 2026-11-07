/**
 * Proves the live Neon database is ready for PTForge:
 *   pnpm neon:check
 *
 * Read-only for real data: the tenant-isolation test creates throwaway rows
 * inside a transaction and rolls it back, so nothing is left behind.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { loadNeonEnv, redact } from "./neon-env";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.info(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const EXPECTED_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "organization",
  "member",
  "invitation",
  "two_factor",
  "athlete_profiles",
  "athlete_trainers",
  "exercises",
  "audit_logs",
];

async function main() {
  const { pooled, direct, branch } = loadNeonEnv();
  console.info(`Neon branch: ${branch}`);
  console.info(`Pooled (app):    ${redact(pooled)}`);
  console.info(`Direct (migrate): ${redact(direct)}\n`);

  // 1. Direct connection (used by migrations)
  const d = new Client({ connectionString: direct });
  await d.connect();
  const ver = await d.query(
    "select current_setting('server_version') as v, current_database() as db",
  );
  check("direct connection", true, `Postgres ${ver.rows[0].v}, database ${ver.rows[0].db}`);
  await d.end();

  // 2. Pooled connection (used by the app on Vercel)
  const c = new Client({ connectionString: pooled });
  await c.connect();
  const ssl = await c.query("select ssl from pg_stat_ssl where pid = pg_backend_pid()");
  check("pooled connection over TLS", ssl.rows[0]?.ssl === true);

  // 3. Migrations
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
    entries: unknown[];
  };
  const applied = await c
    .query("select count(*)::int as n from drizzle.__drizzle_migrations")
    .then((r) => r.rows[0].n as number)
    .catch(() => 0);
  check(
    "migrations up to date",
    applied === journal.entries.length,
    `${applied} of ${journal.entries.length}; run pnpm neon:migrate if behind`,
  );

  // 4. Tables and the RLS role
  const tables = await c.query(
    "select table_name from information_schema.tables where table_schema = 'public'",
  );
  const have = new Set(tables.rows.map((r) => r.table_name as string));
  const missing = EXPECTED_TABLES.filter((t) => !have.has(t));
  check(
    "all tables present",
    missing.length === 0,
    missing.length ? `missing: ${missing.join(", ")}` : `${EXPECTED_TABLES.length} tables`,
  );

  const role = await c.query(
    "select rolbypassrls, pg_has_role(current_user, 'ptforge_app', 'MEMBER') as member from pg_roles where rolname = 'ptforge_app'",
  );
  check(
    "ptforge_app role ready",
    role.rowCount === 1 && role.rows[0].rolbypassrls === false && role.rows[0].member === true,
  );

  // 5. Tenant isolation end to end, on the pooled connection, then rolled back
  if (missing.length === 0 && role.rowCount === 1) {
    await c.query("begin");
    try {
      const u = await c.query(
        `insert into "user" (name, email, email_verified) values
           ('Check Trainer', 'neon-check-a-${Date.now()}@example.invalid', true),
           ('Check Admin',   'neon-check-b-${Date.now()}@example.invalid', true)
         returning id`,
      );
      const [trainer, admin] = u.rows.map((r) => r.id as string);
      const o = await c.query(
        `insert into organization (name, slug, created_at) values
           ('Check One', 'neon-check-one-${Date.now()}', now()),
           ('Check Two', 'neon-check-two-${Date.now()}', now())
         returning id`,
      );
      const [t1, t2] = o.rows.map((r) => r.id as string);
      await c.query(
        `insert into member (organization_id, user_id, role, created_at) values
           ($1, $2, 'trainer', now()), ($3, $4, 'admin', now())`,
        [t1, trainer, t2, admin],
      );
      const a = await c.query(
        `insert into athlete_profiles (tenant_id, first_name, last_name, email) values
           ($1, 'Alpha', 'Assigned', 'alpha@example.invalid'),
           ($1, 'Bravo', 'Unassigned', 'bravo@example.invalid'),
           ($2, 'Charlie', 'OtherTenant', 'charlie@example.invalid')
         returning id`,
        [t1, t2],
      );
      await c.query(
        "insert into athlete_trainers (tenant_id, athlete_profile_id, trainer_user_id) values ($1, $2, $3)",
        [t1, a.rows[0].id, trainer],
      );

      // Exactly what withTenant() does for the trainer in tenant one
      await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), set_config('app.roles', 'trainer', true)",
        [t1, trainer],
      );
      await c.query("set local role ptforge_app");

      const seen = await c.query("select first_name from athlete_profiles order by first_name");
      const names = seen.rows.map((r) => r.first_name).join(",");
      check("trainer sees only assigned athlete", names === "Alpha", `saw: ${names || "nothing"}`);

      await c.query("savepoint s");
      const secret = await c.query("select 1 from session limit 1").then(
        () => "readable",
        (e: { code?: string }) => e.code,
      );
      await c.query("rollback to savepoint s");
      check("app role cannot read sessions", secret === "42501", `got ${secret}`);
    } finally {
      await c.query("rollback");
    }
    const leftover = await c.query(
      "select count(*)::int as n from organization where slug like 'neon-check-%'",
    );
    check("test rows rolled back", leftover.rows[0].n === 0);
  } else {
    check("tenant isolation", false, "skipped: run pnpm neon:migrate first");
  }

  await c.end();
  console.info(failures === 0 ? "\nAll Neon checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FAIL ", err.message ?? err);
  process.exit(1);
});
