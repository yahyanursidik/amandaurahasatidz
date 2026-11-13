import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManualParticipantDialog } from "../../src/components/participants/ManualParticipantDialog";
import { ParticipantShareDialog } from "../../src/components/participants/ParticipantShareDialog";
import { ParticipantQrCard } from "../../src/components/public/ParticipantQrCard";

describe("dialog aksi tab peserta", () => {
  it("merender formulir manual dengan kolom wajib, opsional, dan konfirmasi bukan presensi", () => {
    const html = renderToStaticMarkup(<ManualParticipantDialog eventId="event-a" eventName="Liqaa Bandung" onCreated={() => undefined} />);
    expect(html).toContain("Tambah peserta manual");
    expect(html).toContain("Liqaa Bandung");
    expect(html).toContain("PENDING_REVIEW");
    expect(html).toContain('aria-haspopup="dialog"');
    for (const name of ["fullName", "email", "whatsapp", "phone", "institutionName", "address", "notes", "attendanceConfirmed"]) {
      expect(html).toContain(`name="${name}"`);
    }
    expect(html).toContain("bukan presensi/check-in");
    expect(html).toContain("tanpa menimpa data induk");
  });

  it("mode demo menjelaskan penyimpanan dinonaktifkan", () => {
    const html = renderToStaticMarkup(<ManualParticipantDialog eventId="demo" demoMode onCreated={() => undefined} />);
    expect(html).toContain("penyimpanan dinonaktifkan");
    expect(html).toMatch(/type="submit" disabled=""/);
  });

  it("tombol berbagi terikat identitas peserta dan dialog berlabel tanpa memuat token di awal", () => {
    const html = renderToStaticMarkup(<ParticipantShareDialog eventId="event-b" participantId="participant-a" participantName="Ahmad" />);
    expect(html).toContain("Bagikan akses");
    expect(html).toContain('aria-label="Bagikan akses peserta Ahmad"');
    expect(html).toContain('aria-labelledby="participant-share-participant-a"');
    expect(html).not.toContain("pqr_");
    expect(html).not.toContain("wa.me");
  });

  it("kartu pada dialog memakai aksi kontak tervalidasi tanpa tombol berbagi duplikat", () => {
    const originalWindow = globalThis.window;
    try {
      Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://contoh.id" } } });
      const html = renderToStaticMarkup(<ParticipantQrCard eventName="Liqaa" approvalStatus="APPROVED" confirmationStatus="CONFIRMED"
        person={{ fullName: "Ahmad", participantCode: "P-123", qrToken: "pqr_abc.def" }} />);
      expect(html).toContain("Simpan QR presensi");
      expect(html).toContain('aria-label="QR presensi Ahmad"');
      expect(html).not.toContain("wa.me");
      expect(html).not.toContain("t.me");
    } finally {
      if (originalWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    }
  });

  it.each([
    ["PENDING_REVIEW", "INVITED"], ["APPROVED", "INVITED"], ["WAITLISTED", "CONFIRMED"],
    ["APPROVED", "CANCELLED"], ["DECLINED", "CONFIRMED"],
  ])("tidak menampilkan QR dari respons lama untuk %s / %s", (approvalStatus, confirmationStatus) => {
    const html = renderToStaticMarkup(<ParticipantQrCard eventName="Liqaa" approvalStatus={approvalStatus} confirmationStatus={confirmationStatus}
      person={{ fullName: "Ahmad", participantCode: "P-123", qrToken: "pqr_early.def" }} />);
    expect(html).toContain("Simpan bukti pendaftaran");
    expect(html).not.toMatch(/aria-label="QR presensi|pqr_|Simpan QR presensi/);
  });
});
