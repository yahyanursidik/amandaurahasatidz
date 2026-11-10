import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateAuthRequests, readAuthResource } from "../../src/lib/refine/authRequestCache";
import { authProvider } from "../../src/lib/refine/authProvider";
import { accessControlProvider } from "../../src/lib/refine/accessControlProvider";

const session = { userId: "user-one", name: "Audit", email: "audit@example.invalid", assignments: [{ roleCode: "REPORT_VIEWER" }] };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
beforeEach(() => { invalidateAuthRequests(); });
afterEach(() => { invalidateAuthRequests(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("shared browser auth requests", () => {
  it("deduplicates concurrent auth check and identity and uses no-store", async () => {
    const request = vi.fn(async () => reply(session)); vi.stubGlobal("fetch", request);
    const [check, identity] = await Promise.all([authProvider.check!({}), authProvider.getIdentity!({})]);
    expect(check.authenticated).toBe(true); expect(identity).toMatchObject({ id: "user-one", name: "Audit" });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]).toEqual([expect.stringContaining("/auth/session"), { method: "GET", credentials: "include", cache: "no-store" }]);
  });
  it("shares a permission request across getPermissions and repeated can checks", async () => {
    const request = vi.fn(async () => reply({ assignments: session.assignments, effectivePermissions: ["participants.read", "events.read"] }));
    vi.stubGlobal("fetch", request);
    const results = await Promise.all([authProvider.getPermissions!({}), accessControlProvider.can!({ resource: "events", action: "list" }), accessControlProvider.can!({ resource: "events", action: "edit" })]);
    expect(results[0]).toEqual(session.assignments); expect(results[1]).toMatchObject({ can: true }); expect(results[2]).toMatchObject({ can: false });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("expires successful entries after five seconds", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-10T00:00:00Z"));
    const request = vi.fn(async () => reply(session)); vi.stubGlobal("fetch", request);
    await readAuthResource("/auth/session"); await readAuthResource("/auth/session");
    expect(request).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5001); await readAuthResource("/auth/session");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("does not reuse failures or the old identity after invalidation", async () => {
    const request = vi.fn().mockResolvedValueOnce(reply(session)).mockResolvedValueOnce(reply(null, 401)).mockResolvedValueOnce(reply({ ...session, userId: "user-two" }));
    vi.stubGlobal("fetch", request);
    await readAuthResource("/auth/session"); invalidateAuthRequests();
    await expect(readAuthResource("/auth/session")).rejects.toThrow();
    await expect(readAuthResource("/auth/session")).resolves.toMatchObject({ userId: "user-two" });
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("does not resurrect an in-flight identity when logout invalidates it", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    const pending = readAuthResource("/auth/session"); invalidateAuthRequests(); resolve(reply(session));
    await expect(pending).rejects.toThrow("Sesi telah berubah");
    vi.stubGlobal("fetch", vi.fn(async () => reply(null, 401)));
    await expect(authProvider.check!({})).resolves.toMatchObject({ authenticated: false });
  });
});
