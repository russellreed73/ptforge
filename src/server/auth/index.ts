import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import {
  admin as platformAdmin,
  haveIBeenPwned,
  organization,
  twoFactor,
} from "better-auth/plugins";
import { db } from "../db";
import * as schema from "../db/schema";
import {
  adminAc as platformOwnerAc,
  userAc as platformUserAc,
} from "better-auth/plugins/admin/access";
import { ac, invitableRoles, parseRoles, roles } from "./permissions";

const DAY = 60 * 60 * 24;

// The breached-password check calls api.pwnedpasswords.com on every new
// password. Turn it off only for offline development or tests.
const checkBreachedPasswords = process.env.DISABLE_PWNED_CHECK !== "true";

export const auth = betterAuth({
  appName: "PTForge",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, { provider: "pg", schema }),

  advanced: {
    database: { generateId: "uuid" },
  },

  emailAndPassword: {
    enabled: true,
    // Decided Nov 2, 2026: 16 characters minimum, long passphrases welcome.
    minPasswordLength: 16,
    maxPasswordLength: 128,
    // TODO(phase 1): send through Resend. Until then the link is printed in
    // the terminal running `pnpm dev`.
    sendResetPassword: async ({ user, url }) => {
      console.info(`[auth] Password reset for ${user.email}: ${url}`);
    },
  },

  // Athletes sign in once on their phone and stay signed in: each visit
  // pushes the 90-day expiry forward (refreshed at most once a day).
  session: {
    expiresIn: 90 * DAY,
    updateAge: 1 * DAY,
  },

  user: {
    additionalFields: {
      // Weight display unit; loads are always stored in kg.
      preferredUnit: { type: "string", defaultValue: "kg", input: false },
    },
  },

  plugins: [
    // Tenants (coaching businesses), memberships, roles and invitations.
    organization({
      ac,
      roles,
      creatorRole: "admin", // whoever creates a business is its administrator
      allowUserToCreateOrganization: true,
      invitationExpiresIn: 7 * DAY,
      // TODO(phase 1): send through Resend.
      sendInvitationEmail: async ({ email, invitation, organization, inviter }) => {
        const url = `${process.env.BETTER_AUTH_URL}/accept-invite/${invitation.id}`;
        console.info(
          `[auth] ${inviter.user.email} invited ${email} to ${organization.name} as ${invitation.role}: ${url}`,
        );
      },
      organizationHooks: {
        // A manager may invite trainers and athletes; a trainer only athletes.
        beforeCreateInvitation: async ({ invitation, inviter, organization }) => {
          const inviterMember = await db.query.member.findFirst({
            where: (m, { and, eq }) =>
              and(eq(m.userId, inviter.id), eq(m.organizationId, organization.id)),
          });
          const allowed = invitableRoles(parseRoles(inviterMember?.role));
          const requested = parseRoles(invitation.role);
          if (requested.length === 0 || requested.some((r) => !allowed.includes(r))) {
            throw new APIError("FORBIDDEN", {
              message: `You can invite: ${allowed.join(", ") || "nobody"}.`,
            });
          }
        },
      },
    }),

    // Platform owner tools (you): list tenants, ban users, impersonate for
    // support. Separate from tenant roles on purpose.
    platformAdmin({
      roles: { platform_owner: platformOwnerAc, user: platformUserAc },
      adminRoles: ["platform_owner"],
      defaultRole: "user",
    }),

    // Authenticator-app two-factor; strongly recommended for coaches.
    twoFactor({ issuer: "PTForge" }),

    ...(checkBreachedPasswords ? [haveIBeenPwned()] : []),

    // Must be last: lets Server Actions set auth cookies.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
