import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Policies live in hand-written SQL migrations. Never use `drizzle-kit push`
  // on this project: it doesn't know about them. Use db:generate + db:migrate.
  strict: true,
  verbose: true,
});
