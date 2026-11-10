import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/neon-http";
const mocks = vi.hoisted(() => ({ db: null as any, client: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => mocks.db }));
import { getPublicEventPosterService } from "../../netlify/functions/lib/services/eventPosterService";
import { DEFAULT_EVENT_POSTER } from "../../src/lib/eventPoster";
const version = new Date("2026-11-10T00:00:00.000Z");
beforeEach(() => { mocks.client.mockReset(); mocks.client.mockResolvedValue({ rows: [["data:image/webp;base64,UklGRg==", version.toISOString()]] }); mocks.db = drizzle(mocks.client as any); });
describe("public poster response", () => {
  it("serves the original image as binary with ETag and immutable versioned cache", async () => {
    const result = await getPublicEventPosterService("daurah-uji", undefined, String(version.getTime()));
    expect(result).toMatchObject({ statusCode: 200, body: "UklGRg==", isBase64Encoded: true });
    expect(result.headers).toMatchObject({ "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff" });
    expect(result.headers["Cache-Control"]).toContain("immutable"); expect(result.headers.ETag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(String(mocks.client.mock.calls[0][0])).toContain('"archived_at" is null');
  });
  it("returns 304 for a matching strong or weak validator", async () => {
    const first = await getPublicEventPosterService("daurah-uji");
    const result = await getPublicEventPosterService("daurah-uji", `W/${first.headers.ETag}`);
    expect(result.statusCode).toBe(304); expect(result.body).toBe("");
  });
  it("does not cache stale versions as immutable", async () => {
    const result = await getPublicEventPosterService("daurah-uji", undefined, "old-version");
    expect(result.headers["Cache-Control"]).not.toContain("immutable");
  });
  it("maps legacy default PNGs to the optimized asset", async () => {
    mocks.client.mockResolvedValue({ rows: [["/images/event-poster-library-interior.png", version.toISOString()]] });
    const result = await getPublicEventPosterService("daurah-uji");
    expect(result).toMatchObject({ statusCode: 302, headers: { Location: DEFAULT_EVENT_POSTER } });
  });
  it("rejects missing/private records and unsafe inline formats", async () => {
    mocks.client.mockResolvedValueOnce({ rows: [] });
    await expect(getPublicEventPosterService("private-event")).rejects.toMatchObject({ statusCode: 404 });
    mocks.client.mockResolvedValueOnce({ rows: [["data:image/svg+xml;base64,PHN2Zz4=", version.toISOString()]] });
    await expect(getPublicEventPosterService("daurah-uji")).rejects.toMatchObject({ statusCode: 404 });
  });
});
