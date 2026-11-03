/** "Jacob's Strength Co." → "jacobs-strength-co" (used in ptforge.app/<slug>) */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
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
  "accept-invite",
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
