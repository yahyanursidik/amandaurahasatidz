import { describe, it, expect } from "vitest";
import { createSessionToken, getUserSession } from "../../netlify/functions/lib/services/authService";

describe("Auth Service Unit Tests", () => {
  it("should return null if no authorization header is provided", async () => {
    const session = await getUserSession(undefined);
    expect(session).toBeNull();
  });

  it("should parse Bearer token and return user session context", async () => {
    const { sessionId } = createSessionToken("admin@yts.or.id", {
      userId: "00000000-0000-0000-0000-000000000001",
      email: "admin@yts.or.id",
      name: "Admin",
      assignments: [{ roleCode: "SUPER_ADMIN" }],
    });
    const session = await getUserSession(`Bearer ${sessionId}`);
    expect(session).not.toBeNull();
    expect(session?.email).toBe("admin@yts.or.id");
    expect(session?.assignments.length).toBeGreaterThan(0);
  });
});
