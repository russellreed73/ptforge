/**
 * Web addresses Better Auth accepts sign-in and sign-up requests from.
 * Anything else gets "Invalid origin" (this blocks other websites from
 * submitting forms to PTForge on a visitor's behalf).
 *
 * Trusted:
 *   - BETTER_AUTH_URL (e.g. https://ptforge.app)
 *   - on Vercel, this deployment's own addresses: the production domain,
 *     the branch preview URL and the unique deployment URL (*.vercel.app)
 *   - TRUSTED_ORIGINS: extra comma-separated addresses, e.g. https://www.ptforge.app
 *   - in development, localhost and 127.0.0.1 on port 3000
 *
 * Only exact addresses are trusted, never wildcards like *.vercel.app, which
 * would include everyone else's Vercel sites.
 */
export function trustedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const origins = new Set<string>();
  const add = (value?: string) => {
    if (!value?.trim()) return;
    const url = value.includes("://") ? value.trim() : `https://${value.trim()}`;
    try {
      origins.add(new URL(url).origin);
    } catch {
      console.warn(`[auth] Ignoring invalid origin: ${value}`);
    }
  };

  add(env.BETTER_AUTH_URL);
  add(env.VERCEL_PROJECT_PRODUCTION_URL);
  add(env.VERCEL_BRANCH_URL);
  add(env.VERCEL_URL);
  for (const extra of (env.TRUSTED_ORIGINS ?? "").split(",")) add(extra);
  if (env.NODE_ENV !== "production") {
    add("http://localhost:3000");
    add("http://127.0.0.1:3000");
  }
  return [...origins];
}

/**
 * The app's own address, used in emailed links. BETTER_AUTH_URL wins; on
 * Vercel without it, previews use their branch URL and production its domain.
 */
export function appBaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  if (env.VERCEL_ENV === "preview" && env.VERCEL_BRANCH_URL)
    return `https://${env.VERCEL_BRANCH_URL}`;
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return undefined;
}
