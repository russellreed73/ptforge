import { eq } from "drizzle-orm";
import { SignOutButton } from "@/components/sign-out-button";
import { describeRoles } from "@/lib/roles";
import { themeForBusiness } from "@/lib/themes";
import { can } from "@/server/auth/permissions";
import { requireTenant } from "@/server/auth/session";
import { db } from "@/server/db";
import { organization } from "@/server/db/schema";
import { NavLinks } from "./nav-links";

export default async function TenantLayout({ children, params }: LayoutProps<"/[tenant]">) {
  const { tenant } = await params;
  const ctx = await requireTenant(tenant);
  const base = `/${ctx.tenantSlug}`;
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, ctx.tenantId),
    columns: { metadata: true },
  });

  // Full navigation arrives in phase 1 step 4 (app shell).
  const links = [
    { href: base, label: "Dashboard" },
    ...(can(ctx.roles, { invitation: ["create"] })
      ? [{ href: `${base}/team`, label: "Team" }]
      : []),
  ];

  return (
    // Each business can have its own theme (chosen in Settings, coming in step 4).
    <div
      data-theme={themeForBusiness(org?.metadata)}
      className="bg-background text-foreground flex flex-1 flex-col"
    >
      <header className="border-border bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-8">
            <a href={base} className="font-heading text-xl font-bold tracking-[0.06em] uppercase">
              {ctx.tenantName}
            </a>
            <NavLinks links={links} />
          </div>
          <div className="flex items-center gap-5">
            <span className="font-heading text-muted hidden text-xs tracking-[0.15em] uppercase sm:inline">
              {describeRoles(ctx.roles)}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
