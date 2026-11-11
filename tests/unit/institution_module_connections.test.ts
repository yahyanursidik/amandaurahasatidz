import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../netlify/functions/lib/db/schema";

const mocks = vi.hoisted(() => ({ db: null as any, client: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => mocks.db }));
import { findInstitutionByIdRepository, findInstitutionIdentityRepository } from "../../netlify/functions/lib/repositories/institutionRepository";

const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  mocks.client.mockReset();
  mocks.client.mockImplementation(async (query: string) => ({ rows: String(query).includes('from "institutions" where') ? [[id]] : [] }));
  mocks.db = drizzle(mocks.client as any, { schema });
});

describe("relasi lembaga ke event dan peserta", () => {
  it("mengambil respons akhir terbaru tanpa menggandakan undangan mandiri dan membawa jalur peserta", async () => {
    const result = await findInstitutionByIdRepository(id);
    expect(result?.relationSummary).toMatchObject({ invitationCount: 0, participantCount: 0 });
    const queries = mocks.client.mock.calls.map(([query]) => String(query));
    const invitationQuery = queries.find((query) => query.includes('from "invitations"')) || "";
    const participantQuery = queries.find((query) => query.includes('from "event_participants"')) || "";
    expect(invitationQuery).toContain("r.is_final = true");
    expect(invitationQuery).toContain("order by r.submitted_at desc limit 1");
    expect(invitationQuery).not.toContain('left join "invitation_responses"');
    expect(participantQuery).toContain('"registration_source"');
    expect(participantQuery).toContain('"invitation_id"');
  });
  it("memeriksa identitas lembaga tanpa memuat riwayat saat mengelola PIC", async () => {
    const identity = await findInstitutionIdentityRepository(id);
    expect(identity?.id).toBe(id);
    expect(mocks.client).toHaveBeenCalledTimes(1);
    const query = String(mocks.client.mock.calls[0][0]);
    expect(query).not.toContain("join");
    expect(query).not.toContain("event_participants");
    expect(query).not.toContain("invitation_responses");
  });
});
