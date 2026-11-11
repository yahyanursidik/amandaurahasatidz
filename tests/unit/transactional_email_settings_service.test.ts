import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TRANSACTIONAL_EMAIL_COPY } from "../../netlify/functions/lib/services/transactionalEmailCopy";

const mocks = vi.hoisted(() => ({
  rows: [] as Array<Array<Record<string, unknown>>>,
  writes: [] as Array<{ kind: string; values: Record<string, unknown> }>,
  audit: vi.fn(),
}));

vi.mock("../../netlify/functions/lib/db/client", () => ({
  getDbClient: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.rows.shift() ?? [] }) }) }),
    insert: () => ({ values: (values: Record<string, unknown>) => {
      mocks.writes.push({ kind: "insert", values });
      return { onConflictDoNothing: () => ({ returning: async () => mocks.rows.shift() ?? [] }) };
    } }),
    update: () => ({ set: (values: Record<string, unknown>) => {
      mocks.writes.push({ kind: "update", values });
      return { where: () => ({ returning: async () => mocks.rows.shift() ?? [] }) };
    } }),
  }),
}));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));

import { getTransactionalEmailSettings, saveTransactionalEmailSettings } from "../../netlify/functions/lib/services/transactionalEmailSettingsService";

beforeEach(() => {
  mocks.rows.length = 0;
  mocks.writes.length = 0;
  mocks.audit.mockReset().mockResolvedValue(undefined);
});

describe("pengaturan pembuka email", () => {
  it("menggunakan naskah bawaan sebelum disimpan", async () => {
    mocks.rows.push([]);
    expect(await getTransactionalEmailSettings()).toEqual({
      settings: DEFAULT_TRANSACTIONAL_EMAIL_COPY, version: null, updatedAt: null,
    });
  });

  it("menyimpan pengaturan awal dan mencatat audit", async () => {
    mocks.rows.push([], [{ version: 1, updatedAt: new Date("2026-11-11T00:00:00Z") }]);
    const result = await saveTransactionalEmailSettings(DEFAULT_TRANSACTIONAL_EMAIL_COPY, null, "admin-id", "req-1");
    expect(result.version).toBe(1);
    expect(mocks.writes[0]).toMatchObject({ kind: "insert", values: {
      code: "TRANSACTIONAL_EMAIL_COPY_SETTINGS", status: "ACTIVE",
      bodyTemplate: JSON.stringify(DEFAULT_TRANSACTIONAL_EMAIL_COPY),
    } });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "TRANSACTIONAL_EMAIL_COPY_UPDATED", actorUserId: "admin-id", requestId: "req-1",
    }));
  });

  it("menolak versi lama tanpa menimpa perubahan admin lain", async () => {
    mocks.rows.push([{ bodyTemplate: JSON.stringify(DEFAULT_TRANSACTIONAL_EMAIL_COPY), version: 2, updatedAt: new Date() }]);
    await expect(saveTransactionalEmailSettings(DEFAULT_TRANSACTIONAL_EMAIL_COPY, 1, "admin-id", "req-2"))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("menaikkan versi saat memperbarui naskah", async () => {
    const updated = { ...DEFAULT_TRANSACTIONAL_EMAIL_COPY,
      individualSalutation: "Yang kami hormati {{name}}, semoga Allah menjaga Ustadz." };
    mocks.rows.push([{ bodyTemplate: JSON.stringify(DEFAULT_TRANSACTIONAL_EMAIL_COPY), version: 2,
      updatedAt: new Date("2026-11-10T00:00:00Z") }],
    [{ version: 3, updatedAt: new Date("2026-11-11T00:00:00Z") }]);
    expect((await saveTransactionalEmailSettings(updated, 2, "admin-id", "req-3")).version).toBe(3);
    expect(mocks.writes[0]).toMatchObject({ kind: "update", values: { bodyTemplate: JSON.stringify(updated) } });
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
});
