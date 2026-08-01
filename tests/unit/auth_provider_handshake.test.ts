import { describe, expect, it, vi } from "vitest";
import { verifyPersistedSession } from "../../src/lib/refine/authProvider";

describe("Login session handshake", () => {
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
});
