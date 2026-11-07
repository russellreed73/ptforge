import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { businessAssets } from "../db/schema";
import { generateLogoAssets } from "./logo";

/**
 * The uploaded file is kept as kind "source" (never served: the /brand route
 * only serves LOGO_ASSETS) so the icons can be rebuilt when the theme's
 * background colour changes.
 */
const SOURCE = "source";

/** Builds every logo size from `input` and replaces the business's stored set. */
export async function saveLogo(tenantId: string, input: Buffer, background: string) {
  const { images, warnings } = await generateLogoAssets(input, background);
  const now = new Date();
  const rows = [
    ...images.map((img) => ({ tenantId, ...img, updatedAt: now })),
    {
      tenantId,
      kind: SOURCE,
      contentType: "application/octet-stream",
      width: 0,
      height: 0,
      data: input,
      updatedAt: now,
    },
  ];
  await db.transaction(async (tx) => {
    for (const row of rows) {
      await tx
        .insert(businessAssets)
        .values(row)
        .onConflictDoUpdate({ target: [businessAssets.tenantId, businessAssets.kind], set: row });
    }
  });
  return { warnings };
}

/** Rebuilds the icons on a new background colour, if the business has a logo. */
export async function rebuildLogo(tenantId: string, background: string) {
  const source = await db.query.businessAssets.findFirst({
    where: and(eq(businessAssets.tenantId, tenantId), eq(businessAssets.kind, SOURCE)),
    columns: { data: true },
  });
  if (source) await saveLogo(tenantId, Buffer.from(source.data), background);
}

export async function deleteLogo(tenantId: string) {
  await db.delete(businessAssets).where(eq(businessAssets.tenantId, tenantId));
}
