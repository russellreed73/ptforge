"use client";

import { adminClient, organizationClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, roles } from "@/server/auth/permissions";

/** Browser-side auth: sign in/up/out, create a business, invitations. */
export const authClient = createAuthClient({
  plugins: [organizationClient({ ac, roles }), adminClient(), twoFactorClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
