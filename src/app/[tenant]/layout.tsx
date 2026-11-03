import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireTenant } from "@/server/auth/session";

export default async function TenantLayout({ children, params }: LayoutProps<"/[tenant]">) {
  const { tenant } = await params;
  const ctx = await requireTenant(tenant);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-3 dark:border-slate-800">
        <Link href={`/${ctx.tenantSlug}`} className="font-semibold">
          {ctx.tenantName}
        </Link>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span>{ctx.roles.join(", ")}</span>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
