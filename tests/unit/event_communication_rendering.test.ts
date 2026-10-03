import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCommunicationPreview, communicationVariables, renderFinalCommunication, type CommunicationRecipient } from "../../netlify/functions/lib/services/communicationRendering";
import { createAnnouncementSchema, communicationTemplateSchema, publishAnnouncementSchema } from "../../netlify/functions/lib/validations/announcementValidation";

const event = { name: "Daurah & Ilmu", startDate: "2026-10-01", endDate: "2026-10-03", venueName: "Aula", venueAddress: "Kota" };
const recipient = (name: string, email: string | null): CommunicationRecipient => ({
  participantId: name, institutionId: null, userId: null, name, email, participantCode: `P-${name}`, institutionName: "Sekolah",
});
afterEach(() => vi.unstubAllEnvs());

describe("event communication final rendering", () => {
  it("personalizes title/body/separate subject and exactly matches per-recipient final email", () => {
    vi.stubEnv("APP_URL", "https://portal.example.org");
    const content = { title: "Untuk {{ustadzName}}", body: "{{eventName}}\n{{participantCode}}\n{{portalLink}}", emailSubject: "Email {{ustadzName}}", sendEmailNotification: true };
    const people = [recipient("Ahmad", " A@EXAMPLE.ORG "), recipient("Ali", "a@example.org"), recipient("Hasan", null), recipient("Husain", "invalid")];
    const preview = buildCommunicationPreview(content, event, people);
    expect(preview).toMatchObject({ title: "Untuk Ahmad", emailSubject: "Email Ahmad", recipientCount: 4, emailRecipientCount: 1, duplicateEmailCount: 1, missingEmailCount: 2, unresolvedVariables: [] });
    expect(preview.samples[1]).toMatchObject({ name: "Ali", title: "Untuk Ali", emailSubject: "Email Ali" });
    expect(preview.samples[1].emailHtml).toBe(renderFinalCommunication(content, communicationVariables(event, people[1])).emailHtml);
    expect(preview.body).toContain("https://portal.example.org/portal/announcements");
    expect(preview.emailHtml).toContain("Daurah &amp; Ilmu");
  });

  it("keeps user HTML plain text and escapes all injected variable values in email HTML", () => {
    const content = { title: "Hello {{ustadzName}}", body: '<img src=x onerror="hack()"><script>hack()</script>' };
    const final = renderFinalCommunication(content, { ustadzName: "<svg onload=hack()>" });
    expect(final.body).toBe(content.body);
    expect(final.emailHtml).not.toContain("<script>");
    expect(final.emailHtml).not.toContain("<svg");
    expect(final.emailHtml).toContain("&lt;img");
    expect(final.emailSubject).toBe(final.title);
  });

  it("finds unknown/missing/malformed/editorial variables across ALL recipients, but drafts accept them", () => {
    const people = [recipient("Ahmad", null), { ...recipient("Ali", null), institutionName: null }];
    const content = { title: "{{eventName}}", body: "{{institutionName}} {{secret}} [ISI: petunjuk] {{oops", emailSubject: "{{participantCode}}" };
    const preview = buildCommunicationPreview(content, event, people);
    expect(preview.unresolvedVariables).toEqual(expect.arrayContaining(["institutionName", "secret", "[ISI: petunjuk]"]));
    expect(createAnnouncementSchema.safeParse(content).success).toBe(true);
  });

  it("blocks relative/malicious portal URLs as unresolved and limits preview samples to five", () => {
    vi.stubEnv("APP_URL", "javascript:alert(1)"); vi.stubEnv("URL", "");
    const preview = buildCommunicationPreview({ title: "Info", body: "Kunjungi {{portalLink}}" }, event,
      Array.from({ length: 10 }, (_, index) => recipient(String(index), `${index}@example.org`)));
    expect(preview.samples).toHaveLength(5);
    expect(preview.unresolvedVariables).toContain("portalLink");
    expect(preview.recipientCount).toBe(10);
  });

  it("converts legacy HTML into inert plain text for consistent portal/email preview", () => {
    const final = renderFinalCommunication({ title: "Legacy", body: "<p>Info &amp; pesan</p><script>evil()</script>", contentFormat: "LEGACY_HTML" }, {});
    expect(final.body).toBe("Info & pesan");
    expect(final.emailHtml).not.toContain("evil()");
  });

  it("validates persisted settings without forcing a publish email override", () => {
    expect(publishAnnouncementSchema.parse({})).toEqual({});
    expect(createAnnouncementSchema.safeParse({ title: "Title", body: "Some body", emailSubject: "Bad\r\nheader" }).success).toBe(false);
    const template = communicationTemplateSchema.parse({ name: "Template", title: "Title", body: "Some body", audienceType: "SPECIFIC_INSTITUTION" });
    expect(template).toMatchObject({ audienceType: "SPECIFIC_INSTITUTION", sendEmailNotification: false });
    expect(template).not.toHaveProperty("targetInstitutionId");
  });
});