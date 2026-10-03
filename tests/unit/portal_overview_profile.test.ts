import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), own: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: mocks.db }));
vi.mock("../../netlify/functions/lib/repositories/portalProfileRepository", async (original) => ({
  ...await original<typeof import("../../netlify/functions/lib/repositories/portalProfileRepository")>(),
  findOwnPortalProfileRepository: mocks.own,
}));
import { getPortalOverviewService, resolvePortalUstadzIdService } from "../../netlify/functions/lib/services/portalService";
import { INDONESIA_REGENCIES } from "../../src/lib/indonesiaRegionData";

const actorId = "44444444-4444-4444-8444-444444444444";
const region = INDONESIA_REGENCIES[0];
const profile = { id: "own-profile", fullName: "Name", userId: actorId, email: "contact@example.invalid", cityCode: region.id, provinceCode: region.provinceId };
beforeEach(() => vi.clearAllMocks());

function query(result: unknown[]) {
  return { from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), leftJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result), orderBy: vi.fn().mockResolvedValue(result),
    then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(result).then(resolve) };
}

describe("portal overview profile identity", () => {
  it("returns contact email and separate session loginEmail with canonical region and untouched affiliations", async () => {
    const affiliations = [{ institutionName: "Institution", isPrimary: true, status: "ACTIVE" }];
    mocks.own.mockResolvedValue(profile);
    mocks.db.mockReturnValue({ select: vi.fn().mockReturnValueOnce(query([profile])).mockReturnValueOnce(query(affiliations)).mockReturnValueOnce(query([])) });
    const overview = await getPortalOverviewService(actorId, "LOGIN@example.invalid");
    expect(mocks.own).toHaveBeenCalledExactlyOnceWith(actorId);
    expect(overview.profile).toMatchObject({ id: profile.id, email: "contact@example.invalid", loginEmail: "LOGIN@example.invalid",
      city: region.city, province: region.province, affiliations, primaryInstitution: affiliations[0] });
    expect(overview.participations).toEqual([]);
  });
  it("resolver ignores session email as authority", async () => {
    mocks.own.mockResolvedValue(undefined);
    await expect(resolvePortalUstadzIdService(actorId, "another-linked-user@example.invalid")).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.own).toHaveBeenCalledExactlyOnceWith(actorId);
  });
  it("fails safely if ownership changes between resolution and overview read", async () => {
    mocks.own.mockResolvedValue(profile);
    mocks.db.mockReturnValue({ select: vi.fn().mockReturnValue(query([])) });
    await expect(getPortalOverviewService(actorId, "login@example.invalid")).rejects.toMatchObject({ statusCode: 404 });
  });
});