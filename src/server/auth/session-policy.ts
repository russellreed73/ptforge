import type { RoleName } from "./permissions";

/** Athletes stay signed in on their phones; coaches sign in again weekly. */
export const STAFF_SESSION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isStaff(roles: readonly RoleName[]): boolean {
  return roles.some((r) => r === "admin" || r === "manager" || r === "trainer");
}

/**
 * True when a coach's sign-in is older than 7 days. Anyone with a staff role
 * in any business counts as a coach. Athletes fall back to Better Auth's own
 * 90-day expiry, renewed whenever they use the app.
 */
export function staffSessionExpired(
  signedInAt: Date,
  rolesAcrossBusinesses: readonly RoleName[],
  now = new Date(),
): boolean {
  return (
    isStaff(rolesAcrossBusinesses) &&
    now.getTime() - signedInAt.getTime() > STAFF_SESSION_DAYS * DAY_MS
  );
}
