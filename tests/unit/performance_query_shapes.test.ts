import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../netlify/functions/lib/db/schema";
const mocks = vi.hoisted(() => ({ db: null as any, client: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => mocks.db }));
import { findParticipantPageRepository } from "../../netlify/functions/lib/repositories/participantRepository";
import { findUstadzProfilesRepository } from "../../netlify/functions/lib/repositories/ustadzRepository";
import { findPublicProgramPageRepository, findRegistrationEventRepository, findEventOptionsRepository } from "../../netlify/functions/lib/repositories/eventRepository";
import { getAdminDashboardMetricsService, getCommitteeDashboardMetricsService } from "../../netlify/functions/lib/services/dashboardService";
import { participantPageQuerySchema } from "../../netlify/functions/lib/validations/participantValidation";
import { publicProgramQuerySchema } from "../../netlify/functions/lib/validations/eventValidation";
import { createSessionToken, getUserSession } from "../../netlify/functions/lib/services/authService";

beforeEach(() => { mocks.client.mockReset(); mocks.client.mockResolvedValue({ rows: [] }); mocks.db = drizzle(mocks.client as any, { schema }); });
const queries = () => mocks.client.mock.calls.map(([query]) => String(query));
describe("bounded read query shapes", () => {
  it("fetches only a requested participant page plus aggregate counts", async () => {
    await findParticipantPageRepository("11111111-1111-4111-8111-111111111111", participantPageQuerySchema.parse({ page: 3, pageSize: 25, search: "Ahmad", status: "DECLINED" }));
    expect(mocks.client).toHaveBeenCalledTimes(2);
    expect(queries()[0]).toContain("limit"); expect(queries()[0]).toContain("offset");
    expect(mocks.client.mock.calls[0][1]).toEqual(expect.arrayContaining([25, 50, "%Ahmad%", "DECLINED", "REJECTED"]));
    expect(queries()[1]).toContain("count(*) filter");
  });
  it("keeps percent/underscore searches literal like the former browser substring filter", async () => {
    await findParticipantPageRepository("11111111-1111-4111-8111-111111111111", participantPageQuerySchema.parse({ search: "QA_100%" }));
    expect(mocks.client.mock.calls[0][1]).toContain("%QA\\_100\\%%");
    mocks.client.mockClear();
    await findPublicProgramPageRepository(publicProgramQuerySchema.parse({ search: "QA_100%" }));
    expect(mocks.client.mock.calls[0][1]).toContain("%QA\\_100\\%%");
  });
  it("projects only identity/status for explicit bulk selections, not contacts or history", async () => {
    await findParticipantPageRepository("11111111-1111-4111-8111-111111111111", participantPageQuerySchema.parse({ projection: "selection", eligible: "true" }));
    expect(queries()[0]).not.toContain("eventParticipationCount");
    expect(queries()[0]).not.toContain("participant_status_histories");
    const projection = queries()[0].split(" from ")[0];
    expect(projection).not.toContain('"email"'); expect(projection).not.toContain('"address"');
    expect(mocks.client.mock.calls[0][1]).toEqual(expect.arrayContaining(["PENDING_REVIEW", "WAITLISTED", "INVITED", "CONFIRMED", 25]));
  });
  it("uses SQL aggregates for directory summaries rather than returning all active profiles", async () => {
    const result = await findUstadzProfilesRepository({ page: 2, pageSize: 25, duplicate: "true", quality: "incomplete" });
    expect(result.data).toEqual([]); expect(mocks.client).toHaveBeenCalledTimes(3);
    expect(queries().filter((query) => query.includes("limit"))).toHaveLength(1);
    expect(queries().some((query) => query.includes("duplicate_profile") && query.includes("count(*) filter"))).toBe(true);
    expect(mocks.client.mock.calls[0][1]).toEqual(expect.arrayContaining([25]));
  });
  it("returns poster URLs, not inline blobs, in a bounded public catalog", async () => {
    const result = await findPublicProgramPageRepository(publicProgramQuerySchema.parse({ view: "featured", pageSize: 50 }));
    expect(result.meta.pageSize).toBe(3); expect(mocks.client).toHaveBeenCalledTimes(2);
    expect(queries()[0]).toContain("case"); expect(queries()[0]).toContain("/poster?v=");
    expect(mocks.client.mock.calls[0][1]).toContain(3);
  });
  it("loads registration settings in one narrow query", async () => {
    await findRegistrationEventRepository("11111111-1111-4111-8111-111111111111");
    expect(mocks.client).toHaveBeenCalledTimes(1);
    expect(queries()[0]).not.toContain("poster_url"); expect(queries()[0]).not.toContain("event_sessions"); expect(queries()[0]).not.toContain("committee");
  });
  it("keeps the event picker narrow without changing the legacy event list", async () => {
    await findEventOptionsRepository();
    expect(mocks.client).toHaveBeenCalledTimes(1);
    expect(queries()[0]).not.toContain("poster_url"); expect(queries()[0]).not.toContain("description");
    expect(queries()[0]).toContain('"attendance_confirmation_deadline"');
  });
  it("resolves staff identity and assignments together without fetching password hashes", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    mocks.client.mockResolvedValue({ rows: [[id, "qa@example.invalid", "QA", "ACTIVE", "REPORT_VIEWER", null, null, null, null]] });
    const token = createSessionToken("qa@example.invalid").sessionId;
    expect(await getUserSession(token)).toMatchObject({ userId: id, assignments: [{ roleCode: "REPORT_VIEWER" }] });
    expect(mocks.client).toHaveBeenCalledTimes(1);
    expect(queries()[0]).toContain('left join "user_role_assignments"');
    expect(queries()[0]).not.toContain('"password_hash"');
  });
  it("loads only a portal profile ID after resolving an ustadz session", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    mocks.client.mockResolvedValueOnce({ rows: [[id, "qa@example.invalid", "QA", "ACTIVE", "USTADZ", null, null, null, null]] })
      .mockResolvedValueOnce({ rows: [["22222222-2222-4222-8222-222222222222"]] });
    expect(await getUserSession(createSessionToken("qa@example.invalid").sessionId)).toMatchObject({ ustadzId: "22222222-2222-4222-8222-222222222222" });
    expect(mocks.client).toHaveBeenCalledTimes(2);
    expect(queries()[1].split(" from ")[0]).toBe('select "id"');
  });
  it.each([getAdminDashboardMetricsService, () => getCommitteeDashboardMetricsService("11111111-1111-4111-8111-111111111111")])("uses one round trip for a dashboard", async (read) => {
    await read(); expect(mocks.client).toHaveBeenCalledTimes(1); expect(queries()[0]).toContain("count(*)"); expect(queries()[0]).toContain("jsonb_agg");
  });
  it("validates pagination and filter bounds instead of accepting unbounded or invalid input", () => {
    for (const value of [{ page: 0 }, { pageSize: 1001 }, { projection: "raw" }, { institutionId: "not-a-uuid" }, { status: "unknown" }]) expect(participantPageQuerySchema.safeParse(value).success).toBe(false);
    expect(publicProgramQuerySchema.safeParse({ pageSize: 1000 }).success).toBe(false);
  });
});
