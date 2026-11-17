import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "vite";
import { eq, sql } from "drizzle-orm";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  const url = new URL(process.env.DATABASE_URL || "");
  assert.equal(process.env.DATABASE_DRIVER, "postgres");
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "Only run against a local database");
  const base = "http://127.0.0.1:3000/api/v1";
  const request = async (path, options) => {
    const response = await fetch(base + path, { ...options, signal: AbortSignal.timeout(30_000) });
    const body = await response.json();
    assert.equal(response.status, 200, `${path}: ${JSON.stringify(body.error)}`);
    return { response, body };
  };
  await request("/ready");
  const { body: events } = await request("/events/public");
  assert.ok(events.data);
  for (const [portal, email, path] of [
    ["admin", "admin@yts.or.id", "/dashboard/admin"],
    ["committee", "panitia@yts.or.id", "/events"],
    ["ustadz", "ustadz.demo@yts.or.id", "/portal/overview"],
  ]) {
    const { response } = await request("/auth/password/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, portal, password: process.env.SEED_DEFAULT_PASSWORD }),
    });
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie, `${portal}: missing session cookie`);
    const { body: session } = await request("/auth/session", { headers: { cookie } });
    assert.ok(session.data);
    await request(path, { headers: { cookie } });
    console.log(`${portal}: login, session and data OK`);
  }
  const { getDbClient } = await server.ssrLoadModule("/netlify/functions/lib/db/client.ts");
  const { withTransaction } = await server.ssrLoadModule("/netlify/functions/lib/db/transaction.ts");
  const { roles } = await server.ssrLoadModule("/netlify/functions/lib/db/schema/index.ts");
  const db = getDbClient();
  const code = `LOCAL_PROBE_${randomUUID()}`;
  try {
    await assert.rejects(withTransaction(async tx => {
      await tx.insert(roles).values({ code, name: "Local probe" });
      throw new Error("expected rollback");
    }), /expected rollback/);
    assert.equal((await db.select().from(roles).where(eq(roles.code, code))).length, 0);
    await withTransaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(123456789)`);
      await tx.insert(roles).values({ code, name: "Local probe" });
    });
    assert.equal((await db.select().from(roles).where(eq(roles.code, code))).length, 1);
    console.log("PostgreSQL: rollback, commit and advisory locks OK");
  } finally {
    await db.delete(roles).where(eq(roles.code, code));
  }
} finally {
  await server.close();
}
