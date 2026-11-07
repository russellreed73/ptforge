import { and, eq, isNull, sql } from "drizzle-orm";
import { writeAudit } from "../audit";
import { parseRoles } from "../auth/permissions";
import { db } from "../db";
import { athleteProfiles, athleteTrainers, member } from "../db/schema";

/**
 * Runs after someone accepts an invitation (Better Auth hook, owner
 * connection). For athletes, connects their login to a client profile:
 *   - an existing profile in this business with the same email is linked;
 *   - otherwise a profile is created from their name;
 *   - if a trainer (not an admin or manager) sent the invitation, that trainer
 *     is assigned to the athlete so they can see them straight away.
 */
export async function onInvitationAccepted(input: {
  tenantId: string;
  userId: string;
  userName: string;
  email: string;
  role: string;
  inviterId: string;
  invitationId: string;
}) {
  const roles = parseRoles(input.role);
  await writeAudit({
    tenantId: input.tenantId,
    actorUserId: input.userId,
    action: "invitation.accepted",
    targetType: "invitation",
    targetId: input.invitationId,
    metadata: { roles },
  });
  if (!roles.includes("athlete")) return;

  await db.transaction(async (tx) => {
    const email = input.email.toLowerCase();
    let [profile] = await tx
      .select({ id: athleteProfiles.id })
      .from(athleteProfiles)
      .where(
        and(
          eq(athleteProfiles.tenantId, input.tenantId),
          sql`lower(${athleteProfiles.email}) = ${email}`,
        ),
      )
      .limit(1);

    if (profile) {
      await tx
        .update(athleteProfiles)
        .set({ userId: input.userId, status: "active" })
        .where(and(eq(athleteProfiles.id, profile.id), isNull(athleteProfiles.userId)));
    } else {
      const [first, ...rest] = input.userName.trim().split(/\s+/);
      [profile] = await tx
        .insert(athleteProfiles)
        .values({
          tenantId: input.tenantId,
          userId: input.userId,
          firstName: first || input.userName,
          lastName: rest.join(" "),
          email,
        })
        .returning({ id: athleteProfiles.id });
    }

    const inviter = await tx.query.member.findFirst({
      where: and(eq(member.organizationId, input.tenantId), eq(member.userId, input.inviterId)),
    });
    const inviterRoles = parseRoles(inviter?.role);
    const inviterSeesAll = inviterRoles.includes("admin") || inviterRoles.includes("manager");
    if (inviterRoles.includes("trainer") && !inviterSeesAll) {
      await tx
        .insert(athleteTrainers)
        .values({
          tenantId: input.tenantId,
          athleteProfileId: profile.id,
          trainerUserId: input.inviterId,
          assignedBy: input.inviterId,
        })
        .onConflictDoNothing();
    }
  });
}
