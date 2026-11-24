import { z } from "zod";

/*
 * A training block, following Jacob's Builder tab:
 *   block (name, weeks, goals)
 *     → days ("Day 1 — Squat 1, Deadlift 2")
 *       → warm-ups (exercise + dose, e.g. "10e")
 *       → exercises (from the library, notes, optional estimated load)
 *         → sets (reps, an RPE target for each week, or a backdown % off the set before)
 * Stored as JSON in programs.content. Every day, item and set has a stable id
 * so workout logs (next step) can point at them.
 */

export const MAX_WEEKS = 12;
export const DEFAULT_WEEKS = 4;
export const PROGRAM_STATUSES = ["draft", "active", "completed", "archived"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];
export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  draft: "Draft",
  active: "Current",
  completed: "Finished",
  archived: "Archived",
};

const id = z.string().regex(/^[\w-]{6,40}$/, "Invalid id.");
const text = (max: number) => z.string().trim().max(max);

/** "7", "7.5", "6-7", "8.5" or "" (no target that week). */
export const rpeTarget = z
  .string()
  .trim()
  .max(12)
  .refine((v) => v === "" || /^(?:\d{1,2}(?:\.5)?)(?:\s*-\s*\d{1,2}(?:\.5)?)?$/.test(v), {
    message: "RPE targets look like 7, 7.5 or 7-8.",
  })
  .refine(
    (v) =>
      v === "" ||
      v
        .split("-")
        .map(Number)
        .every((n) => n >= 1 && n <= 10),
    { message: "RPE targets go from 1 to 10." },
  );

export const programSetSchema = z.object({
  id,
  /** "5", "8-10", "10e" (each side), "AMRAP", "30s" */
  reps: text(20),
  /** One target per week of the block. Ignored for backdown sets. */
  rpe: z.array(rpeTarget).max(MAX_WEEKS),
  /** Backdown: this many % lighter than the set before (e.g. 8 = 92% of it). */
  backdownPct: z.number().min(0.5).max(90).nullable(),
});

export const programExerciseSchema = z.object({
  id,
  exerciseId: z.uuid().nullable(),
  /** Snapshot of the exercise name, so renaming the library entry doesn't rewrite history. */
  name: text(120).min(1, "Every exercise needs a name."),
  notes: text(500),
  /** Show the athlete an estimated load (never the E1RM behind it). Used once logging exists. */
  showEstimatedLoad: z.boolean(),
  sets: z.array(programSetSchema).max(20, "Up to 20 sets per exercise."),
});

export const programWarmupSchema = z.object({
  id,
  exerciseId: z.uuid().nullable(),
  name: text(120).min(1, "Every warm-up needs a name."),
  /** "10e", "6e", "2 min" */
  dose: text(40),
});

export const programDaySchema = z.object({
  id,
  title: text(120).min(1, "Every day needs a title."),
  notes: text(1000),
  warmups: z.array(programWarmupSchema).max(20, "Up to 20 warm-ups per day."),
  exercises: z.array(programExerciseSchema).max(30, "Up to 30 exercises per day."),
});

export const programContentSchema = z.object({
  days: z.array(programDaySchema).max(14, "Up to 14 days per block."),
});

export type ProgramSet = z.infer<typeof programSetSchema>;
export type ProgramExercise = z.infer<typeof programExerciseSchema>;
export type ProgramWarmup = z.infer<typeof programWarmupSchema>;
export type ProgramDay = z.infer<typeof programDaySchema>;
export type ProgramContent = z.infer<typeof programContentSchema>;

export const programDetailsSchema = z.object({
  name: text(80).min(1, "Give the block a name, e.g. Y1M2."),
  goals: text(1000),
  weeks: z.number().int().min(1).max(MAX_WEEKS),
  startDate: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.iso.date("Enter a valid start date.").nullable()),
});
export type ProgramDetails = z.input<typeof programDetailsSchema>;

/** Reads stored content defensively (old or hand-edited JSON never crashes a page). */
export function readProgramContent(value: unknown): ProgramContent {
  const parsed = programContentSchema.safeParse(value);
  return parsed.success ? parsed.data : { days: [] };
}

/** Makes every set's RPE list exactly `weeks` long (padding with blanks). */
export function fitWeeks(content: ProgramContent, weeks: number): ProgramContent {
  return {
    days: content.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((e) => ({
        ...e,
        sets: e.sets.map((s) => ({
          ...s,
          rpe: Array.from({ length: weeks }, (_, i) => s.rpe[i] ?? ""),
        })),
      })),
    })),
  };
}

/** Fresh ids throughout, for copying a block or template. */
export function withNewIds(content: ProgramContent, newId: () => string): ProgramContent {
  return {
    days: content.days.map((d) => ({
      ...d,
      id: newId(),
      warmups: d.warmups.map((w) => ({ ...w, id: newId() })),
      exercises: d.exercises.map((e) => ({
        ...e,
        id: newId(),
        sets: e.sets.map((s) => ({ ...s, id: newId() })),
      })),
    })),
  };
}

/** Multiplier for a backdown set: 8% → 0.92. */
export function backdownFactor(pct: number): number {
  return Math.round((1 - pct / 100) * 10000) / 10000;
}

/** "RPE 7.5", "RPE 7-8", or "" */
export function formatRpe(target: string | undefined): string {
  return target ? `RPE ${target.replace(/\s*-\s*/, "–")}` : "";
}

/** A short line for lists: "4 days · 4 weeks · 23 exercises" */
export function programSummary(content: ProgramContent, weeks: number): string {
  const ex = content.days.reduce((n, d) => n + d.exercises.length, 0);
  const days = content.days.length;
  return `${days} day${days === 1 ? "" : "s"} · ${weeks} week${weeks === 1 ? "" : "s"} · ${ex} exercise${ex === 1 ? "" : "s"}`;
}
