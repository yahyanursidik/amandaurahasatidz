import { describe, expect, it } from "vitest";
import { parseParticipantCsv } from "../../src/lib/participantImportCsv";

describe("participant CSV import", () => {
  it("keeps quoted commas, line breaks, and escaped quotes in a single participant", () => {
    const rows = parseParticipantCsv(
      'fullName,email,notes,approvalStatus\r\n"Ustadz Ahmad, Lc.",ahmad@example.org,"Baris satu\nBaris ""dua""",APPROVED\r\n',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fullName: "Ustadz Ahmad, Lc.",
      email: "ahmad@example.org",
      notes: 'Baris satu\nBaris "dua"',
      approvalStatus: "APPROVED",
    });
  });

  it("preserves an invalid approval status for server validation", () => {
    expect(parseParticipantCsv("fullName,email,approvalStatus\nAhmad,ahmad@example.org,UNKNOWN")[0].approvalStatus)
      .toBe("UNKNOWN");
  });

  it("rejects malformed CSV structure before sending data to the server", () => {
    expect(() => parseParticipantCsv("fullName,email\nAhmad,ahmad@example.org,extra"))
      .toThrow(/Jumlah kolom/);
    expect(() => parseParticipantCsv('fullName,email\n"Ahmad,ahmad@example.org'))
      .toThrow(/belum ditutup/);
  });
});
