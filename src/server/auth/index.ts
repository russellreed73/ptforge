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
import { createElement } from "react";
import Invitation from "../../emails/invitation";
import ResetPassword from "../../emails/reset-password";
import VerifyEmail from "../../emails/verify-email";
import { db } from "../db";
import * as schema from "../db/schema";
import { sendEmail } from "../email/send";
import { validateRoleSet } from "../../lib/roles";
import { onInvitationAccepted } from "../team/on-accept";
import { appBaseUrl, trustedOrigins } from "./origins";
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
  baseURL: appBaseUrl(),
  trustedOrigins: trustedOrigins(),
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
    // New accounts must confirm their email before they can sign in.
    requireEmailVerification: true,
    // A reset signs the person out on every other device.
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your PTForge password",
        react: createElement(ResetPassword, { name: user.name, url }),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // Signing in with an unconfirmed email sends a fresh link.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60, // 1 hour
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Confirm your email for PTForge",
        react: createElement(VerifyEmail, { name: user.name, url }),
      });
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
      // Squat, bench and deadlift can use a different unit (Jacob's prototype).
      sbdUnit: { type: "string", defaultValue: "kg", input: false },
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
      sendInvitationEmail: async ({ email, invitation, organization, inviter }) => {
        await sendEmail({
          to: email,
          subject: `${inviter.user.name} invited you to ${organization.name} on PTForge`,
          react: createElement(Invitation, {
            inviterName: inviter.user.name,
            businessName: organization.name,
            roleLabel: parseRoles(invitation.role).join(" and "),
            // The accept page is built in phase 1 step 2.
            url: `${appBaseUrl()}/accept-invite/${invitation.id}`,
          }),
        });
      },
      organizationHooks: {
        // Roles must be a valid combination (e.g. athletes aren't also staff).
        beforeUpdateMemberRole: async ({ newRole }) => {
          const problem = validateRoleSet(newRole.split(","));
          if (problem) throw new APIError("BAD_REQUEST", { message: problem });
        },
        afterAcceptInvitation: async ({ invitation, user, organization }) => {
          await onInvitationAccepted({
            tenantId: organization.id,
            userId: user.id,
            userName: user.name,
            email: user.email,
            role: invitation.role,
            inviterId: invitation.inviterId,
            invitationId: invitation.id,
          });
        },
        // A manager may invite trainers and athletes; a trainer only athletes.
        beforeCreateInvitation: async ({ invitation, inviter, organization }) => {
          const inviterMember = await db.query.member.findFirst({
            where: (m, { and, eq }) =>
              and(eq(m.userId, inviter.id), eq(m.organizationId, organization.id)),
          });
          const allowed = invitableRoles(parseRoles(inviterMember?.role));
          const requested = parseRoles(invitation.role);
          const problem = validateRoleSet(invitation.role.split(","));
          if (problem) throw new APIError("BAD_REQUEST", { message: problem });
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
