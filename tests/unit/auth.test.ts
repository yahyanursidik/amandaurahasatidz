import { describe, it, expect } from "vitest";
import { getUserSession } from "../../netlify/functions/lib/services/authService";

describe("Auth Service Unit Tests", () => {
  it("should return null if no authorization header is provided", async () => {
    const session = await getUserSession(undefined);
    expect(session).toBeNull();
  });

  it("should parse Bearer token and return user session context", async () => {
    const session = await getUserSession("Bearer admin@yts.or.id");
    expect(session).not.toBeNull();
    expect(session?.email).toBe("admin@yts.or.id");
    expect(session?.assignments.length).toBeGreaterThan(0);
  });
});
