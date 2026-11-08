import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplyForm } from "@/components/clients/apply-form";
import { getApplyForm } from "@/server/clients/apply";

/**
 * The Apply form with no page around it, for an <iframe> on the coach's own
 * website. next.config.ts lets only /embed/ pages be framed by other sites.
 */
export const metadata: Metadata = { title: "Apply", robots: { index: false } };

export default async function EmbedJoinPage({ params }: PageProps<"/embed/[tenant]/join">) {
  const form = await getApplyForm((await params).tenant);
  if (!form) notFound();
  return (
    <div data-theme={form.theme} className="bg-background text-foreground p-4 sm:p-6">
      <ApplyForm
        slug={form.slug}
        businessName={form.name}
        services={form.services}
        coaches={form.coaches}
        hidden={form.hidden}
        embedded
      />
    </div>
  );
}
