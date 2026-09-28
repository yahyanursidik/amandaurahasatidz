import { describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  profile: { id: "00000000-0000-4000-8000-000000000001", fullName: "Ustadz Ahmad", deletedAt: null as Date | null, profileStatus: "ACTIVE" },
  update: vi.fn(), audit: vi.fn().mockResolvedValue(null),
}));
vi.mock("../../netlify/functions/lib/repositories/ustadzRepository", () => ({
  findUstadzByIdRepository: async () => ({ ...mock.profile }),
  setUstadzArchivedRepository: async (_id: string, archived: boolean) => {
    mock.profile.deletedAt = archived ? new Date("2026-09-28T00:00:00Z") : null;
    mock.update(archived);
    return { ...mock.profile };
  },
}));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mock.audit }));

describe("arsip profil asatidz", () => {
  it("mengarsipkan dan memulihkan melalui status profil tanpa menghapus baris peserta", async () => {
    const { setUstadzArchiveService } = await import("../../netlify/functions/lib/services/ustadzService");
    expect(await setUstadzArchiveService(mock.profile.id, true, "admin", "request"))
      .toMatchObject({ archived: true });
    expect(await setUstadzArchiveService(mock.profile.id, false, "admin", "request"))
      .toMatchObject({ archived: false });
    expect(mock.update.mock.calls.map(([archived]) => archived)).toEqual([true, false]);
    expect(mock.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "USTADZ_PROFILE_ARCHIVED" }));
    expect(mock.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "USTADZ_PROFILE_RESTORED" }));
  });
});
