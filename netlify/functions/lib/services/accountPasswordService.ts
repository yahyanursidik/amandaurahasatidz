import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { roles, userRoleAssignments, users } from "../db/schema";
import { hasPortalAccess, type PortalCode } from "../../../../src/config/portalAccess";
import { AppError, UnauthorizedError } from "../utils/errors";
import { hashPassword } from "../utils/password";
import { sendImmediateTransactionalTemplate } from "./emailTransport";
import { createAuditLog } from "./auditService";

type ChallengePayload = {
  kind: "password_setup";
  userId: string;
  email: string;
  portal: PortalCode;
  issuedAt: number;
  expiresAt: number;
  credentialVersion: string;
};

function isProductionRuntime() {
  return process.env.APP_ENV === "production" || process.env.CONTEXT === "production";
}

const localSetupSecret = randomBytes(32).toString("hex");

function getSecret() {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (secret) return secret;
  if (isProductionRuntime()) {
    throw new AppError("Konfigurasi aktivasi akun belum lengkap.", 503, "AUTH_CONFIGURATION_ERROR");
  }
  return localSetupSecret;
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

export function credentialVersionForPasswordSetup(userId: string, passwordHash: string | null) {
  return createHmac("sha256", getSecret())
    .update(`${userId}:${passwordHash || "uninitialized"}`)
    .digest("base64url");
}

async function findPortalAccount(email: string, portal: PortalCode) {
  const db = getDbClient();
  const normalizedEmail = email.trim().toLowerCase();
  const user = (await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];
  if (!user || user.status !== "ACTIVE") return null;
  const assignments = await db
    .select({ roleCode: roles.code, startsAt: userRoleAssignments.startsAt, endsAt: userRoleAssignments.endsAt })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(eq(userRoleAssignments.userId, user.id));
  const allowed = hasPortalAccess(portal, assignments);
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
    credentialVersion: credentialVersionForPasswordSetup(account.id, account.passwordHash),
  };
  const challengeToken = encode(payload);
  const code = codeForChallenge(challengeToken);
  // This is a user-requested, short-lived code: do not queue or store its contents.
  try {
    const result = await sendImmediateTransactionalTemplate({
      templateCode: "OTP_CODE", recipientEmail: account.email, recipientName: account.name,
      variables: { otpCode: code, expiresMinutes: 10 }, requestId,
    });
    if (!result.success) throw new Error("Provider did not accept the message.");
  } catch {
    throw new AppError("Email kode aktivasi belum dapat dikirim. Coba lagi beberapa saat atau hubungi panitia.", 503, "ACTIVATION_EMAIL_UNAVAILABLE");
  }
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
  if (
    !account || account.id !== payload.userId ||
    payload.credentialVersion !== credentialVersionForPasswordSetup(account.id, account.passwordHash)
  ) {
    throw new UnauthorizedError("Kode aktivasi sudah tidak berlaku. Minta kode baru.");
  }
  const db = getDbClient();
  const changed = await db
    .update(users)
    .set({ passwordHash: hashPassword(input.newPassword), updatedAt: new Date() })
    .where(and(eq(users.id, account.id), eq(users.email, email), eq(users.status, "ACTIVE"),
      account.passwordHash == null ? isNull(users.passwordHash) : eq(users.passwordHash, account.passwordHash)))
    .returning({ id: users.id });
  if (!changed.length) throw new UnauthorizedError("Kode aktivasi sudah tidak berlaku. Minta kode baru.");
  await createAuditLog({
    actorUserId: account.id,
    action: "PASSWORD_SETUP_COMPLETED",
    resourceType: "USER",
    resourceId: account.id,
    requestId,
  });
  return { email, portal: input.portal, passwordUpdated: true };
}
