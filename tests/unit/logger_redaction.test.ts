import { describe, expect, it, vi } from "vitest";
import { logError, logInfo, maskSensitiveData, redactSensitiveText } from "../../netlify/functions/lib/utils/logger";

describe("redaksi akses pribadi pada log", () => {
  it("menghapus token undangan, bukti, QR, dan akses dari pesan request", () => {
    for (const token of ["inv_inst_abc123", "inv_ind_abc123", "inv_self_abc123", "pcf_payload.signature", "prc_payload.signature", "pqr_payload.signature", "kpair_example", "loc_qr_example"]) {
      expect(redactSensitiveText(`POST /public/${token}/response`)).toBe("POST /public/[REDACTED]/response");
    }
  });
  it("menyensor metadata bertingkat dan kesalahan tanpa mencetak secret", () => {
    expect(maskSensitiveData({ context: { path: "/inv_ind_example", token: "hidden" } }))
      .toEqual({ context: { path: "/[REDACTED]", token: "[REDACTED]" } });
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      logInfo("test", "GET /inv_ind_example"); logError("test", "pcf_payload.signature", new Error("failed pqr_payload.signature"));
      expect(JSON.stringify([info.mock.calls, error.mock.calls])).not.toMatch(/inv_ind_|pcf_|pqr_/);
    } finally { info.mockRestore(); error.mockRestore(); }
  });
});
