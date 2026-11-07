/**
 * Available looks for PTForge. Each id matches a [data-theme] block in
 * src/app/globals.css. Later, each business picks one in Settings and its
 * pages use it; for now everything uses DEFAULT_THEME.
 */
export const THEMES = {
  "next-level": { name: "Next Level", description: "Dark, with red and teal (Jacob's brand)" },
  "ptforge-light": { name: "PTForge Light", description: "Clean and light" },
} as const;

export type ThemeId = keyof typeof THEMES;

export const DEFAULT_THEME: ThemeId = "next-level";

/** The theme a business uses. Reads organization metadata once Settings exists. */
export function themeForBusiness(metadata?: string | null): ThemeId {
  try {
    const theme = metadata ? (JSON.parse(metadata) as { theme?: string }).theme : undefined;
    if (theme && theme in THEMES) return theme as ThemeId;
  } catch {
    // ignore malformed metadata
  }
  return DEFAULT_THEME;
}
