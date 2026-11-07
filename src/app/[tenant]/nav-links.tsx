"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Top navigation; the current page is shown in the theme's primary colour. */
export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-6">
      {links.map((l) => {
        const active = path === l.href;
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
