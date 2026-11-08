"use server";

import { headers } from "next/headers";
import type { ApplicationInput } from "@/lib/clients";
import { submitApplication, type ApplyResult } from "./apply";

/** Server Action behind the public Apply form (/[tenant]/join and /embed/[tenant]/join). */
export async function applyAction(
  slug: string,
  answers: ApplicationInput,
  meta: { turnstileToken: string | null; honeypot: string; elapsedMs: number },
): Promise<ApplyResult> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return submitApplication(String(slug), answers, {
    ip,
    turnstileToken: typeof meta?.turnstileToken === "string" ? meta.turnstileToken : null,
    honeypot: typeof meta?.honeypot === "string" ? meta.honeypot : "",
    elapsedMs: Number(meta?.elapsedMs) || 0,
  });
}
