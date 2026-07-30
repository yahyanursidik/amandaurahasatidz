import { describe, it, expect } from "vitest";
import { getUserSession, createSessionToken, revokeSessionToken } from "../../netlify/functions/lib/services/authService";
import { checkRateLimit } from "../../netlify/functions/lib/utils/rateLimiter";
import { generateEmailOtp, verifyEmailOtp } from "../../netlify/functions/lib/services/otpService";

describe("Authentication & Session Security Unit Tests", () => {
  it("should return null when user is not logged in (no session cookie/header)", async () => {
    const session = await getUserSession(undefined, undefined);
    expect(session).toBeNull();
  });

  it("should return valid user session context for active session cookie", async () => {
    const { sessionId } = createSessionToken("ustadz.test@yts.or.id");
    const cookieHeader = `yts_session=${sessionId}`;

    const session = await getUserSession(undefined, cookieHeader);
    expect(session).not.toBeNull();
    expect(session?.email).toBe("ustadz.test@yts.or.id");
    expect(session?.assignments.length).toBeGreaterThan(0);
  });

  it("should return null for expired/revoked session token", async () => {
    const { sessionId } = createSessionToken("expired.test@yts.or.id");
    revokeSessionToken(sessionId); // Simulate session expiration or logout revocation

    const cookieHeader = `yts_session=${sessionId}`;
    const session = await getUserSession(undefined, cookieHeader);
    expect(session).toBeNull();
  });

  it("should invalidate session upon logout", async () => {
    const { sessionId } = createSessionToken("logout.test@yts.or.id");
    const cookieHeader = `yts_session=${sessionId}`;

    // Session is initially valid
    let session = await getUserSession(undefined, cookieHeader);
    expect(session).not.toBeNull();

    // Perform logout revocation
    revokeSessionToken(sessionId);

    // Session is now revoked
    session = await getUserSession(undefined, cookieHeader);
    expect(session).toBeNull();
  });

  it("should perform session rotation when user re-authenticates", async () => {
    const email = "rotation.test@yts.or.id";
    const session1 = createSessionToken(email);
    const session2 = createSessionToken(email);

    // Previous session ID should be invalidated
    expect(session1.sessionId).not.toBe(session2.sessionId);
    const oldSession = await getUserSession(undefined, `yts_session=${session1.sessionId}`);
    expect(oldSession).toBeNull();

    // New session ID should be valid
    const newSession = await getUserSession(undefined, `yts_session=${session2.sessionId}`);
    expect(newSession).not.toBeNull();
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
