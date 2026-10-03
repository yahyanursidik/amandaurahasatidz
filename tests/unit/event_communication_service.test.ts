import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { type SQL } from "drizzle-orm";

const state = vi.hoisted(() => ({ results: [] as unknown[][], calls: [] as Array<{ action: string; table: unknown; fields?: unknown; condition?: unknown }>, queue: vi.fn(), audit: vi.fn() }));
vi.mock("../../netlify/functions/lib/services/emailQueueService", () => ({ enqueueEmailJob: state.queue }));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: state.audit }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => {
  function builder(action: string, table?: unknown) {
    const call = { action, table } as typeof state.calls[number];
    state.calls.push(call);
    const query = {
      from(value: unknown) { call.table = value; return query; },
      where(value: unknown) { call.condition = value; return query; },
      set(value: unknown) { call.fields = value; return query; },
      values(value: unknown) { call.fields = value; return query; },
      innerJoin() { return query; }, leftJoin() { return query; }, orderBy() { return query; }, limit() { return query; },
      returning() { return query; }, onConflictDoUpdate() { return query; },
      then(resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) { return Promise.resolve(state.results.shift() || []).then(resolve, reject); },
    };
    return query;
  }
  return { select: () => builder("select"), insert: (table: unknown) => builder("insert", table), update: (table: unknown) => builder("update", table), delete: (table: unknown) => builder("delete", table) };
} }));

import { createAnnouncementService, publishAnnouncementService, unpublishAnnouncementService, updateAnnouncementService, previewSavedAnnouncementService, getPortalAnnouncementsService, listCommunicationInstitutionsService } from "../../netlify/functions/lib/services/announcementService";
import { archiveCommunicationTemplateService, saveCommunicationTemplateService } from "../../netlify/functions/lib/services/communicationTemplateService";
import { eventAnnouncements, announcementRecipients, eventCommunicationTemplates } from "../../netlify/functions/lib/db/schema";

const eventId = "11111111-1111-4111-8111-111111111111";
const annId = "22222222-2222-4222-8222-222222222222";
const event = { id: eventId, name: "Daurah", startDate: "2026-10-01", endDate: "2026-10-01", venueName: "Aula", venueAddress: null };
const ann = { id: annId, eventId, title: "Info {{ustadzName}}", body: "Kode {{participantCode}}", emailSubject: "Email {{ustadzName}}",
  sendEmailNotification: true, contentFormat: "PLAIN_TEXT", audienceType: "ALL_PARTICIPANTS", targetInstitutionId: null, status: "DRAFT", updatedAt: new Date("2026-10-01T00:00:00.000Z") };
const people = [
  { participantId: "p1", institutionId: null, userId: null, name: "Ali", email: "A@example.org", participantCode: "P1", institutionName: null },
  { participantId: "p2", institutionId: null, userId: null, name: "Hasan", email: "a@example.org", participantCode: "P2", institutionName: null },
];
const dialect = new PgDialect();
function sql(call: typeof state.calls[number]) { return dialect.sqlToQuery(call.condition as SQL); }
beforeEach(() => { state.results = []; state.calls = []; state.queue.mockReset().mockResolvedValue({ isDuplicate: false }); state.audit.mockReset(); });

describe("event-scoped communication persistence and publication", () => {
  it.each(["publish", "unpublish", "patch", "preview"])("rejects another event's id before any mutation: %s", async (action) => {
    state.results = [[event], []];
    const operation = action === "publish" ? publishAnnouncementService(eventId, annId)
      : action === "unpublish" ? unpublishAnnouncementService(eventId, annId)
      : action === "preview" ? previewSavedAnnouncementService(eventId, annId)
      : updateAnnouncementService(eventId, annId, { ...ann });
    await expect(operation).rejects.toMatchObject({ statusCode: 404 });
    expect(sql(state.calls[1]).params).toEqual([annId, eventId]);
    expect(state.calls.every((call) => call.action === "select")).toBe(true);
    expect(state.queue).not.toHaveBeenCalled();
  });

  it("persists separate email subject, email flag and unknown placeholders while saving draft", async () => {
    state.results = [[event], [{ ...ann, title: "{{unknown}}" }]];
    await createAnnouncementService({ ...ann, title: "{{unknown}}" });
    expect(state.calls[1].fields).toMatchObject({ title: "{{unknown}}", emailSubject: "Email {{ustadzName}}", sendEmailNotification: true, contentFormat: "PLAIN_TEXT" });
    expect(state.calls[1].fields).toMatchObject({ createdAt: expect.any(Date), updatedAt: expect.any(Date) });
  });
  it("lists only institutions represented in this event and deduplicates them", async () => {
    const institution = { id: "i1", name: "Lembaga peserta" };
    state.results = [[event], [institution, institution]];
    expect(await listCommunicationInstitutionsService(eventId)).toEqual([institution]);
    expect(sql(state.calls[1]).params).toEqual([eventId]);
    expect(sql(state.calls[1]).sql).toContain('"event_participants"."event_id"');
  });

  it.each(["PUBLISHED", "PUBLISHING"])("rejects edits in %s", async (status) => {
    state.results = [[event], [{ ...ann, status }]];
    await expect(updateAnnouncementService(eventId, annId, ann)).rejects.toMatchObject({ statusCode: 409 });
    expect(state.calls).toHaveLength(2);
  });

  it("compares legacy timestamps at JS millisecond precision and advances revisions even within one millisecond", async () => {
    vi.spyOn(Date, "now").mockReturnValue(ann.updatedAt.getTime());
    try {
      state.results = [[event], [ann], [{ ...ann, body: "Updated body" }]];
      await updateAnnouncementService(eventId, annId, { ...ann, body: "Updated body" });
      const update = state.calls[2];
      expect(sql(update).sql).toContain('date_trunc(\'milliseconds\', "event_announcements"."updated_at")');
      expect(sql(update).sql).toContain("::timestamptz");
      expect(sql(update).params).toEqual([annId, eventId, "DRAFT", ann.updatedAt.toISOString()]);
      expect(update.fields).toMatchObject({ updatedAt: new Date(ann.updatedAt.getTime() + 1) });
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("blocks unresolved variables before claim/enqueue", async () => {
    state.results = [[event], [{ ...ann, body: "{{secret}}" }], people];
    await expect(publishAnnouncementService(eventId, annId, undefined, undefined, undefined, ann.updatedAt.toISOString())).rejects.toMatchObject({ statusCode: 422, details: { unresolvedVariables: ["secret"] } });
    expect(state.calls).toHaveLength(3); expect(state.queue).not.toHaveBeenCalled();
  });

  it("rejects stale reviewed draft revision", async () => {
    state.results = [[event], [ann]];
    await expect(publishAnnouncementService(eventId, annId, undefined, undefined, undefined, "2026-09-01T00:00:00.000Z")).rejects.toMatchObject({ statusCode: 409 });
    expect(state.calls).toHaveLength(2);
  });

  it("requires the reviewed revision for new plain-text drafts", async () => {
    state.results = [[event], [ann]];
    await expect(publishAnnouncementService(eventId, annId)).rejects.toMatchObject({ statusCode: 422 });
    expect(state.calls).toHaveLength(2);
    expect(state.queue).not.toHaveBeenCalled();
  });

  it("rejects email-option overrides that were not saved and reviewed", async () => {
    state.results = [[event], [ann]];
    await expect(publishAnnouncementService(eventId, annId, false, undefined, undefined, ann.updatedAt.toISOString())).rejects.toMatchObject({ statusCode: 409 });
    expect(state.calls).toHaveLength(2);
    expect(state.queue).not.toHaveBeenCalled();
  });

  it("rejects an empty audience without claiming or queueing", async () => {
    state.results = [[event], [{ ...ann, title: "Informasi acara", body: "Isi pesan acara" }], []];
    await expect(publishAnnouncementService(eventId, annId, undefined, undefined, undefined, ann.updatedAt.toISOString())).rejects.toMatchObject({ statusCode: 422 });
    expect(state.calls).toHaveLength(3);
    expect(state.queue).not.toHaveBeenCalled();
  });

  it("losing atomic claim does not insert grants or queue emails", async () => {
    state.results = [[event], [ann], people, []];
    await expect(publishAnnouncementService(eventId, annId, undefined, undefined, undefined, ann.updatedAt.toISOString())).rejects.toMatchObject({ statusCode: 409 });
    const claim = state.calls[3];
    expect(claim.fields).toMatchObject({ status: "PUBLISHING", sendEmailNotification: true });
    expect(sql(claim).params).toEqual([annId, eventId, "DRAFT", ann.updatedAt.toISOString()]);
    expect(sql(claim).sql).toContain("date_trunc('milliseconds'");
    expect(state.queue).not.toHaveBeenCalled();
    expect(state.calls.some((call) => call.action === "insert")).toBe(false);
  });

  it("queues only unique email and stores each personal portal snapshot; persisted email flag is respected", async () => {
    state.results = [[event], [ann], people, [{ ...ann, status: "PUBLISHING" }], [], [], [], [{ ...ann, status: "PUBLISHED" }]];
    const result = await publishAnnouncementService(eventId, annId, undefined, undefined, undefined, ann.updatedAt.toISOString());
    expect(result).toMatchObject({ recipientCount: 2, emailEnqueuedCount: 1, emailFailedCount: 0 });
    expect(state.calls.find((call) => call.action === "delete")?.table).toBe(announcementRecipients);
    const inserts = state.calls.filter((call) => call.action === "insert");
    expect(inserts.map((call) => call.fields)).toEqual([
      expect.objectContaining({ renderedTitle: "Info Ali", renderedBody: "Kode P1" }),
      expect.objectContaining({ renderedTitle: "Info Hasan", renderedBody: "Kode P2" }),
    ]);
    expect(state.queue).toHaveBeenCalledOnce();
    expect(state.queue.mock.calls[0][0]).toMatchObject({ templateCode: "ANNOUNCEMENT_CUSTOM", eventId, recipientEmail: "a@example.org", renderedContent: { subject: "Email Ali", bodyText: "Info Ali\n\nKode P1" } });
    expect(state.queue.mock.calls[0][0].renderedContent.htmlBody).toContain("Kode P1");
  });

  it("reports enqueue failures separately from portal publication", async () => {
    state.queue.mockRejectedValue(new Error("Queue unavailable"));
    state.results = [[event], [ann], [people[0]], [{ ...ann, status: "PUBLISHING" }], [], [], [{ ...ann, status: "PUBLISHED" }]];
    const result = await publishAnnouncementService(eventId, annId, undefined, undefined, undefined, ann.updatedAt.toISOString());
    expect(result).toMatchObject({ recipientCount: 1, emailEnqueuedCount: 0, emailFailedCount: 1 });
    expect(result.announcement.status).toBe("PUBLISHED");
  });

  it("portal uses personal plain-text snapshot, not template body or HTML entities", async () => {
    state.results = [[{ ...ann, renderedTitle: "Info Ali", renderedBody: "P1 & <not-html>", publishedAt: new Date(), readAt: null }]];
    expect((await getPortalAnnouncementsService(["p1"]))[0]).toMatchObject({ title: "Info Ali", body: "P1 & <not-html>", isRead: false });
  });

  it("template edits and archives are event scoped and never mutate announcements", async () => {
    for (const operation of [() => archiveCommunicationTemplateService(eventId, annId, "actor", "request"),
      () => saveCommunicationTemplateService(eventId, annId, { name: "Updated" }, "actor", "request")]) {
      state.results = [[event], []]; state.calls = [];
      await expect(operation()).rejects.toMatchObject({ statusCode: 404 });
      expect(state.calls[1].table).toBe(eventCommunicationTemplates);
      expect(sql(state.calls[1]).params).toEqual([annId, eventId]);
      expect(state.calls.some((call) => call.action === "update" && call.table === eventAnnouncements)).toBe(false);
    }
  });
});