import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerEvent } from "@netlify/functions";
import type { UserContext } from "../../netlify/functions/lib/middleware/rbac";
import type { RoleCode } from "../../src/config/permissions";

const mocks = vi.hoisted(() => ({
  listMyThreads: vi.fn(), createThread: vi.fn(), getThread: vi.fn(), addReply: vi.fn(),
  listAdminThreads: vi.fn(), updateThread: vi.fn(), listExperienceBoard: vi.fn(),
  listGreetings: vi.fn(), saveGreeting: vi.fn(),
}));
vi.mock("../../netlify/functions/lib/services/ruangAsatidzService", () => mocks);
import { handleRuangAsatidzRoute } from "../../netlify/functions/lib/routes/ruangAsatidzRoutes";

const userId = "11111111-1111-4111-8111-111111111111";
const threadId = "22222222-2222-4222-8222-222222222222";
const requestId = "ruang-route-test";
let actorCount = 0;
const session = (role: RoleCode): UserContext => ({
  userId: `${(++actorCount).toString().padStart(8, "0")}-1111-4111-8111-111111111111`,
  email: "unit@example.org", assignments: [{ roleCode: role }],
});
function request(path: string, method: string, user: UserContext | null, body?: unknown, query?: Record<string, string>) {
  const event = { body: body === undefined ? null : JSON.stringify(body), queryStringParameters: query || null } as HandlerEvent;
  return handleRuangAsatidzRoute(event, path, method, user, requestId);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network not allowed in route test"); }));
  Object.values(mocks).forEach((mock) => mock.mockResolvedValue({ id: threadId }));
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("akses dan privasi Ruang Asatidz", () => {
  it("melewatkan rute modul lain", async () => {
    expect(await request("/events", "GET", null)).toBeNull();
  });
  it.each(["/ruang-asatidz/threads", "/ruang-asatidz/experiences", "/ruang-asatidz/greetings", "/admin/ruang-asatidz/threads"])("mengharuskan login: %s", async (path) => {
    await expect(request(path, "GET", null)).rejects.toMatchObject({ statusCode: 401 });
    Object.values(mocks).forEach((mock) => expect(mock).not.toHaveBeenCalled());
  });
  it.each(["EVENT_ADMIN", "INSTITUTION_REPRESENTATIVE", "REPORT_VIEWER", "CHECKIN_OFFICER"] as const)("menolak akses %s ke pesan pribadi", async (role) => {
    await expect(request("/admin/ruang-asatidz/threads", "GET", session(role))).rejects.toMatchObject({ statusCode: 403 });
    await expect(request("/ruang-asatidz/threads", "GET", session(role))).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.listAdminThreads).not.toHaveBeenCalled();
  });
  it("asatidz tidak boleh membaca admin atau memoderasi", async () => {
    const actor = session("USTADZ");
    await expect(request(`/admin/ruang-asatidz/threads/${threadId}`, "GET", actor)).rejects.toMatchObject({ statusCode: 403 });
    await expect(request(`/admin/ruang-asatidz/threads/${threadId}`, "PATCH", actor, { publicationStatus: "PUBLISHED" })).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.getThread).not.toHaveBeenCalled();
    expect(mocks.updateThread).not.toHaveBeenCalled();
  });
  it.each(["SUPER_ADMIN", "SYSTEM_ADMIN"] as const)("pengelola %s dapat membaca kotak masuk", async (role) => {
    const response = await request("/admin/ruang-asatidz/threads", "GET", session(role));
    expect(response?.statusCode).toBe(200);
    expect(mocks.listAdminThreads).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 20 }));
    expect((response?.headers as Record<string, string> | undefined)?.["Cache-Control"]).toBe("no-store");
  });
  it("assignment expired tidak memberi akses", async () => {
    const actor = session("SYSTEM_ADMIN");
    actor.assignments[0].endsAt = new Date("2020-01-01");
    await expect(request("/admin/ruang-asatidz/threads", "GET", actor)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("detail portal selalu menggunakan identitas sesi dan admin false", async () => {
    const actor = session("USTADZ");
    await request(`/ruang-asatidz/threads/${threadId}`, "GET", actor);
    expect(mocks.getThread).toHaveBeenCalledExactlyOnceWith(threadId, actor.userId, false);
  });
  it("list sendiri tidak menggunakan userId dari query", async () => {
    const actor = session("USTADZ");
    // Strict schemas may reject unknown keys; neither approach can change the owner.
    await request("/ruang-asatidz/threads", "GET", actor, undefined, { page: "2", pageSize: "10" });
    expect(mocks.listMyThreads).toHaveBeenCalledExactlyOnceWith(actor.userId, expect.objectContaining({ page: 2, pageSize: 10 }));
  });
  it("balasan portal/admin menggunakan author role dari endpoint bukan payload", async () => {
    const ustadz = session("USTADZ");
    await request(`/ruang-asatidz/threads/${threadId}/replies`, "POST", ustadz, { body: "Terima kasih atas tanggapannya." });
    expect(mocks.addReply).toHaveBeenLastCalledWith(threadId, ustadz.userId, false, { body: "Terima kasih atas tanggapannya." }, requestId);
    const admin = session("SUPER_ADMIN");
    await request(`/admin/ruang-asatidz/threads/${threadId}/replies`, "POST", admin, { body: "Kami sedang menindaklanjuti." });
    expect(mocks.addReply).toHaveBeenLastCalledWith(threadId, admin.userId, true, { body: "Kami sedang menindaklanjuti." }, requestId);
  });
  it("status sendiri tidak dapat diubah dari endpoint portal", async () => {
    const result = await request(`/ruang-asatidz/threads/${threadId}`, "PATCH", session("USTADZ"), { status: "RESOLVED" });
    expect(result?.statusCode).toBe(404);
    expect(mocks.updateThread).not.toHaveBeenCalled();
  });
});

describe("payload dan pagination Ruang Asatidz", () => {
  it("membuat saran pribadi dengan id pemilik dari sesi", async () => {
    const actor = session("USTADZ");
    const result = await request("/ruang-asatidz/threads", "POST", actor, { category: "SUGGESTION", subject: "Masukan jadwal daurah", body: "Mohon kegiatan tersedia juga pada akhir pekan." });
    expect(result?.statusCode).toBe(201);
    expect(mocks.createThread).toHaveBeenCalledWith(actor.userId, expect.objectContaining({ category: "SUGGESTION", subject: "Masukan jadwal daurah" }), requestId);
  });
  it.each([
    { category: "SUGGESTION", subject: "Saran", body: "Isi cukup panjang", shareExperience: true },
    { category: "NEED", subject: "Permintaan dukungan", body: "Isi cukup panjang", userId },
    { category: "EXPERIENCE", subject: "Pengalaman mengajar", body: "Isi cukup panjang", publicationStatus: "PUBLISHED" },
    { category: "QUESTION", subject: "abc", body: "x" },
  ])("menolak payload thread tidak aman %#", async (body) => {
    await expect(request("/ruang-asatidz/threads", "POST", session("USTADZ"), body)).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.createThread).not.toHaveBeenCalled();
  });
  it.each([{ page: "0" }, { pageSize: "51" }, { category: "INVALID" }, { status: "INVALID" }] as Record<string, string>[])("menolak query invalid %#", async (query) => {
    await expect(request("/ruang-asatidz/threads", "GET", session("USTADZ"), undefined, query)).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.listMyThreads).not.toHaveBeenCalled();
  });
  it("menolak UUID invalid sebelum database dipanggil", async () => {
    await expect(request("/ruang-asatidz/threads/not-a-uuid", "GET", session("USTADZ"))).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.getThread).not.toHaveBeenCalled();
  });
  it("menolak JSON rusak dengan error validasi", async () => {
    await expect(handleRuangAsatidzRoute({ body: "{", queryStringParameters: null } as HandlerEvent,
      "/ruang-asatidz/threads", "POST", session("USTADZ"), requestId)).rejects.toMatchObject({ statusCode: 422 });
  });
  it("asatidz hanya meminta sapaan published, admin dapat meminta drafts", async () => {
    await request("/ruang-asatidz/greetings", "GET", session("USTADZ"));
    expect(mocks.listGreetings).toHaveBeenLastCalledWith(false, { page: 1, pageSize: 20 });
    await request("/admin/ruang-asatidz/greetings", "GET", session("SUPER_ADMIN"));
    expect(mocks.listGreetings).toHaveBeenLastCalledWith(true, { page: 1, pageSize: 20 });
  });
  it("papan pengalaman hanya menggunakan fungsi publikasi termoderasi", async () => {
    await request("/ruang-asatidz/experiences", "GET", session("USTADZ"));
    expect(mocks.listExperienceBoard).toHaveBeenCalledExactlyOnceWith({ page: 1, pageSize: 20 });
    expect(mocks.listAdminThreads).not.toHaveBeenCalled();
  });
  it("admin dapat menyimpan sapaan, portal tidak", async () => {
    const actor = session("SYSTEM_ADMIN");
    const input = { title: "Ahlan wa sahlan, Asatidz", body: "Mari tetap terhubung bersama Yayasan Tarbiyah Sunnah.", isPublished: false };
    expect((await request("/admin/ruang-asatidz/greetings", "POST", actor, input))?.statusCode).toBe(201);
    expect(mocks.saveGreeting).toHaveBeenCalledWith(actor.userId, null, input, requestId);
    expect((await request("/ruang-asatidz/greetings", "POST", session("USTADZ"), input))?.statusCode).toBe(404);
  });
  it("membatasi spam per akun tanpa memanggil service berikutnya", async () => {
    const actor = session("USTADZ");
    for (let i = 0; i < 40; i += 1) await request(`/ruang-asatidz/threads/${threadId}/replies`, "POST", actor, { body: "Pesan uji" });
    const response = await request(`/ruang-asatidz/threads/${threadId}/replies`, "POST", actor, { body: "Pesan uji" });
    expect(response?.statusCode).toBe(429);
    expect(mocks.addReply).toHaveBeenCalledTimes(40);
  });
});