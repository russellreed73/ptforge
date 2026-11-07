import { and, eq } from "drizzle-orm";
import { THEMES } from "@/lib/themes";
import { brandAssetUrl, getBusinessBranding } from "@/server/brand/queries";
import { LOGO_ASSETS, type LogoAsset } from "@/server/brand/logo";
import { db } from "@/server/db";
import { businessAssets, organization } from "@/server/db/schema";

/**
 * Public branding for a business (no sign-in needed: emails and phone home
 * screens fetch these):
 *   /brand/<slug>/header.png, icon-192.png, icon-512.png, maskable-512.png, apple-180.png
 *   /brand/<slug>/manifest.webmanifest   (name, colours and icons for the phone app)
 * Logos are public by nature; nothing else about the business is exposed.
 */
export async function GET(_req: Request, { params }: RouteContext<"/brand/[tenant]/[file]">) {
  const { tenant, file } = await params;
  const org = await db.query.organization.findFirst({
    where: eq(organization.slug, tenant),
    columns: { id: true },
  });
  if (!org) return new Response("Not found", { status: 404 });

  if (file === "manifest.webmanifest") return manifest(org.id);

  const kind = file.replace(/\.png$/, "") as LogoAsset;
  if (!file.endsWith(".png") || !LOGO_ASSETS.includes(kind)) {
    return new Response("Not found", { status: 404 });
  }
  const asset = await db.query.businessAssets.findFirst({
    where: and(eq(businessAssets.tenantId, org.id), eq(businessAssets.kind, kind)),
  });
  if (!asset) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.contentType,
      // URLs carry ?v=<version>, so a new logo gets a new URL.
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function manifest(tenantId: string) {
  const brand = await getBusinessBranding(tenantId);
  if (!brand) return new Response("Not found", { status: 404 });
  const theme = THEMES[brand.theme];
  const icon = (kind: LogoAsset, size: number, purpose: "any" | "maskable") => ({
    src: brandAssetUrl(brand.slug, kind, brand.logoVersion),
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose,
  });
  const body = {
    id: `/${brand.slug}`,
    name: brand.name,
    short_name: brand.name.length > 12 ? brand.name.split(" ")[0] : brand.name,
    start_url: `/${brand.slug}`,
    scope: `/${brand.slug}`,
    display: "standalone",
    background_color: theme.background,
    theme_color: theme.background,
    icons: brand.logoVersion
      ? [
          icon("icon-192", 192, "any"),
          icon("icon-512", 512, "any"),
          icon("maskable-512", 512, "maskable"),
        ]
      : [],
  };
  return Response.json(body, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
