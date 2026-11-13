import { describe, expect, it } from "vitest";
import {
  createWhatsAppBatch, readWhatsAppBatch, renderWhatsAppBatchMessage, updateWhatsAppBatchStatus,
  validateWhatsAppBatchMessage, whatsappBatchProgress, whatsappBatchTemplateMessage, whatsappBatchTemplates,
  whatsappBatchUrl, WHATSAPP_BATCH_STORAGE_PREFIX,
  eventWhatsAppBatchTemplates, whatsappBatchStorageKey,
} from "../../src/lib/ustadzWhatsAppBatch";
import { eventWhatsAppCanConfirm, eventWhatsAppHref, isRepeatedEventWhatsAppNumber, parseEventWhatsAppFilters } from "../../src/lib/eventParticipantWhatsApp";

const seed = () => createWhatsAppBatch({
  id: "session-1", ownerId: "admin-1", title: "Sapaan asatidz", template: "PROFILE_GREETING",
  message: whatsappBatchTemplateMessage("PROFILE_GREETING"), senderName: "Ahmad",
  recipientIds: Array.from({ length: 30 }, (_, index) => `ustadz-${index + 1}`),
}, new Date("2026-11-08T00:00:00.000Z"));

describe("admin sequential WhatsApp workbench", () => {
  it("provides complete templates and personalizes every recipient without altering other text", () => {
    expect(whatsappBatchTemplates.map(({ id }) => id)).toEqual(["PROFILE_GREETING", "CONTACT_CHECK", "CUSTOM"]);
    const template = whatsappBatchTemplateMessage("PROFILE_GREETING");
    expect(validateWhatsAppBatchMessage(template)).toBeNull();
    expect(template).toContain("Daurah Duat dan Pegiat Dakwah");
    const message = renderWhatsAppBatchMessage(template, "Ustadz Yahya", "Admin Hasan");
    expect(message).toContain("Ustadz Yahya");
    expect(message).toContain("Admin Hasan");
    expect(message).not.toContain("{{nama}}");
    expect(whatsappBatchUrl("081234567890", message)).toContain("https://wa.me/6281234567890?text=");
    expect(whatsappBatchUrl("tidak ada", message)).toBeNull();
  });

  it("blocks unfinished custom copy and unsupported placeholders", () => {
    expect(validateWhatsAppBatchMessage(whatsappBatchTemplateMessage("CUSTOM"))).toContain("Ganti teks contoh");
    expect(validateWhatsAppBatchMessage("Pesan untuk {{nomor}} dengan tujuan pembaruan data kontak asatidz.")).toContain("Variabel");
    expect(validateWhatsAppBatchMessage("Pesan untuk {{nama dengan tujuan pembaruan data kontak asatidz.")).toContain("variabel");
  });

  it("advances one by one only after the admin opens the draft and marks it sent", () => {
    const batch = seed();
    expect(batch.recipientIds).toHaveLength(30);
    expect(whatsappBatchProgress(batch)).toMatchObject({ total: 30, remaining: 30, markedSent: 0, nextId: "ustadz-1" });
    expect(() => updateWhatsAppBatchStatus(batch, "ustadz-1", "MARKED_SENT")).toThrow(/Buka WhatsApp/);
    const opened = updateWhatsAppBatchStatus(batch, "ustadz-1", "OPENED");
    expect(whatsappBatchProgress(opened).nextId).toBe("ustadz-1");
    const sent = updateWhatsAppBatchStatus(opened, "ustadz-1", "MARKED_SENT");
    expect(whatsappBatchProgress(sent)).toMatchObject({ remaining: 29, markedSent: 1, nextId: "ustadz-2" });
    const skipped = updateWhatsAppBatchStatus(sent, "ustadz-2", "SKIPPED");
    expect(whatsappBatchProgress(skipped)).toMatchObject({ remaining: 28, skipped: 1, nextId: "ustadz-3" });
    const retry = updateWhatsAppBatchStatus(skipped, "ustadz-2", "PENDING");
    expect(whatsappBatchProgress(retry).nextId).toBe("ustadz-2");
  });

  it("restores only a valid session belonging to the current admin", () => {
    const batch = seed();
    const storage = { getItem: (key: string) => key === `${WHATSAPP_BATCH_STORAGE_PREFIX}admin-1` ? JSON.stringify(batch) : null };
    expect(readWhatsAppBatch(storage, "admin-1")?.recipientIds).toHaveLength(30);
    expect(readWhatsAppBatch(storage, "admin-2")).toBeNull();
    expect(readWhatsAppBatch({ getItem: () => JSON.stringify({ ...batch, statusById: { ...batch.statusById, "ustadz-1": "INVALID" } }) }, "admin-1")).toBeNull();
    expect(readWhatsAppBatch({ getItem: () => "{" }, "admin-1")).toBeNull();
  });

  it("enforces a bounded, deduplicated recipient queue", () => {
    const batch = seed();
    expect(createWhatsAppBatch({ ...batch, recipientIds: ["ustadz-1", "ustadz-1"] }).recipientIds).toEqual(["ustadz-1"]);
    expect(() => createWhatsAppBatch({ ...batch, recipientIds: Array.from({ length: 101 }, (_, index) => `ustadz-${index}`) })).toThrow(/Jumlah penerima/);
  });

  it("separates event sessions by event and administrator without changing the old directory key", () => {
    const batch = createWhatsAppBatch({ ...seed(), eventId: "event-a", template: "EVENT_REMINDER",
      message: whatsappBatchTemplateMessage("EVENT_REMINDER", true) });
    const data = new Map([[whatsappBatchStorageKey("admin-1", "event-a"), JSON.stringify(batch)]]);
    const storage = { getItem: (key: string) => data.get(key) || null };
    expect(readWhatsAppBatch(storage, "admin-1", "event-a")?.eventId).toBe("event-a");
    expect(readWhatsAppBatch(storage, "admin-1", "event-b")).toBeNull();
    expect(readWhatsAppBatch(storage, "admin-2", "event-a")).toBeNull();
    expect(readWhatsAppBatch(storage, "admin-1")).toBeNull();
    expect(whatsappBatchStorageKey("admin-1")).toBe(`${WHATSAPP_BATCH_STORAGE_PREFIX}admin-1`);
    expect(readWhatsAppBatch({ getItem: () => JSON.stringify(batch) }, "admin-1", "event-b")).toBeNull();
    expect(JSON.stringify(batch)).not.toContain("https://wa.me");
  });

  it("uses event placeholders once and requires an individual status link only for confirmation", () => {
    const draft = whatsappBatchTemplateMessage("EVENT_CONFIRMATION", true);
    const scope = { eventId: "event-a", template: "EVENT_CONFIRMATION" as const };
    expect(eventWhatsAppBatchTemplates.some(({ id }) => id === "EVENT_CONFIRMATION")).toBe(true);
    expect(validateWhatsAppBatchMessage(draft, scope)).toBeNull();
    expect(validateWhatsAppBatchMessage(draft.replace("{{tautan_status}}", ""), scope)).toMatch(/Sertakan/);
    expect(validateWhatsAppBatchMessage(draft, { eventId: "event-a", template: "CUSTOM" })).toMatch(/Variabel/);
    expect(validateWhatsAppBatchMessage(draft.replace("{{tautan_status}}", "https://contoh.id/confirm#pcf_foo.bar"), scope)).toMatch(/Jangan tempel/);
    const personalized = renderWhatsAppBatchMessage(draft, "Nama $& {{pengirim}}", "Admin Uji", { event: "Daurah A", tautan_status: "https://contoh.id/confirm#pcf_one.signature" });
    expect(personalized).toContain("Nama $& {{pengirim}}");
    expect(personalized).toContain("Admin Uji dari panitia Daurah A");
    expect(personalized).toContain("https://contoh.id/confirm#pcf_one.signature");
    expect(() => whatsappBatchUrl("081234567890", "Nama\uD800")).not.toThrow();
  });

  it("round-trips filters, respects local deadlines, and flags only already-contacted duplicate numbers", () => {
    const params = new URLSearchParams("page=2&source=INDIVIDUAL&search=Ustadz%20Sabar&status=WAITLISTED&invitationId=x");
    const filters = parseEventWhatsAppFilters(params);
    expect(filters).toMatchObject({ search: "Ustadz Sabar", source: "INDIVIDUAL", status: "WAITLISTED", invitationId: undefined });
    expect(eventWhatsAppHref("event-a", filters, "wizard")).toBe("/admin/events/event-a/registrations/whatsapp?search=Ustadz+Sabar&source=INDIVIDUAL&status=WAITLISTED");
    expect(eventWhatsAppHref("event-a", filters, "participants")).toMatch(/view=participants/);
    expect(eventWhatsAppCanConfirm({ id: "a", name: "Daurah", slug: "daurah", startDate: "2026-11-13", endDate: "2026-11-13",
      status: "ONGOING", timezone: "Asia/Makassar", venueName: null, attendanceConfirmationRequired: true,
      attendanceConfirmationDeadline: null, lateConfirmationPolicy: "BLOCK" }, new Date("2026-11-13T16:00:00Z"))).toBe(false);
    const first = { id: "a", fullName: "Ahmad", institutionName: null, number: "628123456789", numberSource: "WhatsApp" as const };
    const second = { ...first, id: "b", fullName: "Hasan" };
    expect(isRepeatedEventWhatsAppNumber(second, [first, second], { a: "MARKED_SENT", b: "PENDING" })).toBe(true);
    expect(isRepeatedEventWhatsAppNumber(second, [first, second], { a: "SKIPPED", b: "PENDING" })).toBe(false);
  });
});
