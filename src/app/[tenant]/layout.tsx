import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { UnitProvider, UnitToggle } from "@/components/unit";
import { describeRoles } from "@/lib/roles";
import { THEMES } from "@/lib/themes";
import { isUnit } from "@/lib/units";
import { can } from "@/server/auth/permissions";
import { getSession, requireTenant } from "@/server/auth/session";
import { isStaff } from "@/server/auth/session-policy";
import { brandAssetUrl, getBusinessBranding } from "@/server/brand/queries";
import { MobileMenu, NavLinks } from "./nav-links";

/** Phone home-screen name, icon and colours come from the business's Settings. */
export async function generateMetadata({ params }: LayoutProps<"/[tenant]">): Promise<Metadata> {
  const { tenant } = await params;
  const ctx = await requireTenant(tenant);
  const brand = await getBusinessBranding(ctx.tenantId);
  if (!brand) return {};
  return {
    title: { template: `%s · ${brand.name}`, default: brand.name },
    manifest: `/brand/${brand.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: brand.name, statusBarStyle: "black-translucent" },
    icons: brand.logoVersion
      ? {
          icon: [
            { url: brandAssetUrl(brand.slug, "icon-192", brand.logoVersion), sizes: "192x192" },
          ],
          apple: [
            { url: brandAssetUrl(brand.slug, "apple-180", brand.logoVersion), sizes: "180x180" },
          ],
        }
      : undefined,
  };
}

export async function generateViewport({ params }: LayoutProps<"/[tenant]">): Promise<Viewport> {
  const { tenant } = await params;
  const ctx = await requireTenant(tenant);
  const brand = await getBusinessBranding(ctx.tenantId);
  return { themeColor: THEMES[brand?.theme ?? "next-level"].background };
}

export default async function TenantLayout({ children, params }: LayoutProps<"/[tenant]">) {
  const { tenant } = await params;
  const ctx = await requireTenant(tenant);
  const base = `/${ctx.tenantSlug}`;
  const session = await getSession();
  const brand = await getBusinessBranding(ctx.tenantId);
  const theme = brand?.theme ?? "next-level";
  const unit = isUnit(session?.user.preferredUnit) ? session.user.preferredUnit : "kg";
  const suggestTwoFactor = isStaff(ctx.roles) && !session?.user.twoFactorEnabled;
  const accountHref = `/account?back=${encodeURIComponent(base)}`;

  // Each link appears only for roles that can use it. Pages check again on the server.
  const staff = can(ctx.roles, { athlete: ["create"] });
  const links = [
    { href: base, label: "Dashboard" },
    ...(staff ? [{ href: `${base}/clients`, label: "Clients" }] : []),
    ...(staff ? [{ href: `${base}/exercises`, label: "Exercises" }] : []),
    ...(can(ctx.roles, { invitation: ["create"] })
      ? [{ href: `${base}/team`, label: "Team" }]
      : []),
    ...(can(ctx.roles, { settings: ["update"] })
      ? [{ href: `${base}/settings`, label: "Settings" }]
      : []),
  ];

  const accountControls = (
    <>
      <UnitToggle />
      <Link
        href={accountHref}
        className="font-heading text-subtle hover:text-primary text-xs font-semibold tracking-[0.15em] uppercase"
      >
        Account
      </Link>
      <SignOutButton />
    </>
  );

  return (
    <UnitProvider unit={unit}>
      <div data-theme={theme} className="bg-background text-foreground flex flex-1 flex-col">
        <header className="border-border bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
          <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
            <div className="flex min-w-0 items-center gap-8">
              <a
                href={base}
                className="flex min-w-0 items-center"
                aria-label={`${ctx.tenantName} home`}
              >
                {brand?.logoVersion && brand.logoSize ? (
                  // eslint-disable-next-line @next/next/no-img-element -- served from our own /brand route
                  <img
                    src={brandAssetUrl(brand.slug, "header", brand.logoVersion)}
                    alt={ctx.tenantName}
                    width={brand.logoSize.width}
                    height={brand.logoSize.height}
                    className="h-10 w-auto max-w-[200px] object-contain"
                  />
                ) : (
                  <span className="font-heading truncate text-xl font-bold tracking-[0.06em] uppercase">
                    {ctx.tenantName}
                  </span>
                )}
              </a>
              <NavLinks links={links} base={base} />
            </div>
            <div className="hidden items-center gap-5 md:flex">
              <span className="font-heading text-muted hidden text-xs tracking-[0.15em] uppercase lg:inline">
                {describeRoles(ctx.roles)}
              </span>
              {accountControls}
            </div>
            <MobileMenu links={links} base={base} extra={accountControls} />
          </div>
        </header>
        {suggestTwoFactor && (
          <div className="border-border bg-surface border-b">
            <p className="text-subtle mx-auto max-w-6xl px-6 py-2.5 text-sm">
              <span className="font-heading text-primary font-semibold tracking-[0.12em] uppercase">
                Protect your clients&apos; data:
              </span>{" "}
              turn on two-step login so a stolen password isn&apos;t enough to get in.{" "}
              <Link
                href={accountHref}
                className="text-foreground decoration-primary underline underline-offset-4"
              >
                Set it up
              </Link>
            </p>
          </div>
        )}
        {children}
      </div>
    </UnitProvider>
  );
}
