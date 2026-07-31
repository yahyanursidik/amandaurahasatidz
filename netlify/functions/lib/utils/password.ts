import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  if (password.length < 8) {
    throw new Error("Password minimal 8 karakter.");
  }
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, encodedKey] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !encodedKey) return false;

  try {
    const storedKey = Buffer.from(encodedKey, "hex");
    const suppliedKey = scryptSync(password, salt, storedKey.length);
    return storedKey.length === suppliedKey.length && timingSafeEqual(storedKey, suppliedKey);
  } catch {
    return false;
  }
}
