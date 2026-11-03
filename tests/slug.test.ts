import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("makes URL-safe business slugs", () => {
    expect(slugify("Jacob's Strength Co.")).toBe("jacobs-strength-co");
    expect(slugify("  Équipe Force  ")).toBe("equipe-force");
  });
});
