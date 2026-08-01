import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { roles, userRoleAssignments, users } from "../db/schema";
import { RoleCode } from "../../../../src/config/permissions";
import { AppError, UnauthorizedError } from "../utils/errors";
import { hashPassword } from "../utils/password";
import { enqueueEmailJob } from "./emailQueueService";
import { createAuditLog } from "./auditService";

type PortalCode = "admin" | "committee" | "ustadz";
type ChallengePayload = {
  kind: "password_setup";
  userId: string;
  email: string;
  portal: PortalCode;
  issuedAt: number;
  expiresAt: number;
};

const PORTAL_ROLES: Record<PortalCode, RoleCode[]> = {
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

function isProductionRuntime() {
  return process.env.APP_ENV === "production" || process.env.CONTEXT === "production";
}

function getSecret() {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (secret) return secret;
  if (isProductionRuntime()) {
    throw new AppError("Konfigurasi aktivasi akun belum lengkap.", 503, "AUTH_CONFIGURATION_ERROR");
  }
  return "fallback_aman_daurah_password_setup_dev_2026";
}

function sign(data: string) {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

function encode(payload: ChallengePayload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

function decode(token: string): ChallengePayload | null {
  const [data, signature, ...rest] = token.split(".");
  if (!data || !signature || rest.length) return null;
  const expected = Buffer.from(sign(data));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as ChallengePayload;
  } catch {
    return null;
  }
}

function codeForChallenge(challengeToken: string) {
  const digest = createHmac("sha256", getSecret())
    .update(`password-setup:${challengeToken}`)
    .digest();
  return (digest.readUInt32BE(0) % 1_000_000).toString().padStart(6, "0");
}

async function findPortalAccount(email: string, portal: PortalCode) {
  const db = getDbClient();
  const normalizedEmail = email.trim().toLowerCase();
  const user = (await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];
  if (!user || user.status !== "ACTIVE") return null;
  const assignments = await db
    .select({ roleCode: roles.code })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(eq(userRoleAssignments.userId, user.id));
  const allowed = assignments.some((assignment) =>
    PORTAL_ROLES[portal].includes(assignment.roleCode as RoleCode),
  );
  return allowed ? user : null;
}

export async function requestPasswordSetupService(
  email: string,
  portal: PortalCode,
  requestId: string,
) {
  const account = await findPortalAccount(email, portal);
  if (!account) {
    throw new UnauthorizedError("Akun aktif untuk portal ini tidak ditemukan.");
  }
  const payload: ChallengePayload = {
    kind: "password_setup",
    userId: account.id,
    email: account.email,
    portal,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  const challengeToken = encode(payload);
  const code = codeForChallenge(challengeToken);
  await enqueueEmailJob({
    templateCode: "OTP_CODE",
    recipientEmail: account.email,
    variables: { otpCode: code, expiresMinutes: 10 },
    idempotencyKey: `password_setup_${account.id}_${payload.issuedAt}`,
  });
  await createAuditLog({
    actorUserId: account.id,
    action: "PASSWORD_SETUP_REQUESTED",
    resourceType: "USER",
    resourceId: account.id,
    requestId,
  });
  return {
    challengeToken,
    expiresAt: new Date(payload.expiresAt),
    ...(isProductionRuntime() ? {} : { previewCode: code }),
  };
}

export async function completePasswordSetupService(
  input: {
    email: string;
    portal: PortalCode;
    challengeToken: string;
    otp: string;
    newPassword: string;
  },
  requestId: string,
) {
  const payload = decode(input.challengeToken);
  const email = input.email.trim().toLowerCase();
  if (
    !payload ||
    payload.kind !== "password_setup" ||
    payload.email !== email ||
    payload.portal !== input.portal ||
    payload.expiresAt < Date.now()
  ) {
    throw new UnauthorizedError("Kode aktivasi tidak valid atau sudah kedaluwarsa.");
  }
  const expected = Buffer.from(codeForChallenge(input.challengeToken));
  const received = Buffer.from(input.otp.trim());
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new UnauthorizedError("Kode aktivasi tidak sesuai.");
  }
  const account = await findPortalAccount(email, input.portal);
  if (!account || account.id !== payload.userId) {
    throw new UnauthorizedError("Akun aktif untuk portal ini tidak ditemukan.");
  }
  const db = getDbClient();
  await db
    .update(users)
    .set({ passwordHash: hashPassword(input.newPassword), updatedAt: new Date() })
    .where(and(eq(users.id, account.id), eq(users.email, email)));
  await createAuditLog({
    actorUserId: account.id,
    action: "PASSWORD_SETUP_COMPLETED",
    resourceType: "USER",
    resourceId: account.id,
    requestId,
  });
  return { email, portal: input.portal, passwordUpdated: true };
}
