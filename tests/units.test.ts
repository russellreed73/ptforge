import { describe, expect, it } from "vitest";
import { formatWeight, fromKg, parseWeight, roundToStep, toKg } from "@/lib/units";

describe("units", () => {
  it("round-trips 225 lb exactly through kg storage", () => {
    const kg = toKg(225, "lb");
    expect(kg).toBe(102.058);
    expect(formatWeight(kg, "lb")).toBe("225 lb");
  });

  it("formats kg and lb", () => {
    expect(formatWeight(102.5, "kg")).toBe("102.5 kg");
    expect(formatWeight(100, "kg")).toBe("100 kg");
    expect(formatWeight(100, "lb")).toBe("220.5 lb");
    expect(formatWeight(null, "kg")).toBe("—");
  });

  it("converts", () => {
    expect(fromKg(100, "kg")).toBe(100);
    expect(fromKg(45.359237, "lb")).toBeCloseTo(100, 10);
  });

  it("rounds to loadable plates", () => {
    expect(roundToStep(101, "kg")).toBe(100);
    expect(roundToStep(101.3, "kg")).toBe(102.5);
    expect(roundToStep(101.3, "kg", 1.25)).toBe(101.25);
    expect(roundToStep(223, "lb")).toBe(225);
  });

  it("parses typed weights", () => {
    expect(parseWeight("102,5", "kg")).toBe(102.5);
    expect(parseWeight("225", "lb")).toBe(102.058);
    expect(parseWeight("abc", "kg")).toBeNull();
    expect(parseWeight("-5", "kg")).toBeNull();
  });
});
