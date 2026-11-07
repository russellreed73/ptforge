import { db } from "./db";
import { auditLogs } from "./db/schema";

export type AuditEntry = {
  tenantId: string;
  actorUserId: string | null;
  /** e.g. "invitation.created", "member.roles_changed" */
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Records who did what. Written with the owner connection because some
 * entries come from Better Auth hooks that run outside a tenant transaction.
 * Never throws: a failed audit write must not break the action itself.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      tenantId: entry.tenantId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata,
    });
  } catch (err) {
    console.error("[audit] failed to record", entry.action, err);
  }
}
