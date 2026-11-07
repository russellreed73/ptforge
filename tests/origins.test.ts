import { describe, expect, it } from "vitest";
import { appBaseUrl, trustedOrigins } from "@/server/auth/origins";

describe("trustedOrigins()", () => {
  it("trusts the configured URL and this Vercel deployment's own addresses", () => {
    const origins = trustedOrigins({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://ptforge.app",
      VERCEL_PROJECT_PRODUCTION_URL: "ptforge.app",
      VERCEL_BRANCH_URL: "ptforge-git-main-russell.vercel.app",
      VERCEL_URL: "ptforge-abc123-russell.vercel.app",
      TRUSTED_ORIGINS: "https://www.ptforge.app, https://ptforge.fit",
    } as never);
    expect(origins).toEqual([
      "https://ptforge.app",
      "https://ptforge-git-main-russell.vercel.app",
      "https://ptforge-abc123-russell.vercel.app",
      "https://www.ptforge.app",
      "https://ptforge.fit",
    ]);
  });

  it("never trusts localhost in production or wildcard Vercel domains", () => {
    const origins = trustedOrigins({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://ptforge.app",
    } as never);
    expect(origins).toEqual(["https://ptforge.app"]);
  });

  it("trusts localhost and 127.0.0.1 in development", () => {
    expect(trustedOrigins({ NODE_ENV: "development" } as never)).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });
});

describe("appBaseUrl()", () => {
  it("prefers BETTER_AUTH_URL", () => {
    expect(
      appBaseUrl({
        BETTER_AUTH_URL: "https://ptforge.app",
        VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app",
      } as never),
    ).toBe("https://ptforge.app");
  });
  it("uses the branch URL on preview deployments", () => {
    expect(
      appBaseUrl({
        VERCEL_ENV: "preview",
        VERCEL_BRANCH_URL: "ptforge-git-x.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL: "ptforge.app",
      } as never),
    ).toBe("https://ptforge-git-x.vercel.app");
  });
  it("falls back to the production domain", () => {
    expect(
      appBaseUrl({
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "ptforge.app",
      } as never),
    ).toBe("https://ptforge.app");
  });
});
