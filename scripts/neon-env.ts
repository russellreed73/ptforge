/**
 * Loads the live Neon connection strings from `.env.neon` (written by
 * `neon env pull --file .env.neon`). Kept separate from `.env.local` so local
 * development, seeding and tests can never touch the production database.
 *
 * Note: not `.env.production.local`, which Next.js would load automatically
 * during `pnpm build` / `pnpm start` on your computer.
 */
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { normalizeDatabaseUrl } from "../src/server/db/url";

export function loadNeonEnv(file = ".env.neon") {
  if (!existsSync(file)) {
    throw new Error(
      `${file} not found. Run: neon env pull --file ${file}   (see README section 5)`,
    );
  }
  const env = parse(readFileSync(file));
  const pooled = env.DATABASE_URL;
  const direct = env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL;
  if (!pooled || !direct) throw new Error(`${file} has no DATABASE_URL.`);
  return {
    pooled: normalizeDatabaseUrl(pooled),
    direct: normalizeDatabaseUrl(direct),
    branch: env.NEON_BRANCH ?? "(unknown)",
  };
}

/** user:password@host → user:***@host, for printing. */
export function redact(url: string) {
  return url.replace(/\/\/([^:/]+):[^@]+@/, "//$1:***@");
}
