import { and, eq } from "drizzle-orm";
import { readBusinessMetadata } from "@/lib/themes";
import { db } from "../db";
import { businessAssets, organization } from "../db/schema";
import type { LogoAsset } from "./logo";

/** Name, slug, theme, default unit and logo version of a business (owner connection). */
export async function getBusinessBranding(tenantId: string) {
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, tenantId),
    columns: { id: true, name: true, slug: true, metadata: true },
  });
  if (!org) return null;
  const header = await db.query.businessAssets.findFirst({
    where: and(eq(businessAssets.tenantId, tenantId), eq(businessAssets.kind, "header")),
    columns: { updatedAt: true, width: true, height: true },
  });
  return {
    ...org,
    ...readBusinessMetadata(org.metadata),
    /** Changes whenever the logo changes, so browsers fetch the new one. */
    logoVersion: header ? header.updatedAt.getTime().toString(36) : null,
    logoSize: header ? { width: header.width, height: header.height } : null,
  };
}

export type BusinessBranding = NonNullable<Awaited<ReturnType<typeof getBusinessBranding>>>;

export function brandAssetUrl(slug: string, kind: LogoAsset, version: string | null) {
  return `/brand/${slug}/${kind}.png${version ? `?v=${version}` : ""}`;
}
