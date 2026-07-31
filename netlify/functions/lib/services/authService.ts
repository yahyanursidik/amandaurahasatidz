import { UserContext, UserRoleAssignment } from "../middleware/rbac";
import { getDbClient } from "../db/client";
import { users, userRoleAssignments, roles, ustadzProfiles } from "../db/schema";
import { eq, or } from "drizzle-orm";
import { RoleCode } from "../../../../src/config/permissions";
import { parseCookies } from "../utils/cookie";
import { createHmac } from "node:crypto";
import { verifyPassword } from "../utils/password";
import { UnauthorizedError, ForbiddenError } from "../utils/errors";

const SESSION_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "fallback_yts_secret_dev_2026_!@#";

function signToken(payload: any): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

function verifyToken(token: string): any | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const expectedSignature = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  if (signature !== expectedSignature) return null;
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

  const payload = {
    email: email.trim().toLowerCase(),
    expiresAt: expiresAtMs,
    userContext,
  };

  const sessionId = signToken(payload);

  return {
    sessionId,
    expiresAt: new Date(expiresAtMs),
  };
}

const PORTAL_ROLES: Record<string, RoleCode[]> = {
  admin: ["SUPER_ADMIN", "SYSTEM_ADMIN", "DATA_STEWARD", "REPORT_VIEWER", "EVENT_ADMIN"],
  committee: [
    "COMMITTEE_LEAD",
    "REGISTRATION_OFFICER",
    "CHECKIN_OFFICER",
    "INFORMATION_OFFICER",
    "EVENT_VIEWER",
  ],
  ustadz: ["USTADZ"],
};

const DEVELOPMENT_ACCOUNTS: Record<string, { password: string; role: RoleCode }> = {
  "admin@yts.or.id": { password: "DemoAsatidz2026!", role: "SUPER_ADMIN" },
  "panitia@yts.or.id": { password: "DemoAsatidz2026!", role: "CHECKIN_OFFICER" },
  "ustadz.demo@yts.or.id": { password: "DemoAsatidz2026!", role: "USTADZ" },
};

export async function authenticatePasswordService(
  email: string,
  password: string,
  portal: "admin" | "committee" | "ustadz"
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
    if (user?.status !== "ACTIVE") {
      throw new UnauthorizedError("Akun tidak aktif. Hubungi administrator.");
    }
    if (user?.passwordHash) {
      passwordValid = verifyPassword(password, user.passwordHash);
      if (passwordValid) context = await resolveUserContextFromEmail(normalizedEmail);
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
  }

  if (!passwordValid && process.env.APP_ENV !== "production") {
    const demo = DEVELOPMENT_ACCOUNTS[normalizedEmail];
    if (demo && password === demo.password) {
      passwordValid = true;
      context = {
        userId: "00000000-0000-0000-0000-000000000001",
        email: normalizedEmail,
        name: normalizedEmail.split("@")[0],
        assignments: [{ roleCode: demo.role }],
      };
    }
  }

  if (!passwordValid || !context) {
    throw new UnauthorizedError("Email atau password tidak sesuai.");
  }

  const allowedRoles = PORTAL_ROLES[portal] || [];
  if (!context.assignments.some((assignment) => allowedRoles.includes(assignment.roleCode))) {
    throw new ForbiddenError(`Akun ini tidak memiliki akses ke portal ${portal}.`);
  }

  return context;
}

export function revokeSessionToken(sessionId: string): void {
  // Stateless token revocation relies on client-side cookie clearing for now.
  // In the future, a Redis blocklist or DB sessions table could be implemented here.
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
      return payload.userContext || resolveUserContextFromEmail(payload.email);
    }
  }

  // 2. Fallback to Authorization when the cookie is absent or no longer valid.
  if (authorizationHeader) {
    const token = authorizationHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      if (token.includes(".")) {
        const payload = verifyToken(token);
        if (payload && Date.now() <= payload.expiresAt) {
          return payload.userContext || resolveUserContextFromEmail(payload.email);
        }
      } else {
        // Direct email fallback for local development and mock compatibility.
        if (process.env.APP_ENV !== "production") {
          return resolveUserContextFromEmail(token.includes("@") ? token : "admin@yts.or.id");
        }
      }
    }
  }

  return null;
}

async function resolveUserContextFromEmail(targetEmail: string): Promise<UserContext> {
  const normalizedEmail = targetEmail.trim().toLowerCase();

  try {
    const db = getDbClient();
    const foundUsers = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

    if (foundUsers.length === 0) {
      return {
        userId: "00000000-0000-0000-0000-000000000001",
        email: normalizedEmail,
        name: normalizedEmail.split("@")[0].toUpperCase(),
        assignments: [
          {
            roleCode: "SUPER_ADMIN",
            eventId: null,
            institutionId: null,
          },
        ],
      };
    }

    const userRecord = foundUsers[0];
    const assignmentsList = await db
      .select({
        roleCode: roles.code,
        eventId: userRoleAssignments.eventId,
        institutionId: userRoleAssignments.institutionId,
        startsAt: userRoleAssignments.startsAt,
        endsAt: userRoleAssignments.endsAt,
      })
      .from(userRoleAssignments)
      .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
      .where(eq(userRoleAssignments.userId, userRecord.id));

    const assignments: UserRoleAssignment[] = assignmentsList.map((a) => ({
      roleCode: a.roleCode as RoleCode,
      eventId: a.eventId,
      institutionId: a.institutionId,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
    }));
    const ustadzProfile = assignments.some((assignment) => assignment.roleCode === "USTADZ")
      ? await db
          .select({ id: ustadzProfiles.id })
          .from(ustadzProfiles)
          .where(
            or(
              eq(ustadzProfiles.userId, userRecord.id),
              eq(ustadzProfiles.email, normalizedEmail),
            ),
          )
          .limit(1)
      : [];

    return {
      userId: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      ustadzId: ustadzProfile[0]?.id || null,
      assignments,
    };
  } catch (_err) {
    return {
      userId: "00000000-0000-0000-0000-000000000001",
      email: normalizedEmail,
      name: normalizedEmail.split("@")[0].toUpperCase(),
      assignments: [{ roleCode: "SUPER_ADMIN" }],
    };
  }
}
