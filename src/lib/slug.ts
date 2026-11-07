/** "Jacob's Strength Co." → "jacobs-strength-co" (used in ptforge.app/<slug>) */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Slugs that would clash with app routes. */
export const RESERVED_SLUGS = new Set([
  "api",
  "sign-in",
  "sign-up",
  "welcome",
  "forgot-password",
  "reset-password",
  "accept-invite",
  "account",
  "brand",
  "embed",
  "two-factor",
  "admin",
  "app",
  "settings",
  "_next",
  "static",
  "public",
  "www",
  "help",
  "support",
  "pricing",
  "about",
]);
