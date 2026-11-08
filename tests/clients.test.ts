import { describe, expect, it } from "vitest";
import {
  applicationSchema,
  cmToFeetInches,
  DEFAULT_SERVICES,
  feetInchesToCm,
  formatHeight,
  intakeSchema,
  missingApplyAnswers,
  normalizeInstagram,
  readApplyFormSettings,
  readServices,
} from "@/lib/clients";

const full = {
  firstName: "Riley",
  lastName: "Santos",
  email: "Riley@Example.com ",
  pronouns: "he / him",
  sex: "male",
  country: "Canada",
  region: "Ontario",
  city: "Oakville",
  instagram: "",
  serviceType: "Online coaching",
  coachPreference: "unsure",
  coachQualities: "Honest feedback",
  goals: "Deadlift 250",
  heardAbout: "Instagram",
  funFact: "Keeps bees",
};

describe("Apply answers", () => {
  it("cleans up input", () => {
    const a = applicationSchema.parse(full);
    expect(a.email).toBe("riley@example.com");
    expect(a.instagram).toBeNull();
  });

  it("requires every shown question except Instagram on the public form", () => {
    const a = applicationSchema.parse(full);
    expect(missingApplyAnswers(a, [], { askCoach: true })).toBeNull();
    const noFact = applicationSchema.parse({ ...full, funFact: "" });
    expect(missingApplyAnswers(noFact, [], { askCoach: true })).toMatch(/fun fact/);
    expect(missingApplyAnswers(noFact, ["funFact"], { askCoach: true })).toBeNull();
    const noCity = applicationSchema.parse({ ...full, city: "" });
    expect(missingApplyAnswers(noCity, [], { askCoach: true })).toMatch(/city/);
  });

  it("only asks for a coach when there's a choice", () => {
    const a = applicationSchema.parse({ ...full, coachPreference: "" });
    expect(missingApplyAnswers(a, [], { askCoach: true })).toMatch(/coach with/);
    expect(missingApplyAnswers(a, [], { askCoach: false })).toBeNull();
  });

  it("always needs email, service and goals", () => {
    expect(
      missingApplyAnswers(applicationSchema.parse({ ...full, email: "" }), [], { askCoach: false }),
    ).toMatch(/email/);
    expect(
      missingApplyAnswers(applicationSchema.parse({ ...full, serviceType: "" }), [], {
        askCoach: false,
      }),
    ).toMatch(/service/);
  });

  it("rejects a bad email and an unknown sex", () => {
    expect(applicationSchema.safeParse({ ...full, email: "nope" }).success).toBe(false);
    expect(applicationSchema.safeParse({ ...full, sex: "robot" }).success).toBe(false);
  });
});

describe("normalizeInstagram", () => {
  it.each([
    ["@Riley.Lifts", "@riley.lifts"],
    ["riley_lifts", "@riley_lifts"],
    ["instagram.com/Riley.Lifts/", "@riley.lifts"],
    ["https://www.instagram.com/riley.lifts?igsh=abc", "@riley.lifts"],
    ["not a handle!", null],
    ["", null],
  ])("%s → %s", (input, expected) => {
    expect(normalizeInstagram(input)).toBe(expected);
  });
});

describe("intake", () => {
  it("accepts blanks and numbers as strings", () => {
    const i = intakeSchema.parse({ stressLevel: "5", trainingDaysPerWeek: "", injuries: " " });
    expect(i.stressLevel).toBe(5);
    expect(i.trainingDaysPerWeek).toBeNull();
    expect(i.injuries).toBeNull();
  });
  it("range-checks", () => {
    expect(intakeSchema.safeParse({ stressLevel: "11" }).success).toBe(false);
    expect(intakeSchema.safeParse({ trainingDaysPerWeek: 8 }).success).toBe(false);
    expect(intakeSchema.safeParse({ compSquatKg: 900 }).success).toBe(false);
    expect(intakeSchema.safeParse({ dateOfBirth: "1995-02-30" }).success).toBe(false);
  });
});

describe("height", () => {
  it("converts both ways", () => {
    expect(cmToFeetInches(180)).toEqual({ feet: 5, inches: 10.9 });
    expect(feetInchesToCm(5, 11)).toBe(180.3);
    expect(formatHeight(175, "kg")).toBe("175 cm");
    expect(formatHeight(182.9, "lb")).toBe("6′ 0″");
  });
});

describe("business settings", () => {
  it("falls back to sensible defaults", () => {
    expect(readServices(undefined)).toEqual(DEFAULT_SERVICES);
    expect(readServices(["", "  "])).toEqual(DEFAULT_SERVICES);
    expect(readApplyFormSettings(undefined)).toMatchObject({ enabled: true, hidden: [] });
    expect(readApplyFormSettings({ enabled: false, hidden: ["funFact", "bogus"] })).toMatchObject({
      enabled: false,
      hidden: ["funFact"],
    });
  });
});
