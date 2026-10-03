import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { ustadzProfiles } from "../../netlify/functions/lib/db/schema";
const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: mocks.db }));
import { findOwnPortalProfileRepository, portalProfileOwnership, updateOwnPortalProfileRepository } from "../../netlify/functions/lib/repositories/portalProfileRepository";

const dialect = new PgDialect();
const actorId = "44444444-4444-4444-8444-444444444444";
const profile = { id: "11111111-1111-4111-8111-111111111111", userId: actorId, updatedAt: new Date("2026-01-01") } as typeof ustadzProfiles.$inferSelect;
beforeEach(() => vi.clearAllMocks());

describe("portal profile ownership query", () => {
  it("uses user ID, database account login email, only unlinked unique fallback and never session contact email", () => {
    const query = dialect.sqlToQuery(portalProfileOwnership(actorId));
    expect(query.sql).toContain('"ustadz_profiles"."user_id" =');
    expect(query.sql).toContain('"ustadz_profiles"."user_id" IS NULL');
    expect(query.sql).toContain("FROM users WHERE id =");
    expect(query.sql).toContain("NOT EXISTS (SELECT 1 FROM ustadz_profiles linked WHERE linked.user_id");
    expect(query.sql).toContain("candidate.user_id IS NULL");
    expect(query.sql).toContain("count(*)");
    expect(query.sql).toContain(")) = 1");
    expect(query.params.every((value) => value === actorId)).toBe(true);
  });
  it("prioritizes a linked profile even if contact email matches someone else", async () => {
    const chain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([profile]) };
    const select = vi.fn(() => chain);
    mocks.db.mockReturnValue({ select });
    expect(await findOwnPortalProfileRepository(actorId)).toBe(profile);
    expect(select).toHaveBeenCalledOnce();
    const where = dialect.sqlToQuery(chain.where.mock.calls[0][0]);
    expect(where.sql).toBe('"ustadz_profiles"."user_id" = $1');
    expect(where.params).toEqual([actorId]);
  });
  it("queries safe fallback only when there is no linked profile", async () => {
    const chain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([profile]) };
    mocks.db.mockReturnValue({ select: vi.fn(() => chain) });
    expect(await findOwnPortalProfileRepository(actorId)).toBe(profile);
    expect(chain.where).toHaveBeenCalledTimes(2);
    expect(dialect.sqlToQuery(chain.where.mock.calls[1][0]).sql).toContain("candidate.user_id IS NULL");
  });
  it("returns no profile when SQL denies linked-other-user or ambiguous fallback", async () => {
    const chain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) };
    mocks.db.mockReturnValue({ select: vi.fn(() => chain) });
    expect(await findOwnPortalProfileRepository(actorId)).toBeUndefined();
  });
});

describe("atomic Neon HTTP profile save", () => {
  it("links fallback, updates profile and users.name in one CTE, guarded by ownership/version/status", async () => {
    const saved = { ...profile, createdAt: new Date("2026-01-01"), deletedAt: null, fullName: "New Name", email: "new-contact@example.invalid" };
    const execute = vi.fn().mockResolvedValue({ rows: [{ profile: saved }] });
    mocks.db.mockReturnValue({ execute });
    expect(await updateOwnPortalProfileRepository(profile, actorId, { fullName: "New Name", email: saved.email })).toEqual(saved);
    expect(execute).toHaveBeenCalledOnce();
    const query = dialect.sqlToQuery(execute.mock.calls[0][0]);
    expect(query.sql).toContain('UPDATE "ustadz_profiles" SET');
    expect(query.sql).toContain('"user_id" =');
    expect(query.sql).toContain('UPDATE "users" SET name = p.full_name');
    expect(query.sql).toContain('"users"."id" =');
    expect(query.sql).toContain('"deleted_at" is null');
    expect(query.sql).toContain('"merged_into_id" is null');
    expect(query.sql).toContain("NOT IN ('MERGED', 'ARCHIVED')");
    expect(query.sql).toContain("date_trunc('milliseconds'");
    expect(query.sql).toContain("candidate.user_id IS NULL");
    expect(query.sql).toContain("JOIN updated_user u ON u.id = p.user_id");
    expect(query.params).toContain("new-contact@example.invalid");
    const userStatement = query.sql.split('UPDATE "users"')[1].split("SELECT jsonb_build_object")[0];
    expect(userStatement).not.toMatch(/email\s*=|password|status\s*=/i);
    expect(query.params).toContain(profile.updatedAt.toISOString());
  });
  it("does not retry sequential non-atomic writes if database rejects the CTE", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("database failure"));
    mocks.db.mockReturnValue({ execute });
    await expect(updateOwnPortalProfileRepository(profile, actorId, { fullName: "New Name" })).rejects.toThrow("database failure");
    expect(execute).toHaveBeenCalledOnce();
  });
  it("hydrates JSONB timestamp strings as Dates and keeps birthDate as date-only string", async () => {
    mocks.db.mockReturnValue({ execute: vi.fn().mockResolvedValue({ rows: [{ profile: {
      ...profile, createdAt: "2026-01-01T00:00:00+00:00", updatedAt: "2026-01-02T03:04:05+00:00", deletedAt: null, birthDate: "1990-01-02",
    } }] }) });
    const saved = await updateOwnPortalProfileRepository(profile, actorId, { address: "new" });
    expect(saved?.createdAt).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(saved?.updatedAt).toEqual(new Date("2026-01-02T03:04:05Z"));
    expect(saved?.birthDate).toBe("1990-01-02");
    expect(saved?.deletedAt).toBeNull();
  });
});