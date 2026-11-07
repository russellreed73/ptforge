import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEMES, themeForBusiness } from "@/lib/themes";

describe("themes", () => {
  it("defaults to Jacob's Next Level theme", () => {
    expect(DEFAULT_THEME).toBe("next-level");
    expect(themeForBusiness(null)).toBe("next-level");
    expect(themeForBusiness("not json")).toBe("next-level");
    expect(themeForBusiness(JSON.stringify({ theme: "unknown" }))).toBe("next-level");
  });

  it("uses a business's chosen theme", () => {
    expect(themeForBusiness(JSON.stringify({ theme: "ptforge-light" }))).toBe("ptforge-light");
  });

  it("every registered theme has its colours defined in globals.css", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    for (const id of Object.keys(THEMES)) {
      expect(css).toContain(`[data-theme="${id}"]`);
    }
  });
});
