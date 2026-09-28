import { describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  event: { id: "00000000-0000-4000-8000-000000000101", status: "REGISTRATION_OPEN", archivedAt: null as Date | null },
  update: vi.fn(), audit: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../netlify/functions/lib/repositories/eventRepository", () => ({
  findEventByIdRepository: async () => mock.event,
}));
vi.mock("../../netlify/functions/lib/db/client", () => ({
  getDbClient: () => ({
    update: () => ({ set: (values: unknown) => {
      mock.update(values);
      return { where: () => ({ returning: async () => [{ status: "ARCHIVED" }] }) };
    } }),
  }),
}));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mock.audit }));

describe("hapus event dari katalog", () => {
  it("mengarsipkan event tanpa menghapus relasi peserta dan mencatat audit", async () => {
    const { removeEventFromCatalogService } = await import("../../netlify/functions/lib/services/eventService");
    const result = await removeEventFromCatalogService(mock.event.id, "actor", "request");
    expect(result.status).toBe("ARCHIVED");
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ status: "ARCHIVED", archivedAt: expect.any(Date) }));
    expect(mock.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "EVENT_REMOVED_FROM_CATALOG" }));
  });
});
