import { Card, PageHeader } from "@/components/ui";

/** Placeholder for pages that arrive in a later build step. */
export function ComingSoon({
  eyebrow,
  title,
  description,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <Card>
        <p className="font-heading text-primary mb-3 text-xs font-semibold tracking-[0.15em] uppercase">
          Coming next
        </p>
        <ul className="text-subtle list-disc space-y-1.5 pl-5">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
