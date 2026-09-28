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
      { qrToken: "pqr_example.signature", cardUrl: "/card?token=pqr_example.signature", participantCode: "P-ABC123" },
    ] } };
    saveRegistrationProof("registration:regular:daurah", proof);
    expect(readRegistrationProof("registration:regular:daurah")).toEqual(proof);
    expect(readRegistrationProof("registration:regular:lainnya")).toBeNull();
    values.set("registration:regular:daurah", JSON.stringify({ event: proof.event, result: { participants: [{ participantCode: "P-ABC123" }] } }));
    expect(readRegistrationProof("registration:regular:daurah")).toBeNull();
  });
});
