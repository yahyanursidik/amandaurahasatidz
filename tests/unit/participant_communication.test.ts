import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ParticipantCommunicationPanel } from "../../src/components/communications/ParticipantCommunicationPanel";
import {
  buildParticipantEmailUrl,
  buildParticipantMessage,
  buildWhatsAppUrl,
  buildParticipantWhatsAppUrl,
  getParticipantWhatsAppNumber,
  getMissingParticipantContactFields,
  normalizeWhatsAppNumber,
} from "../../src/lib/participantCommunication";

describe("participant communication", () => {
  it("normalizes common Indonesian WhatsApp formats", () => {
    expect(normalizeWhatsAppNumber("0812 3456 7890")).toBe("6281234567890");
    expect(normalizeWhatsAppNumber("+62 812-3456-7890")).toBe("6281234567890");
    expect(normalizeWhatsAppNumber("81234567890")).toBe("6281234567890");
    expect(normalizeWhatsAppNumber("123")).toBeNull();
  });

  it("builds an encoded wa.me URL and rejects invalid numbers", () => {
    expect(buildWhatsAppUrl("081234567890", "Assalamu’alaikum\nUstadz"))
      .toBe("https://wa.me/6281234567890?text=Assalamu%E2%80%99alaikum%0AUstadz");
    expect(buildWhatsAppUrl("08", "Pesan")).toBeNull();
  });

  it("creates role-aware messages with event and participant context", () => {
    const message = buildParticipantMessage("CHECKIN_INFO", {
      senderRole: "committee",
      participant: {
        id: "p1",
        name: "Ustadz Abdullah",
        participantCode: "YTS-001",
      },
      event: { name: "Daurah Fikih", startDate: "2026-08-15" },
    });

    expect(message).toContain("Panitia Daurah Duat dan Pegiat Dakwah");
    expect(message).toContain("Daurah Fikih");
    expect(message).toContain("YTS-001");
    expect(message).toContain("Check-in tetap dilakukan per individu");
  });

  it("reports missing contact fields and creates a mailto link", () => {
    expect(getMissingParticipantContactFields({ id: "p1", name: "Ustadz" }))
      .toEqual(["nomor WhatsApp", "alamat email", "alamat domisili"]);
    expect(buildParticipantEmailUrl("ustadz@example.org", "Konfirmasi", "Isi pesan"))
      .toBe("mailto:ustadz@example.org?subject=Konfirmasi&body=Isi%20pesan");
  });

  it.each(["admin", "committee"] as const)("blocks outdated/fallback WhatsApp but leaves email usable for %s while contact review is pending", (senderRole) => {
    const participant = { id: "p1", name: "Ustadz Ahmad", email: "ahmad@example.org",
      whatsapp: "081234567890", phone: "081234567891", pendingWhatsapp: "6281234567892" };
    expect(getParticipantWhatsAppNumber(participant)).toBeNull();
    expect(buildParticipantWhatsAppUrl(participant, "Pengingat")).toBeNull();
    const html = renderToStaticMarkup(React.createElement(ParticipantCommunicationPanel, { participant, senderRole }));
    const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || [];
    expect(buttons.find((button) => button.includes("Buka WhatsApp"))).toContain('disabled=""');
    expect(buttons.find((button) => button.includes("Buka email"))).not.toContain('disabled=""');
    expect(html).toContain("Tinjau dan simpan WhatsApp pada profil dahulu");
    expect(html).not.toContain("081234567890");
    expect(buildParticipantEmailUrl(participant.email, "Pengingat", "Pesan")).toMatch(/^mailto:ahmad@example.org/);
    expect(buildParticipantWhatsAppUrl({ ...participant, pendingWhatsapp: null }, "Pengingat")).toMatch(/^https:\/\/wa.me\/6281234567890/);
  });
});
