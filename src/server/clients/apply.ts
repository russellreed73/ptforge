import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { createElement } from "react";
import NewLead from "@/emails/new-lead";
import {
  applicationSchema,
  missingApplyAnswers,
  normalizeInstagram,
  type ApplicationInput,
} from "@/lib/clients";
import { writeAudit } from "../audit";
import { appBaseUrl } from "../auth/origins";
import { parseRoles } from "../auth/permissions";
import { brandAssetUrl, getBusinessBranding } from "../brand/queries";
import { db } from "../db";
import { athleteProfiles, member, organization, user } from "../db/schema";
import { sendEmail } from "../email/send";
import { listCoaches } from "./queries";

/*
 * The public website Apply form. Nobody is signed in, so this uses the owner
 * connection and always works on exactly one business, looked up by slug.
 * It only ever inserts or updates leads; it never reads data back to the visitor.
 */

/** Limits for the public form. */
export const APPLY_LIMITS = {
  perIpPerHour: 5,
  perBusinessPerHour: 30,
  /** Real people take longer than this to fill in the form. */
  minSecondsToFill: 3,
};

/** What the public form needs to render, or null if the business has no open form. */
export async function getApplyForm(slug: string) {
  const org = await db.query.organization.findFirst({
    where: eq(organization.slug, slug),
    columns: { id: true },
  });
  if (!org) return null;
  const brand = await getBusinessBranding(org.id);
  if (!brand || !brand.applyForm.enabled) return null;
  const coaches = await listCoaches(org.id);
  return {
    tenantId: org.id,
    name: brand.name,
    slug: brand.slug,
    theme: brand.theme,
    logo: brand.logoVersion
      ? {
          src: brandAssetUrl(brand.slug, "header", brand.logoVersion),
          width: brand.logoSize?.width ?? 96,
          height: brand.logoSize?.height ?? 96,
        }
      : null,
    services: brand.services,
    hidden: brand.applyForm.hidden,
    intro: brand.applyForm.intro,
    // First names only: the public sees which coaches they can ask for, nothing else.
    coaches: coaches.map((c) => ({ userId: c.userId, name: c.name.split(" ")[0] })),
  };
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256")
    .update(`${process.env.BETTER_AUTH_SECRET ?? "ptforge"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

/** Cloudflare Turnstile. Skipped when no secret is configured (local development). */
export async function verifyTurnstile(token: string | null, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[apply] Turnstile check failed", err);
    return false;
  }
}

export type ApplyResult = { ok: true } | { ok: false; error: string };

export async function submitApplication(
  slug: string,
  raw: ApplicationInput,
  meta: { ip: string | null; turnstileToken: string | null; honeypot: string; elapsedMs: number },
): Promise<ApplyResult> {
  const form = await getApplyForm(slug);
  if (!form) return { ok: false, error: "This form isn't accepting applications." };

  // Bots: pretend it worked so they learn nothing.
  if (meta.honeypot || meta.elapsedMs < APPLY_LIMITS.minSecondsToFill * 1000) return { ok: true };

  const parsed = applicationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const a = parsed.data;
  const askCoach = form.coaches.length > 1;
  const missing = missingApplyAnswers(a, form.hidden, { askCoach });
  if (missing) return { ok: false, error: missing };
  if (a.serviceType && !form.services.includes(a.serviceType))
    return { ok: false, error: "Choose one of the services listed." };

  if (!(await verifyTurnstile(meta.turnstileToken, meta.ip))) {
    return { ok: false, error: 'Please complete the "I\'m human" check and try again.' };
  }

  const ipHash = hashIp(meta.ip);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [{ n: fromIp }] = ipHash
    ? await db
        .select({ n: sql<number>`count(*)::int` })
        .from(athleteProfiles)
        .where(
          and(eq(athleteProfiles.submittedIpHash, ipHash), gt(athleteProfiles.updatedAt, hourAgo)),
        )
    : [{ n: 0 }];
  const [{ n: forBusiness }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(athleteProfiles)
    .where(
      and(
        eq(athleteProfiles.tenantId, form.tenantId),
        eq(athleteProfiles.source, "website_form"),
        gt(athleteProfiles.updatedAt, hourAgo),
      ),
    );
  if (fromIp >= APPLY_LIMITS.perIpPerHour || forBusiness >= APPLY_LIMITS.perBusinessPerHour) {
    return { ok: false, error: "Too many applications right now. Please try again in an hour." };
  }

  const coach =
    a.coachPreference && a.coachPreference !== "unsure" && a.coachPreference !== "none"
      ? form.coaches.find((c) => c.userId === a.coachPreference)
      : undefined;
  const answers = {
    firstName: a.firstName,
    lastName: a.lastName,
    pronouns: a.pronouns,
    sex: a.sex,
    country: a.country,
    region: a.region,
    city: a.city,
    instagram: normalizeInstagram(a.instagram) ?? a.instagram,
    serviceType: a.serviceType,
    coachPreference: coach
      ? "trainer"
      : a.coachPreference === "unsure" || a.coachPreference === "none"
        ? a.coachPreference
        : null,
    preferredTrainerUserId: coach?.userId ?? null,
    coachQualities: a.coachQualities,
    goals: a.goals,
    heardAbout: a.heardAbout,
    funFact: a.funFact,
    appliedAt: new Date(),
    submittedIpHash: ipHash,
  };

  // Someone already in the list (same email): refresh a lead's answers, but
  // never overwrite an active client's record from a public form.
  const email = a.email!;
  const existing = await db.query.athleteProfiles.findFirst({
    where: and(
      eq(athleteProfiles.tenantId, form.tenantId),
      sql`lower(${athleteProfiles.email}) = ${email}`,
    ),
    columns: { id: true, status: true, archivedAt: true },
  });

  let clientId: string;
  if (existing) {
    clientId = existing.id;
    if (existing.status === "lead" || existing.archivedAt) {
      await db
        .update(athleteProfiles)
        .set({ ...answers, status: "lead", archivedAt: null, source: "website_form" })
        .where(eq(athleteProfiles.id, existing.id));
    } else {
      await db
        .update(athleteProfiles)
        .set({ submittedIpHash: ipHash, appliedAt: answers.appliedAt })
        .where(eq(athleteProfiles.id, existing.id));
    }
  } else {
    const [row] = await db
      .insert(athleteProfiles)
      .values({
        tenantId: form.tenantId,
        email,
        ...answers,
        status: "lead",
        source: "website_form",
      })
      .returning({ id: athleteProfiles.id });
    clientId = row.id;
  }

  await writeAudit({
    tenantId: form.tenantId,
    actorUserId: null,
    action: existing ? "client.applied_again" : "client.applied",
    targetType: "athlete_profile",
    targetId: clientId,
  });

  await notifyCoaches({
    tenantId: form.tenantId,
    businessName: form.name,
    slug: form.slug,
    clientId,
    leadName: `${a.firstName} ${a.lastName}`,
    service: a.serviceType,
    goals: a.goals,
    requestedCoach: coach ?? null,
    existing: Boolean(existing),
  });
  return { ok: true };
}

/** Emails administrators, managers and the coach they asked for. Never throws. */
async function notifyCoaches(lead: {
  tenantId: string;
  businessName: string;
  slug: string;
  clientId: string;
  leadName: string;
  service: string;
  goals: string | null;
  requestedCoach: { userId: string; name: string } | null;
  existing: boolean;
}) {
  try {
    const members = await db
      .select({ userId: member.userId, role: member.role, email: user.email })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, lead.tenantId));
    const to = new Set<string>();
    for (const m of members) {
      const roles = parseRoles(m.role);
      if (
        roles.includes("admin") ||
        roles.includes("manager") ||
        m.userId === lead.requestedCoach?.userId
      )
        to.add(m.email);
    }
    const base = appBaseUrl() ?? "http://localhost:3000";
    const url = `${base}/${lead.slug}/clients/${lead.clientId}`;
    await Promise.all(
      [...to].map((addr) =>
        sendEmail({
          to: addr,
          subject: lead.existing
            ? `${lead.leadName} applied again to ${lead.businessName}`
            : `New application: ${lead.leadName}`,
          react: createElement(NewLead, {
            businessName: lead.businessName,
            leadName: lead.leadName,
            service: lead.service,
            goals: lead.goals,
            requestedCoach: lead.requestedCoach?.name ?? null,
            existing: lead.existing,
            url,
          }),
        }),
      ),
    );
  } catch (err) {
    console.error("[apply] couldn't email coaches", err);
  }
}
