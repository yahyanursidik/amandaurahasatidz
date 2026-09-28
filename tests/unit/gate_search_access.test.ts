import { describe, expect, it } from "vitest";
import { searchCheckinParticipantSchema, processCheckinSchema } from "../../netlify/functions/lib/validations/attendanceValidation";
import { signParticipantQrToken, verifyParticipantQrToken } from "../../netlify/functions/lib/utils/token";

describe("gate panitia dan identitas peserta", () => {
  it("membatasi panjang pencarian di gate publik", () => {
    expect(searchCheckinParticipantSchema.safeParse({ q: "a" }).success).toBe(false);
    expect(searchCheckinParticipantSchema.parse({ q: "Ahmad" }).q).toBe("Ahmad");
  });
  it("menerima pilihan hasil nama sebagai metode SEARCH_SELECT dan menolak unit ganda", () => {
    const base = { qrTokenOrCode: "P-0001", method: "SEARCH_SELECT" };
    expect(processCheckinSchema.safeParse(base).success).toBe(true);
    expect(processCheckinSchema.safeParse({ ...base,
      sessionId: "00000000-0000-4000-8000-000000000001", dayId: "00000000-0000-4000-8000-000000000002",
    }).success).toBe(false);
  });
  it("memastikan token QR berbeda untuk setiap peserta dan terikat pada event", () => {
    const secret = "test-secret-with-enough-entropy-for-token-check";
    const eventId = "00000000-0000-4000-8000-000000000001";
    const a = signParticipantQrToken({ participantId: "00000000-0000-4000-8000-000000000002", eventId, version: 1 }, secret);
    const b = signParticipantQrToken({ participantId: "00000000-0000-4000-8000-000000000003", eventId, version: 1 }, secret);
    expect(a).not.toBe(b);
    expect(verifyParticipantQrToken(a, secret)?.eventId).toBe(eventId);
  });
});
