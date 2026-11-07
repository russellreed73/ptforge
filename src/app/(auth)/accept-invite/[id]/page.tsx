import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/ui";
import { describeRoles } from "@/lib/roles";
import { getSession } from "@/server/auth/session";
import { getInvitationForAcceptPage } from "@/server/team/queries";
import { AcceptInvite } from "./accept-client";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function AcceptInvitePage({ params }: PageProps<"/accept-invite/[id]">) {
  const { id } = await params;
  const inv = await getInvitationForAcceptPage(id);

  if (!inv || inv.status === "canceled" || inv.status === "rejected") {
    return (
      <AuthCard title="Invitation not found">
        <p>
          This invitation link isn&apos;t valid any more. Ask the person who invited you to send a
          new one.
        </p>
      </AuthCard>
    );
  }
  if (inv.status === "accepted") {
    return (
      <AuthCard title="Already accepted">
        <p>
          This invitation has already been used.{" "}
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>{" "}
          to open {inv.businessName}.
        </p>
      </AuthCard>
    );
  }
  if (inv.expired) {
    return (
      <AuthCard title="Invitation expired">
        <p>
          This invitation to {inv.businessName} has expired. Ask {inv.inviterName ?? "your coach"}{" "}
          to send a new one.
        </p>
      </AuthCard>
    );
  }

  const session = await getSession();
  return (
    <AuthCard title={`Join ${inv.businessName}`}>
      <p>
        {inv.inviterName ?? "Someone"} invited <strong>{inv.email}</strong> to join{" "}
        {inv.businessName} as {describeRoles(inv.roles).toLowerCase()}.
      </p>
      <AcceptInvite
        invitationId={inv.id}
        email={inv.email}
        businessSlug={inv.businessSlug}
        hasAccount={inv.hasAccount}
        signedInEmail={session?.user.email ?? null}
      />
    </AuthCard>
  );
}
