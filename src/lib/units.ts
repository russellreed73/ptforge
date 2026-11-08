/**
 * Weights are always STORED in kilograms. These helpers convert for display
 * and input in the person's preferred unit.
 */
export const UNITS = ["kg", "lb"] as const;

/**
 * Each person has two unit settings: one for the competition lifts (squat,
 * bench, deadlift: "sbd") and one for everything else ("general"), like
 * Jacob's prototype. Many lifters compete in kg but load accessories in lb.
 */
export type UnitKind = "sbd" | "general";
export type UnitPrefs = Record<UnitKind, Unit>;
export type Unit = (typeof UNITS)[number];

export const KG_PER_LB = 0.45359237; // exact, by international definition

export function isUnit(value: unknown): value is Unit {
  return value === "kg" || value === "lb";
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/** A stored kg value in the given unit. */
export function fromKg(kg: number, unit: Unit): number {
  return unit === "kg" ? kg : kgToLb(kg);
}

/** A value typed in the given unit, as kg for storage (3 decimals, like the database). */
export function toKg(value: number, unit: Unit): number {
  const kg = unit === "kg" ? value : lbToKg(value);
  return Math.round(kg * 1000) / 1000;
}

/** Round to the nearest loadable step: 2.5 kg or 5 lb by default. */
export function roundToStep(value: number, unit: Unit, step = unit === "kg" ? 2.5 : 5): number {
  return Math.round(value / step) * step;
}

/** "102.5 kg" / "225 lb": trims trailing zeros, at most 1 decimal. */
export function formatWeight(kg: number | null | undefined, unit: Unit): string {
  if (kg === null || kg === undefined || Number.isNaN(kg)) return "—";
  const value = Math.round(fromKg(kg, unit) * 10) / 10;
  return `${value.toLocaleString("en-CA", { maximumFractionDigits: 1 })} ${unit}`;
}

/** Parse what someone typed ("225", "102,5") into kg, or null if it isn't a weight. */
export function parseWeight(input: string, unit: Unit): number | null {
  const n = Number(input.trim().replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 2000) return null;
  return toKg(n, unit);
}
