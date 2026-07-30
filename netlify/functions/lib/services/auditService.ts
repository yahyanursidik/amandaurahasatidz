import { getDbClient } from "../db/client";
import { auditLogs } from "../db/schema";
import { logError, logInfo } from "../utils/logger";

export interface AuditLogInput {
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  eventId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  reason?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  requestId: string;
}

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    logInfo(input.requestId, `[AUDIT LOG] ${input.action} on ${input.resourceType}`, {
      actor: input.actorUserId,
      reason: input.reason,
    });

    const db = getDbClient();
    await db.insert(auditLogs).values({
      actorUserId: input.actorUserId || null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId || null,
      eventId: input.eventId || null,
      beforeData: input.beforeData || null,
      afterData: input.afterData || null,
      reason: input.reason || null,
      ipHash: input.ipHash || null,
      userAgent: input.userAgent || null,
      requestId: input.requestId,
    });
  } catch (error) {
    logError(input.requestId, "Failed to write audit log entry to database", error);
  }
}
