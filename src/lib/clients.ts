import { z } from "zod";

/*
 * Client application ("Step 1 - Apply") and detailed intake ("Step 2"),
 * from Jacob's client app prototype. Client-safe: used by forms and actions.
 */

export const CLIENT_STATUSES = ["lead", "active", "paused"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export const STATUS_LABELS: Record<ClientStatus, string> = {
  lead: "Lead",
  active: "Active",
  paused: "Paused",
};

export function statusTone(status: string): "primary" | "accent" | "muted" {
  return status === "lead" ? "primary" : status === "active" ? "accent" : "muted";
}

export const CLIENT_SOURCES = ["manual", "website_form", "invitation"] as const;
export const SOURCE_LABELS: Record<(typeof CLIENT_SOURCES)[number], string> = {
  manual: "Added by a coach",
  website_form: "Website Apply form",
  invitation: "App invitation",
};

export const SEXES = ["male", "female", "other"] as const;
export const SEX_LABELS: Record<(typeof SEXES)[number], string> = {
  male: "Male",
  female: "Female",
  other: "Other",
};

export const POWERLIFTING_EXPERIENCE = [
  "Competed many times (5+)",
  "Competed a few times (1-4)",
  "Planning on competing soon (within 6 months)",
  "Planning on competing eventually (6+ months)",
  "I don't want to compete",
  "Other",
] as const;

/** Services a new business starts with; editable in Settings. */
export const DEFAULT_SERVICES = ["Personal training", "Online coaching", "Powerlifting coaching"];

/** Apply-form questions an administrator can switch off. Name, email, service and goals always stay. */
export const OPTIONAL_APPLY_QUESTIONS = {
  pronouns: "Pronouns",
  sex: "Sex",
  location: "Where are you based?",
  instagram: "Instagram handle",
  coachPreference: "Who would you like to coach with?",
  coachQualities: "Qualities you value in a coach",
  heardAbout: "How did you hear about us?",
  funFact: "Unrelated fun fact",
} as const;
export type OptionalApplyQuestion = keyof typeof OPTIONAL_APPLY_QUESTIONS;
const OPTIONAL_KEYS = Object.keys(OPTIONAL_APPLY_QUESTIONS) as OptionalApplyQuestion[];

export type ApplyFormSettings = {
  enabled: boolean;
  hidden: OptionalApplyQuestion[];
  /** Shown above the form. */
  intro: string;
};

export const DEFAULT_APPLY_INTRO =
  "Tell us a bit about yourself and what you want from coaching. A coach will be in touch to set up a call.";

export function readServices(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_SERVICES;
  const list = value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  return list.length ? list : DEFAULT_SERVICES;
}

export function readApplyFormSettings(value: unknown): ApplyFormSettings {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    enabled: raw.enabled !== false,
    hidden: Array.isArray(raw.hidden)
      ? OPTIONAL_KEYS.filter((k) => (raw.hidden as unknown[]).includes(k))
      : [],
    intro: typeof raw.intro === "string" && raw.intro.trim() ? raw.intro : DEFAULT_APPLY_INTRO,
  };
}

/** "@Name.Here", "instagram.com/name.here/" or "name.here" → "@name.here" */
export function normalizeInstagram(handle: string | null | undefined): string | null {
  if (!handle) return null;
  const h = handle
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "")
    .toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(h) ? `@${h}` : null;
}

const text = (max: number) => z.string().trim().max(max, `Use at most ${max} characters.`);
const optionalText = (max: number) =>
  text(max)
    .optional()
    .transform((v) => (v ? v : null));
const requiredText = (max: number, message: string) => text(max).min(1, message);

/**
 * The Apply answers. Which optional questions are required depends on the
 * business's settings, so the public form checks that separately
 * (missingApplyAnswers); coaches adding a client can leave them blank.
 */
export const applicationSchema = z.object({
  firstName: requiredText(60, "Enter a first name."),
  lastName: requiredText(60, "Enter a last name."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.email("Enter a valid email address.").nullable()),
  pronouns: optionalText(40),
  sex: z
    .enum(SEXES)
    .optional()
    .or(z.literal("").transform(() => undefined))
    .transform((v) => v ?? null),
  country: optionalText(80),
  region: optionalText(80),
  city: optionalText(80),
  instagram: optionalText(80),
  serviceType: text(120).default(""),
  /** A trainer's user id, "unsure" or "none". */
  coachPreference: optionalText(60),
  coachQualities: optionalText(2000),
  goals: optionalText(2000),
  heardAbout: optionalText(200),
  funFact: optionalText(500),
});
export type ApplicationInput = z.input<typeof applicationSchema>;
export type Application = z.output<typeof applicationSchema>;

/** Questions the public form requires (all shown questions except Instagram). */
export function missingApplyAnswers(
  a: Application,
  hidden: readonly OptionalApplyQuestion[],
  { askCoach }: { askCoach: boolean },
): string | null {
  const shown = (q: OptionalApplyQuestion) => !hidden.includes(q);
  if (!a.email) return "Enter your email address.";
  if (!a.serviceType) return "Choose the service you're interested in.";
  if (!a.goals) return "Tell us your main training goals.";
  if (shown("pronouns") && !a.pronouns) return "Enter your pronouns.";
  if (shown("sex") && !a.sex) return "Choose an option for sex.";
  if (shown("location") && !(a.country && a.region && a.city))
    return "Enter your country, province or state, and city.";
  if (shown("coachPreference") && askCoach && !a.coachPreference)
    return "Choose who you'd like to coach with.";
  if (shown("coachQualities") && !a.coachQualities)
    return "Tell us what you value most in a coach.";
  if (shown("heardAbout") && !a.heardAbout) return "Tell us how you heard about us.";
  if (shown("funFact") && !a.funFact) return "Share one fun fact about yourself.";
  return null;
}

const optionalInt = (min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `Use a whole number from ${min} to ${max}.` });
        return z.NEVER;
      }
      return n;
    });

/** Loads arrive already converted to kg by the form; this only range-checks. */
const optionalKg = (max: number) =>
  z
    .number()
    .min(0)
    .max(max, "That number looks too big.")
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const intakeSchema = z.object({
  phone: optionalText(40),
  dateOfBirth: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.iso.date("Enter a valid date.").nullable()),
  exerciseHistory: optionalText(4000),
  signupReason: optionalText(4000),
  heightCm: z
    .number()
    .min(50, "Height looks too small.")
    .max(250, "Height looks too big.")
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  bodyWeightKg: optionalKg(400),
  occupation: optionalText(4000),
  stressLevel: optionalInt(1, 10),
  trainingDaysPerWeek: optionalInt(1, 7),
  sleep: optionalText(4000),
  diet: optionalText(4000),
  injuries: optionalText(4000),
  compSquatKg: optionalKg(700),
  compBenchKg: optionalKg(700),
  compDeadliftKg: optionalKg(700),
  gymSquatKg: optionalKg(700),
  gymBenchKg: optionalKg(700),
  gymDeadliftKg: optionalKg(700),
  weeklySetsSquat: optionalInt(0, 100),
  weeklySetsBench: optionalInt(0, 100),
  weeklySetsDeadlift: optionalInt(0, 100),
  weeklySetsVerticalPull: optionalInt(0, 100),
  weeklySetsCore: optionalInt(0, 100),
  powerliftingExperience: z
    .enum(POWERLIFTING_EXPERIENCE)
    .optional()
    .or(z.literal("").transform(() => undefined))
    .transform((v) => v ?? null),
  otherInfo: optionalText(4000),
});
export type IntakeInput = z.input<typeof intakeSchema>;
export type Intake = z.output<typeof intakeSchema>;

/** cm ↔ feet and inches, for people who use lb. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round((totalInches - feet * 12) * 10) / 10;
  if (inches >= 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}
export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54 * 10) / 10;
}
export function formatHeight(cm: number | null | undefined, unit: "kg" | "lb"): string {
  if (cm == null) return "—";
  if (unit === "kg") return `${cm} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}′ ${inches}″`;
}
