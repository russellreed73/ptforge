import { z } from "zod";
import { parseVideoLink } from "./video";

/*
 * Exercise library fields, following Jacob's prototype: name, muscle group,
 * lift family, equipment, movement type, tags, coaching cues and a demo video.
 * Client-safe.
 */

/** Suggestions offered while typing; coaches can enter anything. */
export const FAMILY_SUGGESTIONS = [
  "Squat",
  "Bench",
  "Deadlift",
  "Squat accessory",
  "Bench accessory",
  "Deadlift accessory",
  "Single leg",
  "Back",
  "Shoulders",
  "Arms",
  "Core",
  "Warmup",
  "Conditioning",
];
export const EQUIPMENT_SUGGESTIONS = [
  "Barbell",
  "Dumbbell",
  "Kettlebell",
  "Cable",
  "Machine",
  "Band",
  "Bodyweight",
  "Specialty bar",
  "Dowel",
];
export const MOVEMENT_SUGGESTIONS = [
  "Compound",
  "Isolation",
  "Hinge",
  "Single leg",
  "Isometric",
  "Mobility",
];
export const MUSCLE_SUGGESTIONS = [
  "Quads",
  "Hamstrings",
  "Glutes",
  "Posterior chain",
  "Chest",
  "Back",
  "Upper back",
  "Lower back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Core",
  "Hips",
  "Ankles",
  "Full body",
];

/** The tag that marks squat, bench and deadlift (competition lifts). */
export const SBD_TAG = "sbd";

/** "Biceps, arms ,curl, Biceps" → ["biceps", "arms", "curl"] */
export function parseTags(input: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(input) ? input : (input ?? "").split(",");
  const seen = new Set<string>();
  for (const p of parts) {
    const t = p.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
    if (t) seen.add(t);
  }
  return [...seen].slice(0, 30);
}

/** "Quads, Glutes" → ["Quads", "Glutes"] (keeps the coach's capitals). */
export function parseList(input: string | null | undefined): string[] {
  const seen = new Map<string, string>();
  for (const p of (input ?? "").split(",")) {
    const t = p.trim().replace(/\s+/g, " ").slice(0, 60);
    if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
  }
  return [...seen.values()].slice(0, 10);
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : null));

export const exerciseSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name.").max(120, "Use at most 120 characters."),
    muscles: z.string().max(400).optional(),
    family: optional(60),
    equipment: optional(60),
    movement: optional(60),
    tags: z.string().max(1000).optional(),
    cues: optional(4000),
    competitionLift: z.boolean().default(false),
    videoUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => (v ? v : null))
      .refine(
        (v) => v === null || parseVideoLink(v) !== null,
        "Enter a full video link starting with https://",
      ),
    videoAssetId: z.uuid().nullable().optional(),
  })
  .transform((v) => {
    let tags = parseTags(v.tags);
    // Keep the "sbd" tag and the competition-lift switch in step.
    if (v.competitionLift && !tags.includes(SBD_TAG)) tags = [...tags, SBD_TAG];
    const competitionLift = v.competitionLift || tags.includes(SBD_TAG);
    return {
      name: v.name,
      primaryMuscles: parseList(v.muscles),
      category: v.family,
      equipment: v.equipment,
      movement: v.movement,
      tags,
      cues: v.cues,
      isCompetitionLift: competitionLift,
      // One video per exercise: an upload wins over a link.
      demoVideoUrl: v.videoAssetId ? null : v.videoUrl,
      videoAssetId: v.videoAssetId ?? null,
    };
  });
export type ExerciseInput = z.input<typeof exerciseSchema>;
export type ExerciseValues = z.output<typeof exerciseSchema>;

/** "Quads · Squat accessory · Band · Single leg", like the prototype's cards. */
export function exerciseSummary(e: {
  primaryMuscles: string[] | null;
  category: string | null;
  equipment: string | null;
  movement: string | null;
}): string {
  const parts = [e.primaryMuscles?.join(", "), e.category, e.equipment, e.movement];
  const seen = new Set<string>();
  return parts
    .filter((p): p is string => {
      if (!p || seen.has(p.toLowerCase())) return false;
      seen.add(p.toLowerCase());
      return true;
    })
    .join(" · ");
}
