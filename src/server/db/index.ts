// Server code only. (No `import "server-only"` here so the seed script and
// tests can use it too; pages reach it through src/server/auth/session.ts,
// which is marked server-only.)
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { pool?: Pool };
const pool = globalForDb.pool ?? new Pool({ connectionString, max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

/**
 * The OWNER connection. Row-Level Security does not apply to it.
 *
 * Use it only for: Better Auth (sign-in, sessions, invitations), migrations,
 * seeding, and looking up which tenants a user belongs to.
 *
 * All tenant data (athletes, exercises, programs, workouts...) must go through
 * `withTenant()` in ./tenant.ts instead.
 */
export const db = drizzle(pool, { schema });
export type Db = typeof db;
