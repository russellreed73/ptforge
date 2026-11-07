import { isUnit, type Unit } from "./units";

/**
 * Available looks for PTForge. Each id matches a [data-theme] block in
 * src/app/globals.css; `background` and `primary` repeat two of its colours
 * for places CSS can't reach (phone app icons, the web app manifest).
 * A business picks its theme in Settings.
 */
export const THEMES = {
  "next-level": {
    name: "Next Level",
    description: "Dark, with red and teal (Jacob's brand)",
    background: "#0a0a0a",
    surface: "#161616",
    primary: "#e8171a",
    accent: "#14b8a6",
    foreground: "#f5f0eb",
  },
  "ptforge-light": {
    name: "PTForge Light",
    description: "Clean and light",
    background: "#ffffff",
    surface: "#f8fafc",
    primary: "#0f172a",
    accent: "#0d9488",
    foreground: "#0f172a",
  },
} as const;

export type ThemeId = keyof typeof THEMES;

export const DEFAULT_THEME: ThemeId = "next-level";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in THEMES;
}

/** A business's settings, stored as JSON in organization.metadata. */
export type BusinessMetadata = { theme: ThemeId; defaultUnit: Unit };

export function readBusinessMetadata(metadata?: string | null): BusinessMetadata {
  let raw: Record<string, unknown> = {};
  try {
    raw = metadata ? (JSON.parse(metadata) as Record<string, unknown>) : {};
  } catch {
    // ignore malformed metadata
  }
  return {
    theme: isThemeId(raw.theme) ? raw.theme : DEFAULT_THEME,
    defaultUnit: isUnit(raw.defaultUnit) ? raw.defaultUnit : "kg",
  };
}

/** The theme a business uses. */
export function themeForBusiness(metadata?: string | null): ThemeId {
  return readBusinessMetadata(metadata).theme;
}
