/**
 * Wipes the LOCAL database so `pnpm db:reset` can rebuild it from scratch.
 * Refuses to run against anything that isn't localhost.
 */
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "postgres"].includes(host)) {
  throw new Error(`Refusing to reset a non-local database (${host}).`);
}

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(`
    DROP SCHEMA IF EXISTS drizzle CASCADE;
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
  `);
  await client.end();
  console.info("Local database wiped.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
