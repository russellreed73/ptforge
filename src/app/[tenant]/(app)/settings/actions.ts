"use server";

import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import {
  DEFAULT_APPLY_INTRO,
  OPTIONAL_APPLY_QUESTIONS,
  type OptionalApplyQuestion,
} from "@/lib/clients";
import { readBusinessMetadata, THEMES, type BusinessMetadata } from "@/lib/themes";
import { UNITS } from "@/lib/units";
import { writeAudit } from "@/server/audit";
import { auth } from "@/server/auth";
import { can } from "@/server/auth/permissions";
import { requireTenant, requireUser } from "@/server/auth/session";
import { LogoError, MAX_LOGO_BYTES } from "@/server/brand/logo";
import { deleteLogo, rebuildLogo, saveLogo } from "@/server/brand/store";
import { db } from "@/server/db";
import { organization } from "@/server/db/schema";

export type SettingsResult =
  { ok: true; message: string; warnings?: string[] } | { ok: false; error: string };

const fail = (error: string): SettingsResult => ({ ok: false, error });

/** Only administrators change settings. Returns the context or null. */
async function requireSettingsAccess(slug: string) {
  const ctx = await requireTenant(slug);
  if (!can(ctx.roles, { settings: ["update"] })) return null;
  const user = await requireUser();
  return { ...ctx, userId: user.id };
}

function refresh(slug: string) {
  // The business name, theme and logo show on every page of the business.
  revalidatePath(`/${slug}`, "layout");
}

const detailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters.")
    .max(80, "Use at most 80 characters."),
  theme: z.enum(Object.keys(THEMES) as [keyof typeof THEMES, ...(keyof typeof THEMES)[]]),
  defaultUnit: z.enum(UNITS),
});

/** Business name, theme and default unit for new clients. */
export async function saveBusinessDetails(
  slug: string,
  raw: z.input<typeof detailsSchema>,
): Promise<SettingsResult> {
  const ctx = await requireSettingsAccess(slug);
  if (!ctx) return fail("Only administrators can change settings.");
  const parsed = detailsSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, theme, defaultUnit } = parsed.data;

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, ctx.tenantId),
    columns: { name: true, metadata: true },
  });
  if (!org) return fail("Business not found.");
  const before = readBusinessMetadata(org.metadata);

  // Keep any other keys already in metadata.
  let existing: Record<string, unknown> = {};
  try {
    existing = org.metadata ? JSON.parse(org.metadata) : {};
  } catch {}
  const metadata: Record<string, unknown> & Partial<BusinessMetadata> = {
    ...existing,
    theme,
    defaultUnit,
  };

  try {
    await auth.api.updateOrganization({
      headers: await headers(),
      body: { organizationId: ctx.tenantId, data: { name, metadata } },
    });
  } catch (err) {
    if (err instanceof APIError) return fail(err.body?.message ?? err.message);
    throw err;
  }

  // Phone icons sit on the theme's background colour, so rebuild them.
  if (before.theme !== theme) await rebuildLogo(ctx.tenantId, THEMES[theme].background);

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (org.name !== name) changes.name = { from: org.name, to: name };
  if (before.theme !== theme) changes.theme = { from: before.theme, to: theme };
  if (before.defaultUnit !== defaultUnit)
    changes.defaultUnit = { from: before.defaultUnit, to: defaultUnit };
  if (Object.keys(changes).length) {
    await writeAudit({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      action: "settings.updated",
      targetType: "organization",
      targetId: ctx.tenantId,
      metadata: changes,
    });
  }
  refresh(slug);
  return { ok: true, message: "Settings saved." };
}

/** Upload a logo: makes the header image and every phone icon size. */
export async function uploadLogo(slug: string, form: FormData): Promise<SettingsResult> {
  const ctx = await requireSettingsAccess(slug);
  if (!ctx) return fail("Only administrators can change settings.");
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a logo file.");
  if (file.size > MAX_LOGO_BYTES) return fail("The logo must be 4 MB or smaller.");

  const brand = await db.query.organization.findFirst({
    where: eq(organization.id, ctx.tenantId),
    columns: { metadata: true },
  });
  const theme = THEMES[readBusinessMetadata(brand?.metadata).theme];

  let warnings: string[];
  try {
    ({ warnings } = await saveLogo(
      ctx.tenantId,
      Buffer.from(await file.arrayBuffer()),
      theme.background,
    ));
  } catch (err) {
    if (err instanceof LogoError) return fail(err.message);
    console.error(err);
    return fail("Couldn't process that image. Try a PNG or SVG.");
  }
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "settings.logo_uploaded",
    targetType: "organization",
    targetId: ctx.tenantId,
    metadata: { fileName: file.name, bytes: file.size },
  });
  refresh(slug);
  return { ok: true, message: "Logo updated.", warnings };
}

export async function removeLogo(slug: string): Promise<SettingsResult> {
  const ctx = await requireSettingsAccess(slug);
  if (!ctx) return fail("Only administrators can change settings.");
  await deleteLogo(ctx.tenantId);
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "settings.logo_removed",
    targetType: "organization",
    targetId: ctx.tenantId,
  });
  refresh(slug);
  return { ok: true, message: "Logo removed." };
}

const applyFormSchema = z.object({
  enabled: z.boolean(),
  intro: z.string().trim().max(1000, "Keep the introduction under 1,000 characters."),
  services: z
    .array(z.string().trim().max(120, "Keep each service under 120 characters."))
    .transform((list) => [...new Set(list.filter(Boolean))])
    .pipe(z.array(z.string()).min(1, "List at least one service.").max(20, "Up to 20 services.")),
  hidden: z.array(z.enum(Object.keys(OPTIONAL_APPLY_QUESTIONS) as [OptionalApplyQuestion])),
});

/** Website Apply form: on/off, introduction, services list and which optional questions to ask. */
export async function saveApplyFormSettings(
  slug: string,
  raw: z.input<typeof applyFormSchema>,
): Promise<SettingsResult> {
  const ctx = await requireSettingsAccess(slug);
  if (!ctx) return fail("Only administrators can change settings.");
  const parsed = applyFormSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { enabled, intro, services, hidden } = parsed.data;

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, ctx.tenantId),
    columns: { metadata: true },
  });
  if (!org) return fail("Business not found.");
  let existing: Record<string, unknown> = {};
  try {
    existing = org.metadata ? JSON.parse(org.metadata) : {};
  } catch {}
  const metadata = {
    ...existing,
    services,
    applyForm: { enabled, hidden, intro: intro || DEFAULT_APPLY_INTRO },
  };
  try {
    await auth.api.updateOrganization({
      headers: await headers(),
      body: { organizationId: ctx.tenantId, data: { metadata } },
    });
  } catch (err) {
    if (err instanceof APIError) return fail(err.body?.message ?? err.message);
    throw err;
  }
  await writeAudit({
    tenantId: ctx.tenantId,
    actorUserId: ctx.userId,
    action: "settings.apply_form_updated",
    targetType: "organization",
    targetId: ctx.tenantId,
    metadata: { enabled, services, hidden },
  });
  refresh(slug);
  revalidatePath(`/${slug}/join`);
  revalidatePath(`/embed/${slug}/join`);
  return { ok: true, message: "Apply form saved." };
}
