import { describe, expect, it } from "vitest";
import { normalizeDatabaseUrl } from "@/server/db/url";

describe("normalizeDatabaseUrl", () => {
  it("upgrades Neon's sslmode=require to verify-full and keeps other options", () => {
    expect(
      normalizeDatabaseUrl(
        "postgresql://u:p@ep-x-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
      ),
    ).toBe(
      "postgresql://u:p@ep-x-pooler.us-east-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require",
    );
  });
  it("leaves local URLs alone", () => {
    expect(normalizeDatabaseUrl("postgres://ptforge:ptforge@localhost:5432/ptforge")).toBe(
      "postgres://ptforge:ptforge@localhost:5432/ptforge",
    );
  });
});
