import { afterEach, describe, expect, it, vi } from "vitest";
import { readRegistrationProof, saveRegistrationProof } from "../../src/lib/registrationProof";

afterEach(() => vi.unstubAllGlobals());

describe("bukti pendaftaran pada tab yang sama", () => {
  it("memulihkan kartu lengkap setelah state halaman dibuat ulang tanpa mencampur acara", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { sessionStorage: {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    } });
    const proof = { event: { name: "Daurah" }, result: { participants: [
      { registrationStatusUrl: "/confirm#pcf_example.signature", participantCode: "P-ABC123" },
    ] } };
    saveRegistrationProof("registration:regular:daurah", proof);
    expect(readRegistrationProof("registration:regular:daurah")).toEqual(proof);
    expect(readRegistrationProof("registration:regular:lainnya")).toBeNull();
    values.set("registration:regular:daurah", JSON.stringify({ event: proof.event, result: { participants: [{ participantCode: false }] } }));
    expect(readRegistrationProof("registration:regular:daurah")).toBeNull();
  });

  it("menyimpan tautan status, bukan QR lama atau sandi sementara", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { sessionStorage: {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    } });
    const proof = { event: { name: "Daurah" }, result: { participants: [
      { qrToken: "pqr_example.signature", cardUrl: "/card?token=pqr_example.signature", participantCode: "P-ABC123",
        registrationStatusUrl: "/confirm#pcf_example.signature",
        email: "ahmad@example.id", temporaryPassword: "BukuTamanPagiSabar123456", temporaryPasswordIssued: true },
    ] } };
    saveRegistrationProof("registration:regular:daurah", proof);
    expect(values.get("registration:regular:daurah")).not.toContain("BukuTamanPagiSabar123456");
    expect(values.get("registration:regular:daurah")).not.toContain("pqr_");
    values.set("registration:regular:daurah", JSON.stringify(proof));
    expect(readRegistrationProof("registration:regular:daurah")?.result.participants?.[0]).toMatchObject({
      participantCode: "P-ABC123", temporaryPasswordIssued: true, registrationStatusUrl: "/confirm#pcf_example.signature",
    });
    expect(readRegistrationProof("registration:regular:daurah")?.result.participants?.[0]).not.toHaveProperty("qrToken");
  });

  it("menjaga sandi akun rombongan undangan tetap sekali tampil", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { sessionStorage: {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    } });
    const key = "registration:invitation:institution:token";
    saveRegistrationProof(key, { event: { event: { name: "Daurah" } }, result: {
      participants: [{ qrToken: "pqr_inv.signature", cardUrl: "/card?token=pqr_inv.signature", participantCode: "P-INV" }],
      portalAccounts: [{ participantId: "a", temporaryPassword: "BukuTamanPagiSabar123456", temporaryPasswordIssued: true }],
    } });
    expect(values.get(key)).not.toContain("BukuTamanPagiSabar123456");
    expect(readRegistrationProof(key)?.result).toMatchObject({ portalAccounts: [{ temporaryPasswordIssued: true }] });
  });
});
