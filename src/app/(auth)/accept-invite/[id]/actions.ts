"use server";

import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/server/auth";
import { isPasswordPwned } from "@/server/auth/pwned";
import { getInvitationForAcceptPage } from "@/server/team/queries";

const input = z.object({
  invitationId: z.uuid(),
  name: z.string().trim().min(1, "Enter your name.").max(100),
  password: z
    .string()
    .min(16, "Use at least 16 characters.")
    .max(128, "Use at most 128 characters."),
});

/**
 * Creates the account for someone accepting an invitation. The email comes
 * from the invitation, never from the form, and counts as confirmed: only the
 * person who received the invitation email has this link. The browser then
 * signs in and accepts the invitation as that person.
 */
export async function createInvitedAccount(
  raw: z.input<typeof input>,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { invitationId, name, password } = parsed.data;

  const inv = await getInvitationForAcceptPage(invitationId);
  if (!inv || inv.status !== "pending" || inv.expired) {
    return { ok: false, error: "This invitation is no longer valid. Ask for a new one." };
  }
  if (inv.hasAccount) {
    return { ok: false, error: "You already have a PTForge account. Sign in to accept." };
  }
  if (await isPasswordPwned(password)) {
    return {
      ok: false,
      error: "That password has appeared in a data breach. Please choose a different one.",
    };
  }

  try {
    await auth.api.createUser({
      body: {
        email: inv.email,
        password,
        name,
        role: "user",
        data: { emailVerified: true },
      },
    });
  } catch (err) {
    if (err instanceof APIError) return { ok: false, error: err.body?.message ?? err.message };
    throw err;
  }
  return { ok: true, email: inv.email };
}
