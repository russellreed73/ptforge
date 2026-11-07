import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { THEMES } from "@/lib/themes";
import { can } from "@/server/auth/permissions";
import { requireTenant } from "@/server/auth/session";
import { brandAssetUrl, getBusinessBranding } from "@/server/brand/queries";
import { BusinessDetailsForm, LogoForm } from "./settings-client";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/[tenant]/settings">) {
  const ctx = await requireTenant((await params).tenant);
  if (!can(ctx.roles, { settings: ["update"] })) notFound();
  const brand = await getBusinessBranding(ctx.tenantId);
  if (!brand) notFound();

  const themes = Object.entries(THEMES).map(([id, t]) => ({ id, ...t }));
  const logo = brand.logoVersion
    ? {
        header: brandAssetUrl(brand.slug, "header", brand.logoVersion),
        icon: brandAssetUrl(brand.slug, "maskable-512", brand.logoVersion),
        apple: brandAssetUrl(brand.slug, "apple-180", brand.logoVersion),
      }
    : null;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <PageHeader
        eyebrow={ctx.tenantName}
        title="Settings"
        description="How your business looks to your team and your clients."
      />

      <section className="mb-12">
        <SectionTitle>Business</SectionTitle>
        <Card>
          <BusinessDetailsForm
            slug={brand.slug}
            initial={{ name: brand.name, theme: brand.theme, defaultUnit: brand.defaultUnit }}
            themes={themes}
          />
        </Card>
      </section>

      <section>
        <SectionTitle>Logo and phone app icon</SectionTitle>
        <Card>
          <LogoForm slug={brand.slug} logo={logo} name={brand.name} />
        </Card>
      </section>
    </main>
  );
}
