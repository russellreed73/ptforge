import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

if (existsSync(".env.local")) config({ path: ".env.local", quiet: true });

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Database tests share one database; run files one at a time.
    fileParallelism: false,
  },
});
