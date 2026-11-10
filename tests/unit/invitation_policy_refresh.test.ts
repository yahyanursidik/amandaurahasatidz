import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ policy: vi.fn(), audit: vi.fn(), opened: vi.fn() }));
vi.mock("../../netlify/functions/lib/repositories/invitationRepository", async (original) => ({
  ...await original<typeof import("../../netlify/functions/lib/repositories/invitationRepository")>(),
  findInvitationPolicyByTokenHashRepository: mocks.policy, markInvitationOpenedRepository: mocks.opened,
}));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));
import { getPublicInvitationPolicyService } from "../../netlify/functions/lib/services/invitationService";
const fixture = { invitation: { id: "fixture", invitationType: "INSTITUTION", invitationNumber: "UND-1", quota: 2, status: "OPENED", responseDeadline: null, updatedAt: new Date() },
  event: { id: "event", status: "REGISTRATION_OPEN", defaultInstitutionQuota: 5, invitationResponseDeadline: null }, link: { revokedAt: null, expiresAt: new Date("2099-01-01") } };
beforeEach(() => { vi.clearAllMocks(); mocks.policy.mockResolvedValue(fixture); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network disabled"); })); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled(); expect(mocks.opened).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
describe("read-only invitation policy", () => {
  it("reads the saved invitation limit instead of the event default without writes", async () => {
    expect(await getPublicInvitationPolicyService("fixture", "institution")).toMatchObject({ quota: 2, allowGroup: true });
  });
  it("reflects single-delegate changes and never permits groups on an individual link", async () => {
    mocks.policy.mockResolvedValueOnce({ ...fixture, invitation: { ...fixture.invitation, quota: 1 } });
    expect(await getPublicInvitationPolicyService("fixture", "institution")).toMatchObject({ quota: 1, allowGroup: false });
    mocks.policy.mockResolvedValueOnce({ ...fixture, invitation: { ...fixture.invitation, invitationType: "INDIVIDUAL", quota: 5 } });
    expect(await getPublicInvitationPolicyService("fixture", "individual")).toMatchObject({ quota: 1, allowGroup: false });
  });
  it("fails closed for a final response, revoked link, or wrong token type", async () => {
    mocks.policy.mockResolvedValueOnce({ ...fixture, invitation: { ...fixture.invitation, status: "ACCEPTED" } });
    await expect(getPublicInvitationPolicyService("fixture", "institution")).rejects.toMatchObject({ statusCode: 409 });
    mocks.policy.mockResolvedValueOnce({ ...fixture, link: { ...fixture.link, revokedAt: new Date() } });
    await expect(getPublicInvitationPolicyService("fixture", "institution")).rejects.toMatchObject({ statusCode: 403 });
    await expect(getPublicInvitationPolicyService("fixture", "individual")).rejects.toMatchObject({ statusCode: 404 });
  });
});
