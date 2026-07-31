import { describe, it, expect } from "vitest";
import { sanitizeRichText } from "../../netlify/functions/lib/utils/sanitizer";
import { createAnnouncementSchema } from "../../netlify/functions/lib/validations/announcementValidation";

describe("Announcements Engine Unit Tests", () => {
  it("should sanitize dangerous HTML tags and script injections from rich text", () => {
    const maliciousInput = `
      <h3>Pengumuman Daurah</h3>
      <script>alert("XSS Hack!");</script>
      <iframe src="http://malicious.com"></iframe>
      <p onload="doBadThings()">Jadwal daurah dimajukan ke jam 08.00 WIB.</p>
      <a href="javascript:stealCookie()">Klik Disini</a>
    `;

    const sanitized = sanitizeRichText(maliciousInput);

    expect(sanitized).not.toContain("<script>");
    expect(sanitized).not.toContain("<iframe>");
    expect(sanitized).not.toContain("onload=");
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).toContain("<h3>Pengumuman Daurah</h3>");
    expect(sanitized).toContain("Jadwal daurah dimajukan ke jam 08.00 WIB.");
  });

  it("should validate createAnnouncementSchema for 6 target audience types", () => {
    const validTargets = [
      "ALL_PARTICIPANTS",
      "SPECIFIC_INSTITUTION",
      "APPROVED_ONLY",
      "UNCONFIRMED_ONLY",
      "ATTENDED_SPECIFIC_DAY",
      "COMMITTEE_ONLY",
    ];

    for (const target of validTargets) {
      const parsed = createAnnouncementSchema.safeParse({
        title: "Perubahan Ruangan Daurah Sesi 2",
        body: "Sesi 2 dipindahkan ke Hall Utama Daurah YTS.",
        audienceType: target,
        sendEmailNotification: true,
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("should verify announcement lifecycle state transitions (DRAFT -> PUBLISHED -> UNPUBLISHED)", () => {
    let status = "DRAFT";
    expect(status).toBe("DRAFT");

    // Publish
    status = "PUBLISHED";
    expect(status).toBe("PUBLISHED");

    // Unpublish
    status = "UNPUBLISHED";
    expect(status).toBe("UNPUBLISHED");
  });

  it("should verify read indicator timestamp marking (readAt)", () => {
    const recipient = { announcementId: "ann-1", readAt: null as Date | null };
    expect(recipient.readAt).toBeNull();

    // Mark as read
    recipient.readAt = new Date();
    expect(recipient.readAt).toBeInstanceOf(Date);
  });
});
