import { describe, expect, it } from "vitest";
import { signParticipantConfirmationToken, verifyParticipantConfirmationToken, verifyParticipantQrToken } from "../../netlify/functions/lib/utils/token";
import { participantConfirmationPath, signConfirmationForParticipant } from "../../netlify/functions/lib/services/participantConfirmationLink";

const participantId = "123e4567-e89b-42d3-a456-426614174000";
const eventId = "123e4567-e89b-42d3-a456-426614174001";

describe("tautan konfirmasi pribadi", () => {
  it("mengikat peserta dan event, bukan token QR; tidak bocor ke path atau query", () => {
    const token = signConfirmationForParticipant({ id: participantId, eventId }, "2099-11-11");
    expect(verifyParticipantConfirmationToken(token)).toMatchObject({ participantId, eventId });
    expect(verifyParticipantQrToken(token)).toBeNull();
    expect(participantConfirmationPath(token)).toBe(`/confirm#${encodeURIComponent(token)}`);
    expect(verifyParticipantConfirmationToken(`${token}x`)).toBeNull();
  });

  it("menolak token yang kedaluwarsa", () => {
    const token = signParticipantConfirmationToken({ participantId, eventId, expiresAt: 2_000_000_000_000 });
    expect(verifyParticipantConfirmationToken(token, 1_999_999_999_999)).not.toBeNull();
    expect(verifyParticipantConfirmationToken(token, 2_000_000_000_000)).toBeNull();
  });
});
