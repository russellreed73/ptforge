import { createAccessControl } from "better-auth/plugins/access";

/**
 * Everything a member of a coaching business (a "tenant") can be allowed to do.
 *
 * The first four groups are checked by Better Auth itself (organization,
 * member, invitation, ac). The rest are PTForge's own and are checked with
 * `can()` in Server Actions before any data changes.
 *
 * Which athletes a trainer can see is NOT decided here: that is enforced by
 * Postgres Row-Level Security (see drizzle/0001_row_level_security.sql), so a
 * forgotten check in application code still cannot leak data.
 */
export const statements = {
  // Better Auth organization plugin
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  ac: ["create", "read", "update", "delete"],

  // PTForge
  billing: ["manage"],
  settings: ["update"],
  athlete: ["create", "read", "update", "archive", "assign_trainer", "view_all"],
  exercise: ["create", "update", "delete"],
  program: ["create", "update", "assign"],
  workout: ["log_on_behalf"],
  export: ["tenant_data"],
} as const;

export const ac = createAccessControl(statements);

export const ROLE_NAMES = ["admin", "manager", "trainer", "athlete"] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

/** Administrator: runs the business. Everything. */
const admin = ac.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  ac: ["create", "read", "update", "delete"],
  billing: ["manage"],
  settings: ["update"],
  athlete: ["create", "read", "update", "archive", "assign_trainer", "view_all"],
  exercise: ["create", "update", "delete"],
  program: ["create", "update", "assign"],
  workout: ["log_on_behalf"],
  export: ["tenant_data"],
});

/**
 * Manager: oversees every athlete and can invite trainers, but cannot touch
 * billing, settings, remove people or change anyone's role.
 */
const manager = ac.newRole({
  invitation: ["create", "cancel"],
  athlete: ["create", "read", "update", "assign_trainer", "view_all"],
  exercise: ["create", "update", "delete"],
  program: ["create", "update", "assign"],
  workout: ["log_on_behalf"],
});

/** Trainer: works with assigned athletes only (RLS limits which ones). */
const trainer = ac.newRole({
  invitation: ["create"],
  athlete: ["create", "read", "update"],
  exercise: ["create", "update", "delete"],
  program: ["create", "update", "assign"],
  workout: ["log_on_behalf"],
});

/** Athlete: their own data only, through the phone app. */
const athlete = ac.newRole({
  athlete: ["read"],
});

export const roles = { admin, manager, trainer, athlete };

/**
 * Which roles each role may invite. Enforced in the Better Auth
 * `beforeCreateInvitation` hook so a manager can never invite an admin.
 */
export const INVITABLE_ROLES: Record<RoleName, readonly RoleName[]> = {
  admin: ["admin", "manager", "trainer", "athlete"],
  manager: ["trainer", "athlete"],
  trainer: ["athlete"],
  athlete: [],
};

/** Better Auth stores several roles as one comma-separated string. */
export function parseRoles(role: string | null | undefined): RoleName[] {
  if (!role) return [];
  return role
    .split(",")
    .map((r) => r.trim())
    .filter((r): r is RoleName => (ROLE_NAMES as readonly string[]).includes(r));
}

type Statements = typeof statements;
export type PermissionRequest = {
  [K in keyof Statements]?: Statements[K][number][];
};

/**
 * True when at least one of the member's roles allows every requested action.
 * A manager who is also a trainer gets everything either role allows.
 *
 * @example can(["manager", "trainer"], { athlete: ["view_all"] }) // true
 */
export function can(memberRoles: readonly RoleName[], request: PermissionRequest): boolean {
  return memberRoles.some((name) => roles[name].authorize(request).success);
}

/** Which roles `inviterRoles` may invite, combined across all their roles. */
export function invitableRoles(inviterRoles: readonly RoleName[]): RoleName[] {
  const set = new Set<RoleName>();
  for (const r of inviterRoles) for (const x of INVITABLE_ROLES[r]) set.add(x);
  return ROLE_NAMES.filter((r) => set.has(r));
}
