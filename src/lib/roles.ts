/** Shared, client-safe role labels. */
export const ROLE_LABELS = {
  admin: "Administrator",
  manager: "Manager",
  trainer: "Trainer",
  athlete: "Athlete",
} as const;

export type RoleKey = keyof typeof ROLE_LABELS;

export function describeRoles(roles: readonly RoleKey[]): string {
  return roles.map((r) => ROLE_LABELS[r]).join(" + ") || "No role";
}

/** Staff can't also be athletes in the same business (keeps the app's views simple). */
export function validateRoleSet(roles: readonly string[]): string | null {
  if (roles.length === 0) return "Choose at least one role.";
  const known = Object.keys(ROLE_LABELS);
  if (roles.some((r) => !known.includes(r))) return "Unknown role.";
  if (roles.includes("athlete") && roles.length > 1) {
    return "An athlete can't also be staff in the same business.";
  }
  return null;
}
