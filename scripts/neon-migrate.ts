/**
 * Applies the migrations in ./drizzle to the live Neon database:
 *   pnpm neon:migrate
 *
 * Uses the direct (unpooled) connection, which migrations need.
 * Never seeds: production gets real data only.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { loadNeonEnv, redact } from "./neon-env";

async function main() {
  const { direct, branch } = loadNeonEnv();
  console.info(`Migrating Neon branch ${branch} via ${redact(direct)}`);
  const pool = new Pool({ connectionString: direct, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    const { rows } = await pool.query(
      "select count(*)::int as n from drizzle.__drizzle_migrations",
    );
    console.info(`Done. ${rows[0].n} migrations applied in total.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
