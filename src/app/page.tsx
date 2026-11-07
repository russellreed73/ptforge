import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, listMyTenants } from "@/server/auth/session";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16">
        <h1 className="text-4xl font-bold">PTForge</h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Clients, programs, workout logging and progress for personal trainers and strength
          coaches, with a phone app your athletes will actually use.
        </p>
        <div className="flex gap-3">
          <Link
            href="/sign-in"
            className="rounded-md bg-slate-900 px-4 py-2 text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md border border-slate-300 px-4 py-2 dark:border-slate-700"
          >
            Create your business
          </Link>
        </div>
      </main>
    );
  }

  const tenants = await listMyTenants(session.user.id);
  if (tenants.length === 1) redirect(`/${tenants[0].slug}`);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
      <h1 className="mb-6 text-2xl font-bold">Choose a business</h1>
      {tenants.length === 0 ? (
        <p className="text-slate-500">
          You aren&apos;t part of a coaching business yet. Ask your coach for an invitation, or{" "}
          <Link href="/welcome" className="underline">
            create your own
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {tenants.map((t) => (
            <li key={t.id}>
              <Link
                href={`/${t.slug}`}
                className="flex justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                <span className="font-medium">{t.name}</span>
                <span className="text-sm text-slate-500">{t.roles.join(", ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
