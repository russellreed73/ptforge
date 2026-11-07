import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/*
 * Shared building blocks. They only use theme colours (see globals.css), so
 * pages pick up whichever theme is active.
 */

export function Field({
  label,
  hint,
  ...input
}: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-heading text-subtle text-xs font-semibold tracking-[0.15em] uppercase">
        {label}
      </span>
      <input
        className="border-border bg-surface text-foreground placeholder:text-muted focus:border-primary rounded-none border px-3 py-2.5 text-base focus:outline-none disabled:opacity-60"
        {...input}
      />
      {hint && <span className="text-muted text-xs">{hint}</span>}
    </label>
  );
}

const buttonBase =
  "btn-shape inline-flex items-center justify-center px-6 py-2.5 font-heading text-sm font-semibold tracking-[0.15em] uppercase transition-colors disabled:opacity-50";

const buttonVariants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "border border-border text-foreground hover:border-subtle [clip-path:none]",
  accent: "bg-accent text-primary-foreground hover:bg-accent-hover",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonVariants }) {
  return <button className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonVariants }) {
  return <Link className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />;
}

/** Small text button for table rows. */
export function TextButton({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      className={`font-heading text-subtle hover:text-primary px-2 py-1 text-xs font-semibold tracking-[0.12em] uppercase disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-danger text-sm">
      {children}
    </p>
  );
}

export function SuccessText({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="status" className="text-success text-sm">
      {children}
    </p>
  );
}

export function TextLink(props: ComponentProps<typeof Link>) {
  return (
    <Link className="text-foreground decoration-primary underline underline-offset-4" {...props} />
  );
}

/** Page title with the red label above it, like Jacob's site. */
export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
}) {
  return (
    <header className="mb-8">
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h1 className="display text-5xl">{title}</h1>
      {description && <p className="text-subtle mt-3 max-w-2xl">{description}</p>}
    </header>
  );
}

export function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h2 className="font-heading mb-4 text-lg font-bold tracking-[0.12em] uppercase">
      {children}
      {count !== undefined && <span className="text-muted ml-2 font-normal">({count})</span>}
    </h2>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`border-border bg-surface border p-5 ${className}`} {...props} />;
}

/* Tables */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="border-border overflow-x-auto border">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`border-border bg-surface font-heading text-muted border-b px-4 py-3 text-xs font-semibold tracking-[0.15em] uppercase ${className}`}
    >
      {children}
    </th>
  );
}
export function Td({ children, className = "", ...props }: ComponentProps<"td">) {
  return (
    <td className={`border-border border-b px-4 py-3 ${className}`} {...props}>
      {children}
    </td>
  );
}

/** Full-height centred card for sign-in, sign-up, invitations. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div>
        <Wordmark className="mb-6" />
        <h1 className="display text-4xl">{title}</h1>
      </div>
      <div className="border-border bg-surface flex flex-col gap-4 border p-6">{children}</div>
    </main>
  );
}

/** "PTFORGE" with the second half in the theme's primary colour. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <p className={`font-heading text-xl font-semibold tracking-[0.08em] ${className}`}>
      PT<span className="text-primary">FORGE</span>
    </p>
  );
}
