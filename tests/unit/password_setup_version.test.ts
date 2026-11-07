import { describe, expect, it } from "vitest";
import { credentialVersionForPasswordSetup } from "../../netlify/functions/lib/services/accountPasswordService";

describe("password setup challenge version", () => {
  it("invalidates an old challenge when the password changes", () => {
    const userId = "00000000-0000-4000-8000-000000000001";
    const initial = credentialVersionForPasswordSetup(userId, null);
    const afterSetup = credentialVersionForPasswordSetup(userId, "new-password-hash");
    const afterReset = credentialVersionForPasswordSetup(userId, "another-password-hash");
    expect(initial).not.toBe(afterSetup);
    expect(afterSetup).not.toBe(afterReset);
    expect(credentialVersionForPasswordSetup(userId, "new-password-hash")).toBe(afterSetup);
  });
});
