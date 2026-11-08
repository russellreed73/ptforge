import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplyForm } from "@/components/clients/apply-form";
import { Wordmark } from "@/components/ui";
import { getApplyForm } from "@/server/clients/apply";

/** Public: the business's website Apply form. No sign-in. */
export async function generateMetadata({ params }: PageProps<"/[tenant]/join">): Promise<Metadata> {
  const form = await getApplyForm((await params).tenant);
  return form
    ? { title: `Apply · ${form.name}`, description: form.intro, robots: { index: false } }
    : { title: "Not found" };
}

export default async function JoinPage({ params }: PageProps<"/[tenant]/join">) {
  const form = await getApplyForm((await params).tenant);
  if (!form) notFound();
  return (
    <div data-theme={form.theme} className="bg-background text-foreground flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <header className="mb-10">
          {form.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- served from our /brand route
            <img
              src={form.logo.src}
              alt={form.name}
              width={form.logo.width}
              height={form.logo.height}
              className="mb-8 h-14 w-auto"
            />
          ) : (
            <p className="font-heading mb-8 text-xl font-bold tracking-[0.06em] uppercase">
              {form.name}
            </p>
          )}
          <p className="eyebrow mb-3">Step 1</p>
          <h1 className="display text-5xl">Apply</h1>
          <p className="text-subtle mt-3 whitespace-pre-line">{form.intro}</p>
        </header>
        <div className="border-border bg-surface border p-6">
          <ApplyForm
            slug={form.slug}
            businessName={form.name}
            services={form.services}
            coaches={form.coaches}
            hidden={form.hidden}
          />
        </div>
        <div className="text-muted mt-8 flex items-center gap-2 text-xs">
          Powered by <Wordmark className="text-xs" />
        </div>
      </main>
    </div>
  );
}
