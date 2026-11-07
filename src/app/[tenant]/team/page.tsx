import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold">Team</h1>
      <p className="mt-1 text-slate-500">
        {isAdmin
          ? "Invite people, change their roles, or remove them."
          : "Invite people to join this business."}
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Invite someone</h2>
        <InviteForm slug={ctx.tenantSlug} allowedRoles={invitableRoles(ctx.roles)} />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">
          Pending invitations{" "}
          <span className="font-normal text-slate-500">({invitations.length})</span>
        </h2>
        {invitations.length === 0 ? (
          <p className="text-sm text-slate-500">No pending invitations.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
              <tr>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Invited by</th>
                <th className="py-2">Expires</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-900">
                  <td className="py-2 font-medium">{inv.email}</td>
                  <td className="py-2">{describeRoles(inv.roles)}</td>
                  <td className="py-2">{inv.sentByMe ? "You" : (inv.inviterName ?? "—")}</td>
                  <td className="py-2">{date.format(inv.expiresAt)}</td>
                  <td className="py-2 text-right">
                    <InvitationActions
                      slug={ctx.tenantSlug}
                      invitationId={inv.id}
                      canCancel={canCancel}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">
          Members <span className="font-normal text-slate-500">({members.length})</span>
        </h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
            <tr>
              <th className="py-2">Name</th>
              <th className="py-2">Email</th>
              <th className="py-2">Role</th>
              <th className="py-2">Joined</th>
              {isAdmin && <th className="py-2" />}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.memberId} className="border-b border-slate-100 dark:border-slate-900">
                <td className="py-2 font-medium">
                  {m.name}
                  {m.userId === ctx.userId && <span className="text-slate-500"> (you)</span>}
                </td>
                <td className="py-2">{m.email}</td>
                <td className="py-2">{describeRoles(m.roles)}</td>
                <td className="py-2">{date.format(m.joinedAt)}</td>
                {isAdmin && (
                  <td className="py-2 text-right">
                    {m.userId !== ctx.userId && (
                      <MemberActions
                        slug={ctx.tenantSlug}
                        memberId={m.memberId}
                        name={m.name}
                        roles={m.roles}
                      />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!can(ctx.roles, { athlete: ["view_all"] }) && (
          <p className="mt-3 text-xs text-slate-500">
            Athletes are listed under Clients, not here.
          </p>
        )}
      </section>
    </main>
  );
}
