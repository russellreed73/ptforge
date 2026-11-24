import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { programSummary } from "@/lib/programs";
import { requireTenant } from "@/server/auth/session";
import { listTemplates, programPermissions } from "@/server/programs/queries";
import { NewTemplateButton } from "./program-buttons";

export const metadata: Metadata = { title: "Programs" };

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function ProgramsPage({
  params,
  searchParams,
}: PageProps<"/[tenant]/programs">) {
  const ctx = await requireTenant((await params).tenant);
  if (!programPermissions(ctx).edit) notFound();
  const archived = (await searchParams).archived === "1";
  const templates = await listTemplates(ctx, { archived });
  const base = `/${ctx.tenantSlug}/programs`;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          eyebrow={ctx.tenantName}
          title={archived ? "Archived templates" : "Program templates"}
          description="Reusable blocks. Build one here, or save any client's block as a template, then load it when you start a new client's block from their profile."
        />
        {!archived && <NewTemplateButton slug={ctx.tenantSlug} />}
      </div>

      {templates.length === 0 ? (
        <p className="text-subtle border-border border p-8 text-center">
          {archived ? "No archived templates." : "No templates yet."}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <li
              key={t.id}
              className="border-border bg-surface hover:border-subtle relative border p-4 transition-colors"
            >
              <Link
                href={`${base}/${t.id}`}
                className="font-heading text-base font-semibold tracking-[0.06em] uppercase after:absolute after:inset-0"
              >
                {t.name}
              </Link>
              <p className="text-subtle mt-1 text-sm">{programSummary(t.content, t.weeks)}</p>
              <p className="text-muted mt-1 text-xs">
                {t.content.days.map((d) => d.title).join(" · ") || "No days yet"}
              </p>
              <p className="text-muted mt-2 text-xs">Updated {dateFmt.format(t.updatedAt)}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-sm">
        <Link
          href={archived ? base : `${base}?archived=1`}
          className="text-muted hover:text-primary underline underline-offset-4"
        >
          {archived ? "Back to templates" : "Archived templates"}
        </Link>
      </p>
    </main>
  );
}
