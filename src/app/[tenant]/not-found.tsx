import { ButtonLink } from "@/components/ui";

export default function TenantNotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-start justify-center gap-4 px-6 py-16">
      <p className="eyebrow">404</p>
      <h1 className="display text-5xl">Not found</h1>
      <p className="text-subtle">This business doesn&apos;t exist, or you aren&apos;t a member.</p>
      <ButtonLink href="/">Back to your businesses</ButtonLink>
    </main>
  );
}
