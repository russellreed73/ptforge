import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, SectionTitle, Table, Td, Th } from "@/components/ui";
import { describeRoles } from "@/lib/roles";
import { can, invitableRoles } from "@/server/auth/permissions";
import { requireTenant } from "@/server/auth/session";
import { listMembers, listPendingInvitations } from "@/server/team/queries";
import { InvitationActions, InviteForm, MemberActions } from "./team-client";

export const metadata: Metadata = { title: "Team" };

const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });

export default async function TeamPage({ params }: PageProps<"/[tenant]/team">) {
  const { tenant } = await params;
  const ctx = await requireTenant(tenant);
  if (!can(ctx.roles, { invitation: ["create"] })) notFound();

  const [members, invitations] = await Promise.all([listMembers(ctx), listPendingInvitations(ctx)]);
  const isAdmin = can(ctx.roles, { member: ["update"] });
  const canCancel = can(ctx.roles, { invitation: ["cancel"] });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <PageHeader
        eyebrow={ctx.tenantName}
        title="Team"
        description={
          isAdmin
            ? "Invite people, change their roles, or remove them."
            : "Invite people to join this business."
        }
      />

      <section>
        <SectionTitle>Invite someone</SectionTitle>
        <InviteForm slug={ctx.tenantSlug} allowedRoles={invitableRoles(ctx.roles)} />
      </section>

      <section className="mt-12">
        <SectionTitle count={invitations.length}>Pending invitations</SectionTitle>
        {invitations.length === 0 ? (
          <p className="text-muted text-sm">No pending invitations.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Invited by</Th>
                <Th>Expires</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id}>
                  <Td className="font-semibold">{inv.email}</Td>
                  <Td className="text-subtle">{describeRoles(inv.roles)}</Td>
                  <Td className="text-subtle">{inv.sentByMe ? "You" : (inv.inviterName ?? "—")}</Td>
                  <Td className="text-subtle">{date.format(inv.expiresAt)}</Td>
                  <Td className="text-right">
                    <InvitationActions
                      slug={ctx.tenantSlug}
                      invitationId={inv.id}
                      canCancel={canCancel}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section className="mt-12">
        <SectionTitle count={members.length}>Members</SectionTitle>
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Joined</Th>
              {isAdmin && <Th />}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.memberId}>
                <Td className="font-semibold">
                  {m.name}
                  {m.userId === ctx.userId && (
                    <span className="text-muted font-normal"> (you)</span>
                  )}
                </Td>
                <Td className="text-subtle">{m.email}</Td>
                <Td className="text-subtle">{describeRoles(m.roles)}</Td>
                <Td className="text-subtle">{date.format(m.joinedAt)}</Td>
                {isAdmin && (
                  <Td className="text-right">
                    {m.userId !== ctx.userId && (
                      <MemberActions
                        slug={ctx.tenantSlug}
                        memberId={m.memberId}
                        name={m.name}
                        roles={m.roles}
                      />
                    )}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
        {!can(ctx.roles, { athlete: ["view_all"] }) && (
          <p className="text-muted mt-3 text-xs">Athletes are listed under Clients, not here.</p>
        )}
      </section>
    </main>
  );
}
