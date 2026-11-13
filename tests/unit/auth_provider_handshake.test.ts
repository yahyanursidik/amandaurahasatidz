import { describe, expect, it, vi } from "vitest";
import { authProvider, verifyPersistedSession } from "../../src/lib/refine/authProvider";

describe("Login session handshake", () => {
  it("preserves only a same-app portal correction returned after verified credentials", async () => {
    const previous = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "Gunakan Portal Panitia", details: {
      recommendedPortal: "committee", loginPath: "/login/committee" } } }), { status: 403 })));
    try {
      const result = await authProvider.login!({ email: "committee@test.invalid", password: "fixture-password", portal: "admin" });
      expect(result).toMatchObject({ success: false, error: { name: "PortalAccessError", details: { loginPath: "/login/committee" } } });
    } finally { vi.stubGlobal("fetch", previous); }
  });

  it("never accepts an external login redirect from an error response", async () => {
    const previous = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "Tidak tersedia", details: {
      recommendedPortal: "committee", loginPath: "https://other.invalid/steal" } } }), { status: 403 })));
    try {
      const result = await authProvider.login!({ email: "committee@test.invalid", password: "fixture-password", portal: "admin" });
      expect(result.error).toMatchObject({ name: "LoginError", details: undefined });
    } finally { vi.stubGlobal("fetch", previous); }
  });

  it("confirms the HttpOnly cookie before opening a protected dashboard", async () => {
    const request = vi.fn(async () => new Response("{}", { status: 200 }));

    await expect(
      verifyPersistedSession(request as typeof fetch, "/api/v1"),
    ).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith("/api/v1/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  });

  it("rejects navigation when the cookie was not accepted", async () => {
    const request = vi.fn(async () => new Response("{}", { status: 401 }));

    await expect(
      verifyPersistedSession(request as typeof fetch, "/api/v1"),
    ).resolves.toBe(false);
  });

  it("ignores a leftover local demo identity when the server rejects the session", async () => {
    const previousFetch = globalThis.fetch;
    const previousStorage = globalThis.localStorage;
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    vi.stubGlobal("localStorage", { getItem: (key: string) => key === "yts_dev_session" ? "{\"email\":\"admin@yts.or.id\"}" : null });
    try {
      const result = await authProvider.check!({});
      expect(result.authenticated).toBe(false);
    } finally {
      vi.stubGlobal("fetch", previousFetch);
      vi.stubGlobal("localStorage", previousStorage);
    }
  });
});
