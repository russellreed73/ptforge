import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { describeRoles } from "@/lib/roles";
import { can } from "@/server/auth/permissions";
import { requireTenant } from "@/server/auth/session";

export default async function TenantLayout({ children, params }: LayoutProps<"/[tenant]">) {
  const { tenant } = await params;
  const ctx = await requireTenant(tenant);
  const base = `/${ctx.tenantSlug}`;

  // Full navigation arrives in phase 1 step 4 (app shell).
  const links = [
    { href: base, label: "Dashboard" },
    ...(can(ctx.roles, { invitation: ["create"] })
      ? [{ href: `${base}/team`, label: "Team" }]
      : []),
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-3 dark:border-slate-800">
        <div className="flex items-center gap-6">
          <Link href={base} className="font-semibold">
            {ctx.tenantName}
          </Link>
          <nav className="flex gap-4 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-slate-600 hover:underline dark:text-slate-300"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span>{describeRoles(ctx.roles)}</span>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
