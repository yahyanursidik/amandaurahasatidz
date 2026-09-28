import { describe, it, expect } from "vitest";
import { getUserSession, createSessionToken, revokeSessionToken } from "../../netlify/functions/lib/services/authService";
import { checkRateLimit } from "../../netlify/functions/lib/utils/rateLimiter";
import { generateEmailOtp, verifyEmailOtp } from "../../netlify/functions/lib/services/otpService";

describe("Authentication & Session Security Unit Tests", () => {
  const contextFor = (email: string) => ({
    userId: "00000000-0000-0000-0000-000000000001",
    email,
    name: "Test User",
    assignments: [{ roleCode: "USTADZ" as const }],
  });

  it("should return null when user is not logged in (no session cookie/header)", async () => {
    const session = await getUserSession(undefined, undefined);
    expect(session).toBeNull();
  });

  it("does not accept a direct email address as a development login token", async () => {
    expect(await getUserSession("admin@yts.or.id", undefined)).toBeNull();
  });

  it("should return valid user session context for active session cookie", async () => {
    const { sessionId } = createSessionToken(
      "ustadz.test@yts.or.id",
      contextFor("ustadz.test@yts.or.id"),
    );
    const cookieHeader = `yts_session=${sessionId}`;

    const session = await getUserSession(undefined, cookieHeader);
    expect(session).not.toBeNull();
    expect(session?.email).toBe("ustadz.test@yts.or.id");
    expect(session?.assignments.length).toBeGreaterThan(0);
  });

  it("should reject a tampered session token", async () => {
    const { sessionId } = createSessionToken(
      "expired.test@yts.or.id",
      contextFor("expired.test@yts.or.id"),
    );
    const tampered = `${sessionId.slice(0, -1)}${sessionId.endsWith("a") ? "b" : "a"}`;
    expect(await getUserSession(undefined, `yts_session=${tampered}`)).toBeNull();
  });

  it("keeps session validation stateless across serverless instances", async () => {
    const { sessionId } = createSessionToken(
      "logout.test@yts.or.id",
      contextFor("logout.test@yts.or.id"),
    );
    const cookieHeader = `yts_session=${sessionId}`;

    // Session is initially valid
    let session = await getUserSession(undefined, cookieHeader);
    expect(session).not.toBeNull();

    // Revoke is intentionally a no-op; the logout endpoint clears the HttpOnly cookie.
    revokeSessionToken(sessionId);
    session = await getUserSession(undefined, cookieHeader);
    expect(session).not.toBeNull();
  });

  it("should create unique stateless session IDs when user re-authenticates", async () => {
    const email = "rotation.test@yts.or.id";
    const session1 = createSessionToken(email, contextFor(email));
    const session2 = createSessionToken(email, contextFor(email));

    expect(session1.sessionId).not.toBe(session2.sessionId);
    const oldSession = await getUserSession(undefined, `yts_session=${session1.sessionId}`);
    expect(oldSession).not.toBeNull();
    const newSession = await getUserSession(undefined, `yts_session=${session2.sessionId}`);
    expect(newSession).not.toBeNull();
  });

  it("does not embed role assignments or profile data in production tokens", () => {
    const previous = process.env.APP_ENV;
    try {
      process.env.APP_ENV = "production";
      const { sessionId } = createSessionToken("admin@yts.or.id", contextFor("admin@yts.or.id"));
      const payload = JSON.parse(Buffer.from(sessionId.split(".")[0], "base64url").toString("utf8"));
      expect(payload).not.toHaveProperty("userContext");
      expect(payload.email).toBe("admin@yts.or.id");
    } finally {
      if (previous === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previous;
    }
  });

  it("should enforce rate limiting on OTP requests (max 3 per 10 mins)", () => {
    const key = "rate_limit_test_key";
    
    // First 3 requests should be allowed
    expect(checkRateLimit(key, 3, 600000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 600000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 600000).allowed).toBe(true);

    // 4th request must be denied
    const fourthCheck = checkRateLimit(key, 3, 600000);
    expect(fourthCheck.allowed).toBe(false);
    expect(fourthCheck.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("should generate and verify short-lived email OTP code", () => {
    const email = "otp.verify@yts.or.id";
    const code = generateEmailOtp(email);
    
    expect(code).toHaveLength(6);
    expect(verifyEmailOtp(email, code)).toBe(true);
    
    // Once verified, OTP code cannot be re-used
    expect(verifyEmailOtp(email, code)).toBe(false);
  });
});
