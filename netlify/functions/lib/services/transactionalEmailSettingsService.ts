import { eq, sql } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { emailTemplates } from "../db/schema";
import { ConflictError } from "../utils/errors";
import { createAuditLog } from "./auditService";
import {
  parseTransactionalEmailCopy,
  TRANSACTIONAL_EMAIL_COPY_CODE,
  type TransactionalEmailCopy,
} from "./transactionalEmailCopy";

export async function getTransactionalEmailSettings() {
  const [row] = await getDbClient().select({ bodyTemplate: emailTemplates.bodyTemplate,
    version: emailTemplates.version, updatedAt: emailTemplates.updatedAt })
    .from(emailTemplates).where(eq(emailTemplates.code, TRANSACTIONAL_EMAIL_COPY_CODE)).limit(1);
  return { settings: parseTransactionalEmailCopy(row?.bodyTemplate), version: row?.version ?? null,
    updatedAt: row?.updatedAt ?? null };
}

export async function saveTransactionalEmailSettings(
  settings: TransactionalEmailCopy,
  expectedVersion: number | null,
  actorUserId: string,
  requestId: string,
) {
  const previous = await getTransactionalEmailSettings();
  if (previous.version !== expectedVersion) {
    throw new ConflictError("Pengaturan email telah diubah di tempat lain. Muat ulang halaman sebelum menyimpan.");
  }
  const db = getDbClient();
  const values = { bodyTemplate: JSON.stringify(settings), updatedAt: new Date() };
  const [row] = expectedVersion === null
    ? await db.insert(emailTemplates).values({ code: TRANSACTIONAL_EMAIL_COPY_CODE,
      name: "Pembuka email transaksional", subjectTemplate: "GLOBAL_COPY", ...values, status: "ACTIVE" })
      .onConflictDoNothing({ target: emailTemplates.code }).returning({ version: emailTemplates.version, updatedAt: emailTemplates.updatedAt })
    : await db.update(emailTemplates).set({ ...values, version: sql`${emailTemplates.version} + 1` })
      .where(sql`${emailTemplates.code} = ${TRANSACTIONAL_EMAIL_COPY_CODE} AND ${emailTemplates.version} = ${expectedVersion}`)
      .returning({ version: emailTemplates.version, updatedAt: emailTemplates.updatedAt });
  if (!row) throw new ConflictError("Pengaturan email berubah saat disimpan. Muat ulang halaman dan coba lagi.");
  await createAuditLog({ actorUserId, action: "TRANSACTIONAL_EMAIL_COPY_UPDATED", resourceType: "EMAIL_TEMPLATE",
    beforeData: previous.settings, afterData: settings, requestId });
  return { settings, version: row.version, updatedAt: row.updatedAt };
}
