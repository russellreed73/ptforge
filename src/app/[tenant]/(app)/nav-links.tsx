"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

type NavLink = { href: string; label: string };

function isActive(path: string, href: string, base: string) {
  return href === base ? path === base : path === href || path.startsWith(`${href}/`);
}

/** Top navigation on wide screens; the current page is shown in the theme's primary colour. */
export function NavLinks({ links, base }: { links: NavLink[]; base: string }) {
  const path = usePathname();
  return (
    <nav className="hidden gap-5 lg:flex xl:gap-6">
      {links.map((l) => {
        const active = isActive(path, l.href, base);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`font-heading text-sm font-semibold tracking-[0.15em] uppercase transition-colors ${
              active ? "text-primary" : "text-subtle hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Menu button and drop-down for phones. `extra` holds the account controls. */
export function MobileMenu({
  links,
  base,
  extra,
}: {
  links: NavLink[];
  base: string;
  extra: ReactNode;
}) {
  const path = usePathname();
  // Remember which page the menu was opened on, so it closes after navigating.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;

  return (
    <div className="lg:hidden">
      <button
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpenOn(open ? null : path)}
        className="font-heading text-subtle hover:text-foreground border-border border px-3 py-1.5 text-xs font-semibold tracking-[0.15em] uppercase"
      >
        {open ? "Close" : "Menu"}
      </button>
      {open && (
        <div
          id="mobile-menu"
          className="border-border bg-background absolute inset-x-0 top-full border-b px-6 pt-2 pb-6 shadow-lg"
        >
          <nav className="flex flex-col">
            {links.map((l) => {
              const active = isActive(path, l.href, base);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`font-heading border-border border-b py-3 text-base font-semibold tracking-[0.15em] uppercase ${
                    active ? "text-primary" : "text-foreground"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-5 flex flex-wrap items-center gap-5">{extra}</div>
        </div>
      )}
    </div>
  );
}
