import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { can } from "@/server/auth/permissions";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Exercises" };

export default async function ExercisesPage({ params }: PageProps<"/[tenant]/exercises">) {
  const ctx = await requireTenant((await params).tenant);
  if (!can(ctx.roles, { athlete: ["create"] })) notFound();
  return (
    <ComingSoon
      eyebrow={ctx.tenantName}
      title="Exercises"
      description="Your exercise library and demo videos."
      items={[
        "Exercise library with categories, cues and equipment",
        "Import from a spreadsheet",
        "Demo videos (Cloudflare Stream) attached to each exercise",
      ]}
    />
  );
}
