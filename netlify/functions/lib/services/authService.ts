import { UserContext, UserRoleAssignment } from "../middleware/rbac";
import { getDbClient } from "../db/client";
import { users, userRoleAssignments, roles } from "../db/schema";
import { eq } from "drizzle-orm";
import { findOwnPortalProfileIdRepository } from "../repositories/portalProfileRepository";
import { RoleCode } from "../../../../src/config/permissions";
import { parseCookies } from "../utils/cookie";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { verifyPassword } from "../utils/password";
import { AppError, UnauthorizedError, ForbiddenError } from "../utils/errors";
import { getAccessiblePortals, hasPortalAccess, PORTAL_LABELS, PORTAL_LOGIN_PATHS, type PortalCode } from "../../../../src/config/portalAccess";

function isProductionRuntime() {
  return process.env.APP_ENV === "production" || process.env.CONTEXT === "production";
}

const localSessionSecret = randomBytes(32).toString("hex");

function getSessionSecret() {
  const configuredSecret =
    process.env.SESSION_SECRET || process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (configuredSecret) return configuredSecret;
  if (isProductionRuntime()) {
    throw new AppError(
      "Konfigurasi session production belum lengkap.",
      503,
      "AUTH_CONFIGURATION_ERROR",
    );
  }
  return localSessionSecret;
}

function signToken(payload: any): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(data).digest("base64url");
  return `${data}.${signature}`;
}

function verifyToken(token: string): any | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const expectedSignature = Buffer.from(
    createHmac("sha256", getSessionSecret()).update(data).digest("base64url"),
  );
  const receivedSignature = Buffer.from(signature);
  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

export function createSessionToken(
  email: string,
  userContext?: UserContext
): { sessionId: string; expiresAt: Date } {
  const timestamp = Date.now();
  const expiresAtMs = timestamp + 7 * 24 * 60 * 60 * 1000; // 7 days
  const normalizedEmail = email.trim().toLowerCase();

  const payload = {
    email: normalizedEmail,
    nonce: randomUUID(),
    expiresAt: expiresAtMs,
    // Production permissions are resolved from the current database state on every request.
    userContext: isProductionRuntime() ? undefined : userContext,
  };

  const sessionId = signToken(payload);
  return {
    sessionId,
    expiresAt: new Date(expiresAtMs),
  };
}

export async function authenticatePasswordService(
  email: string,
  password: string,
  portal: PortalCode
): Promise<UserContext> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@") || password.length < 8) {
    throw new UnauthorizedError("Email atau password tidak sesuai.");
  }

  let context: UserContext | null = null;
  let passwordValid = false;

  try {
    const db = getDbClient();
    const found = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    const user = found[0];
    if (!user) {
      throw new UnauthorizedError("Email atau password tidak sesuai.");
    }

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedError("Akun tidak aktif. Hubungi administrator.");
    }
    if (user.passwordHash) {
      passwordValid = verifyPassword(password, user.passwordHash);
      if (passwordValid) context = await resolveUserContextFromEmail(normalizedEmail);
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new AppError(
      "Layanan akun belum dapat menjangkau database. Coba kembali atau hubungi administrator.",
      503,
      "AUTH_DATABASE_UNAVAILABLE",
    );
  }

  if (!passwordValid || !context) {
    throw new UnauthorizedError("Email atau password tidak sesuai.");
  }

  if (!hasPortalAccess(portal, context.assignments)) {
    // Only disclose a correction after the password has been verified. Public
    // password recovery must not reveal roles based on an email address alone.
    const recommendedPortal = getAccessiblePortals(context.assignments)[0];
    throw new ForbiddenError(recommendedPortal
      ? `Email dan password benar. Gunakan ${PORTAL_LABELS[recommendedPortal]} sesuai tugas akun ini.`
      : "Akun belum memiliki peran aktif untuk portal ini. Hubungi admin untuk memeriksa masa tugas.",
    recommendedPortal ? { recommendedPortal, loginPath: PORTAL_LOGIN_PATHS[recommendedPortal] } : undefined);
  }

  return context;
}

export function revokeSessionToken(sessionId: string): void {
  // Session token bersifat stateless agar konsisten di seluruh instance Netlify.
  // Logout dilakukan dengan menghapus cookie pada klien.
  void sessionId;
}

export async function getUserSession(
  authorizationHeader?: string,
  cookieHeader?: string
): Promise<UserContext | null> {
  // 1. Resolve a valid HttpOnly session cookie first.
  const cookies = parseCookies(cookieHeader);
  const cookieSessionId = cookies["yts_session"];
  if (cookieSessionId) {
    const payload = verifyToken(cookieSessionId);
    if (payload && Date.now() <= payload.expiresAt) {
      return isProductionRuntime()
        ? resolveUserContextFromEmail(payload.email)
        : payload.userContext || resolveUserContextFromEmail(payload.email);
    }
  }

  // 2. Fallback to Authorization when the cookie is absent or no longer valid.
  if (authorizationHeader) {
    const token = authorizationHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      if (token.includes(".")) {
        const payload = verifyToken(token);
        if (payload && Date.now() <= payload.expiresAt) {
          return isProductionRuntime()
            ? resolveUserContextFromEmail(payload.email)
            : payload.userContext || resolveUserContextFromEmail(payload.email);
        }
      }
    }
  }

  return null;
}

async function resolveUserContextFromEmail(targetEmail: string): Promise<UserContext> {
  const normalizedEmail = targetEmail.trim().toLowerCase();
  const db = getDbClient();
  const foundUsers = await db.select({ id: users.id, email: users.email, name: users.name, status: users.status,
    roleCode: roles.code, eventId: userRoleAssignments.eventId, institutionId: userRoleAssignments.institutionId,
    startsAt: userRoleAssignments.startsAt, endsAt: userRoleAssignments.endsAt,
  }).from(users).leftJoin(userRoleAssignments, eq(userRoleAssignments.userId, users.id))
    .leftJoin(roles, eq(userRoleAssignments.roleId, roles.id)).where(eq(users.email, normalizedEmail));

  if (foundUsers.length === 0) {
    throw new UnauthorizedError("Akun tidak ditemukan atau belum diaktifkan.");
  }

  const userRecord = foundUsers[0];
  if (userRecord.status !== "ACTIVE") {
    throw new UnauthorizedError("Akun tidak aktif. Hubungi administrator.");
  }
  const assignments: UserRoleAssignment[] = foundUsers.filter((a) => a.roleCode).map((a) => ({
    roleCode: a.roleCode as RoleCode,
    eventId: a.eventId,
    institutionId: a.institutionId,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
  }));
  const ustadzProfile = assignments.some((assignment) => assignment.roleCode === "USTADZ")
    ? await findOwnPortalProfileIdRepository(userRecord.id)
    : undefined;

  return {
    userId: userRecord.id,
    email: userRecord.email,
    name: userRecord.name,
    ustadzId: ustadzProfile?.id || null,
    assignments,
  };
}
