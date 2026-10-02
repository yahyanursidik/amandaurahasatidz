import { randomUUID, randomBytes } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { handler } from "../../netlify/functions/api";
import { hashPassword } from "../../netlify/functions/lib/utils/password";

// Never write to an external database as part of the ordinary unit suite.
const enabled = process.env.RUN_RUANG_ASATIDZ_INTEGRATION_TESTS === "1";
const suite = enabled ? describe : describe.skip;
const allowPublication = process.env.RUANG_TEST_ALLOW_PUBLICATION === "1";

suite("Ruang Asatidz: real database and authenticated API", () => {
  const runId = `ruang-live-${randomUUID()}`;
  const password = randomBytes(24).toString("hex");
  const actors = ["owner", "other", "admin"].map((label) => ({
    id: randomUUID(), email: `${runId}-${label}@integration.invalid`, label,
  }));
  let sql: NeonQueryFunction<false, false>;
  let initialized = false;
  const cookies: string[] = [];

  async function request(path: string, method = "GET", actor?: number, input?: unknown) {
    const event: HandlerEvent = {
      path: `/api/v1${path}`, rawUrl: `http://integration.invalid/api/v1${path}`,
      rawQuery: "", httpMethod: method,
      headers: { "x-request-id": runId, ...(actor === undefined ? {} : { cookie: cookies[actor] }) },
      multiValueHeaders: {}, queryStringParameters: null, multiValueQueryStringParameters: null,
      body: input === undefined ? null : JSON.stringify(input), isBase64Encoded: false,
    };
    const response = await handler(event, {} as HandlerContext, () => undefined);
    if (!response || typeof response.body !== "string") throw new Error("API returned no JSON response");
    return { ...response, json: JSON.parse(response.body) };
  }

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required for the opt-in integration suite.");
    const host = new URL(url).hostname;
    if (!process.env.RUANG_TEST_DATABASE_HOST || process.env.RUANG_TEST_DATABASE_HOST !== host) {
      throw new Error("Set RUANG_TEST_DATABASE_HOST to the exact database hostname to authorize test writes.");
    }
    if (allowPublication && process.env.RUANG_TEST_ISOLATED_BRANCH !== "1") {
      throw new Error("Publication testing is permitted only on an explicitly isolated test branch.");
    }
    sql = neon(url);
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
      AND table_name IN ('ruang_asatidz_threads', 'ruang_asatidz_replies', 'ruang_asatidz_greetings')`;
    expect(tables).toHaveLength(3);
    const roles = await sql`SELECT id, code FROM roles WHERE code IN ('USTADZ', 'SYSTEM_ADMIN')`;
    expect(roles).toHaveLength(2);
    // Resolve permissions from database on every request, like production; use a temporary secret.
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("hex"));
    const hash = hashPassword(password);
    initialized = true;
    await sql.transaction(actors.flatMap((actor, index) => [
      sql`INSERT INTO users (id, email, name, password_hash, status)
        VALUES (${actor.id}::uuid, ${actor.email}, ${`Integration ${actor.label}`}, ${hash}, 'ACTIVE')`,
      sql`INSERT INTO user_role_assignments (user_id, role_id)
        VALUES (${actor.id}::uuid, ${roles.find((r) => r.code === (index === 2 ? 'SYSTEM_ADMIN' : 'USTADZ'))!.id}::uuid)`,
    ]));
    for (let index = 0; index < actors.length; index += 1) {
      const login = await request("/auth/password/login", "POST", undefined, {
        email: actors[index].email, password, portal: index === 2 ? "admin" : "ustadz",
      });
      expect(login.statusCode, login.json.error?.message).toBe(200);
      const cookie = login.headers?.["Set-Cookie"];
      expect(typeof cookie).toBe("string");
      cookies[index] = String(cookie).split(";")[0];
    }
  }, 120000);

  afterAll(async () => {
    try {
      if (initialized) {
        const ids = actors.map((a) => a.id);
        // Narrow cleanup to this run's random actor IDs, never existing accounts/data.
        await sql.transaction([
          sql`DELETE FROM ruang_asatidz_replies WHERE author_user_id = ANY(${ids}::uuid[])`,
          sql`DELETE FROM ruang_asatidz_threads WHERE user_id = ANY(${ids}::uuid[])`,
          sql`DELETE FROM ruang_asatidz_greetings WHERE created_by = ANY(${ids}::uuid[])`,
          sql`DELETE FROM audit_logs WHERE actor_user_id = ANY(${ids}::uuid[]) AND request_id = ${runId}`,
          sql`DELETE FROM user_role_assignments WHERE user_id = ANY(${ids}::uuid[])`,
          sql`DELETE FROM users WHERE id = ANY(${ids}::uuid[])`,
        ]);
        const remaining = await sql`SELECT count(*)::int AS count FROM users WHERE id = ANY(${ids}::uuid[])`;
        expect(remaining[0].count).toBe(0);
      }
    } finally { vi.unstubAllEnvs(); }
  }, 120000);

  it("persists private messages, enforces ownership/RBAC, replies, status, and audit", async () => {
    expect((await request("/ruang-asatidz/threads")).statusCode).toBe(401);
    expect((await request("/admin/ruang-asatidz/threads", "GET", 0)).statusCode).toBe(403);
    const created = await request("/ruang-asatidz/threads", "POST", 0, {
      category: "SUGGESTION", subject: `${runId} private suggestion`,
      body: "This private integration message must never appear on the experience board.",
    });
    expect(created.statusCode, created.json.error?.message).toBe(201);
    const id = created.json.data.id;
    expect(created.json.data.publicationStatus).toBe("PRIVATE");
    const stored = await sql`SELECT status, publication_status FROM ruang_asatidz_threads WHERE id = ${id}::uuid`;
    expect(stored[0]).toEqual({ status: "NEW", publication_status: "PRIVATE" });
    expect((await request(`/ruang-asatidz/threads/${id}`, "GET", 1)).statusCode).toBe(404);
    expect((await request(`/ruang-asatidz/threads/${id}/replies`, "POST", 1, { body: "Unauthorized reply" })).statusCode).toBe(404);
    expect((await request(`/ruang-asatidz/threads/${id}/replies`, "POST", 0, { body: "Private owner reply" })).statusCode).toBe(201);
    expect((await request(`/admin/ruang-asatidz/threads/${id}/replies`, "POST", 2, { body: "Private YTS reply" })).statusCode).toBe(201);
    const detail = await request(`/ruang-asatidz/threads/${id}`, "GET", 0);
    expect(detail.statusCode).toBe(200);
    expect(detail.json.data.replies.map((r: { authorRole: string }) => r.authorRole).sort()).toEqual(["ASATIDZ", "YTS"]);
    expect(detail.json.data).not.toHaveProperty("authorEmail");
    expect((await request(`/admin/ruang-asatidz/threads/${id}`, "GET", 2)).json.data.authorEmail).toBe(actors[0].email);
    const other = await request("/ruang-asatidz/threads", "GET", 1);
    expect(other.json.data.data).toEqual([]);
    expect((await request(`/admin/ruang-asatidz/threads/${id}`, "PATCH", 2, { publicationStatus: "PUBLISHED" })).statusCode).toBe(422);
    expect((await request(`/admin/ruang-asatidz/threads/${id}`, "PATCH", 2, { status: "CLOSED" })).statusCode).toBe(200);
    expect((await request(`/ruang-asatidz/threads/${id}/replies`, "POST", 0, { body: "Closed reply" })).statusCode).toBe(409);
    expect((await request(`/admin/ruang-asatidz/threads/${id}`, "PATCH", 2, { status: "IN_PROGRESS" })).statusCode).toBe(200);
    const audit = await sql`SELECT action, after_data FROM audit_logs WHERE request_id = ${runId}`;
    expect(audit.some((row) => row.action === "RUANG_THREAD_CREATED")).toBe(true);
    expect(audit.some((row) => row.action === "RUANG_REPLY_CREATED")).toBe(true);
    expect(audit.some((row) => row.action === "RUANG_THREAD_UPDATED")).toBe(true);
    for (const row of audit) {
      expect(row.after_data).not.toHaveProperty("body");
      expect(row.after_data).not.toHaveProperty("subject");
    }
  }, 120000);

  it("keeps greeting drafts private", async () => {
    const created = await request("/admin/ruang-asatidz/greetings", "POST", 2, {
      title: `${runId} draft greeting`, body: "Integration greeting draft. Not intended for publication.", isPublished: false,
    });
    expect(created.statusCode, created.json.error?.message).toBe(201);
    const id = created.json.data.id;
    const greetings = await request("/ruang-asatidz/greetings", "GET", 0);
    expect(greetings.statusCode).toBe(200);
    expect(greetings.json.data.data.some((g: { id: string }) => g.id === id)).toBe(false);
    const stored = await sql`SELECT is_published FROM ruang_asatidz_greetings WHERE id = ${id}::uuid`;
    expect(stored[0].is_published).toBe(false);
  }, 60000);

  it.skipIf(!allowPublication)("moderates consented experiences and never exposes private replies/contact", async () => {
    const created = await request("/ruang-asatidz/threads", "POST", 0, {
      category: "EXPERIENCE", subject: `${runId} teaching experience`,
      body: "Integration-only experience on an isolated branch. Sharing consent is explicit.", shareExperience: true,
    });
    expect(created.statusCode).toBe(201);
    const id = created.json.data.id;
    expect(created.json.data.publicationStatus).toBe("PENDING");
    const boardBefore = await request("/ruang-asatidz/experiences", "GET", 1);
    expect(boardBefore.json.data.data.some((row: { id: string }) => row.id === id)).toBe(false);
    await request(`/admin/ruang-asatidz/threads/${id}/replies`, "POST", 2, { body: "Private unpublished YTS reply" });
    expect((await request(`/admin/ruang-asatidz/threads/${id}`, "PATCH", 2, { publicationStatus: "PUBLISHED" })).statusCode).toBe(200);
    const board = await request("/ruang-asatidz/experiences", "GET", 1);
    const published = board.json.data.data.find((row: { id: string }) => row.id === id);
    expect(published).toBeDefined();
    expect(published.publishedAt).toBeTruthy();
    for (const key of ["userId", "authorEmail", "replies"]) expect(published).not.toHaveProperty(key);
    expect((await request(`/admin/ruang-asatidz/threads/${id}`, "PATCH", 2, { publicationStatus: "HIDDEN" })).statusCode).toBe(200);
    const hidden = await request("/ruang-asatidz/experiences", "GET", 1);
    expect(hidden.json.data.data.some((row: { id: string }) => row.id === id)).toBe(false);
  }, 120000);
});