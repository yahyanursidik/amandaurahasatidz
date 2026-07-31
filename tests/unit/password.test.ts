import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../netlify/functions/lib/utils/password";

describe("Password hashing", () => {
  it("stores a salted scrypt hash and verifies the original password", () => {
    const password = "DemoAsatidz2026!";
    const firstHash = hashPassword(password);
    const secondHash = hashPassword(password);

    expect(firstHash).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(firstHash).not.toBe(secondHash);
    expect(verifyPassword(password, firstHash)).toBe(true);
    expect(verifyPassword("password-yang-salah", firstHash)).toBe(false);
  });
});
