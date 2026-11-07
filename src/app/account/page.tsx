import type { Metadata } from "next";
import { Card, PageHeader, TextLink, Wordmark } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { TwoFactorSettings } from "./two-factor-settings";

export const metadata: Metadata = { title: "Account security" };

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const user = await requireUser();
  const back = (await searchParams).back;
  const backHref =
    typeof back === "string" && back.startsWith("/") && !back.startsWith("//") ? back : "/";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <div className="mb-10 flex items-center justify-between">
        <Wordmark />
        <TextLink href={backHref}>Back</TextLink>
      </div>
      <PageHeader
        eyebrow="Your account"
        title="Security"
        description={`Signed in as ${user.email}`}
      />
      <Card>
        <TwoFactorSettings enabled={Boolean(user.twoFactorEnabled)} />
      </Card>
      <p className="text-muted mt-6 text-sm">
        To change your password, sign out and use{" "}
        <TextLink href="/forgot-password">Forgot password</TextLink>.
      </p>
    </main>
  );
}
