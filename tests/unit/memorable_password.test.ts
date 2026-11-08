import { describe, expect, it } from "vitest";
import { canIssueImmediatePassword, generateMemorableTemporaryPassword, memorablePasswordWordCount } from "../../netlify/functions/lib/utils/memorablePassword";
import { hashPassword, verifyPassword } from "../../netlify/functions/lib/utils/password";
import { completePasswordSetupSchema } from "../../netlify/functions/lib/validations/participantValidation";

describe("sandi sementara pendaftaran publik", () => {
  it("memakai kamus unik dan menghasilkan sandi yang mudah dibaca sekaligus acak", () => {
    expect(memorablePasswordWordCount).toBe(128);
    const generated = Array.from({ length: 40 }, generateMemorableTemporaryPassword);
    expect(new Set(generated).size).toBe(generated.length);
    for (const password of generated) {
      expect(password).toMatch(/^(?:[A-Z][a-z]+){4}\d{6}$/);
      expect(password.length).toBeGreaterThanOrEqual(20);
      expect(completePasswordSetupSchema.safeParse({ email: "ustadz@example.id", portal: "ustadz",
        challengeToken: "challenge-long-enough", otp: "123456", newPassword: password }).success).toBe(true);
    }
  });

  it("hash tersimpan dapat dipakai login tanpa menyimpan sandi teks biasa", () => {
    const password = generateMemorableTemporaryPassword();
    const hashed = hashPassword(password);
    expect(hashed).not.toContain(password);
    expect(verifyPassword(password, hashed)).toBe(true);
    expect(verifyPassword(`${password}0`, hashed)).toBe(false);
  });

  it("tidak menerbitkan sandi lewat formulir publik untuk akun atau profil lama", () => {
    expect(canIssueImmediatePassword(false, false)).toBe(true);
    expect(canIssueImmediatePassword(true, false)).toBe(false);
    expect(canIssueImmediatePassword(false, true)).toBe(false);
    expect(canIssueImmediatePassword(true, true)).toBe(false);
  });
});
