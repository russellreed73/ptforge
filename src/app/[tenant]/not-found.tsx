import Link from "next/link";

export default function TenantNotFound() {
  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-xl font-bold">Not found</h1>
      <p className="mt-2 text-slate-500">
        This business doesn&apos;t exist, or you aren&apos;t a member.
      </p>
      <Link href="/" className="mt-6 inline-block underline">
        Back to your businesses
      </Link>
    </main>
  );
}
