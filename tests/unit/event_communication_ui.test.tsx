import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BUILTIN_COMMUNICATION_TEMPLATES } from "../../src/lib/communicationTemplates";
import {
  COMMUNICATION_AUDIENCES, canPublishCommunication, communicationEditorReducer, communicationFields,
  communicationFingerprint, createCommunicationEditor, emptyCommunication, filterCommunicationDrafts,
  hasCommunicationPermission, isCommunicationDirty, localCommunicationPreview, validateCommunication,
  type CommunicationDraft, type CommunicationEditorState, type CommunicationPreview, type CommunicationPermissions,
} from "../../src/lib/eventCommunications";
import { CommunicationPreviewCard, EventCommunicationCenter, canPreviewCommunication, canSwitchCommunicationEvent, getCommunicationNavigationState } from "../../src/components/admin/events/EventCommunicationCenter";

vi.mock("../../src/lib/eventApi", () => ({ eventApi: vi.fn() }));
import { eventApi } from "../../src/lib/eventApi";

const fields = { ...emptyCommunication(), title: "Info {{eventName}}", emailSubject: "Subjek berbeda {{ustadzName}}", body: "Selamat datang {{ustadzName}}. Kode: {{participantCode}}.", sendEmailNotification: true };
const draft: CommunicationDraft = { ...fields, id: "draft-1", status: "DRAFT", updatedAt: "2026-10-03T00:00:00.000Z" };
const previewData = (): CommunicationPreview => ({ ...localCommunicationPreview(fields), updatedAt: draft.updatedAt, warnings: [] });
function savedState(): CommunicationEditorState {
  return communicationEditorReducer(createCommunicationEditor(), { type: "saved", draft });
}
function readyState(): CommunicationEditorState {
  const state = communicationEditorReducer(savedState(), { type: "preview", data: previewData(), saved: true });
  return communicationEditorReducer(state, { type: "confirm", value: true });
}

describe("editor komunikasi dan gerbang publikasi", () => {
  it("draft baru kosong tidak kotor; draft baru dari template atau duplikat perlu disimpan", () => {
    expect(isCommunicationDirty(createCommunicationEditor())).toBe(false);
    const applied = communicationEditorReducer(createCommunicationEditor(), { type: "open", fields });
    expect(isCommunicationDirty(applied)).toBe(true);
    expect(applied.draftId).toBeNull();
    expect(canPublishCommunication(applied)).toBe(false);
  });
  it("membuka draft mempertahankan subjek terpisah, target, dan pilihan email", () => {
    const state = communicationEditorReducer(createCommunicationEditor(), { type: "open", fields: { ...fields, audienceType: "SPECIFIC_INSTITUTION", targetInstitutionId: "institution-1" }, draftId: draft.id });
    expect(state.fields.emailSubject).not.toBe(state.fields.title);
    expect(state.fields.sendEmailNotification).toBe(true);
    expect(state.fields.targetInstitutionId).toBe("institution-1");
    expect(isCommunicationDirty(state)).toBe(false);
  });
  it("simpan menetapkan baseline baru tanpa mempertahankan pratinjau atau persetujuan", () => {
    const saved = communicationEditorReducer(readyState(), { type: "saved", draft: { ...draft, sendEmailNotification: false } });
    expect(saved.fields.sendEmailNotification).toBe(false);
    expect(isCommunicationDirty(saved)).toBe(false);
    expect(saved.preview).toBeNull();
    expect(saved.confirmed).toBe(false);
  });
  it("hanya publikasi dari pratinjau tersimpan, segar, dan persetujuan eksplisit", () => {
    expect(canPublishCommunication(readyState())).toBe(true);
    expect(canPublishCommunication(savedState())).toBe(false);
    expect(canPublishCommunication({ ...readyState(), confirmed: false })).toBe(false);
    expect(canPublishCommunication(readyState(), true)).toBe(false);
    expect(canPublishCommunication({ ...readyState(), draftId: null })).toBe(false);
  });
  it.each(["title", "body", "emailSubject", "audienceType", "targetInstitutionId", "sendEmailNotification"] as const)("perubahan %s membatalkan preview dan persetujuan", (field) => {
    const value = field === "sendEmailNotification" ? false : "changed";
    const state = communicationEditorReducer(readyState(), { type: "change", fields: { [field]: value } });
    expect(state.preview).toBeNull();
    expect(state.confirmed).toBe(false);
    expect(canPublishCommunication(state)).toBe(false);
  });
  it("ubah lalu kembalikan isi tetap wajib pratinjau ulang", () => {
    const changed = communicationEditorReducer(readyState(), { type: "change", fields: { title: "Judul baru" } });
    const reverted = communicationEditorReducer(changed, { type: "change", fields: { title: fields.title } });
    expect(isCommunicationDirty(reverted)).toBe(false);
    expect(canPublishCommunication({ ...reverted, confirmed: true })).toBe(false);
  });
  it("menolak respons pratinjau async untuk revisi editor lama", () => {
    const state = savedState();
    const changed = communicationEditorReducer(state, { type: "change", fields: { body: "Pesan terbaru" } });
    const result = communicationEditorReducer(changed, { type: "preview", data: previewData(), saved: true, expectedRevision: state.revision });
    expect(result).toBe(changed);
    expect(result.preview).toBeNull();
  });
  it("menerima pratinjau untuk revisi tepat termasuk janji lokal langsung", () => {
    const state = communicationEditorReducer(savedState(), { type: "invalidate" });
    const result = communicationEditorReducer(state, { type: "preview", data: previewData(), saved: true, expectedRevision: state.revision });
    expect(result.preview?.revision).toBe(state.revision);
    expect(result.confirmed).toBe(false);
  });
  it("pratinjau belum tersimpan tidak membuka publikasi", () => {
    const state = communicationEditorReducer(savedState(), { type: "preview", data: previewData(), saved: false });
    expect(canPublishCommunication({ ...state, confirmed: true })).toBe(false);
  });
  it.each(["PUBLISHED", "PUBLISHING", "UNKNOWN", "ARCHIVED"])("status %s tidak dapat dipublikasikan", (status) => {
    expect(canPublishCommunication({ ...readyState(), status })).toBe(false);
  });
  it("UNPUBLISHED diizinkan sesuai backend setelah pratinjau baru", () => {
    expect(canPublishCommunication({ ...readyState(), status: "UNPUBLISHED" })).toBe(true);
  });
  it("identitas draft, fingerprint, dan revisi preview harus cocok", () => {
    const state = readyState();
    for (const patch of [{ draftId: "other" }, { fingerprint: "other" }, { revision: -1 }]) {
      expect(canPublishCommunication({ ...state, preview: { ...state.preview!, ...patch } })).toBe(false);
    }
  });
  it("tanpa penerima, revision server, atau dengan variabel unresolved tidak boleh publish", () => {
    const state = readyState();
    for (const patch of [{ recipientCount: 0 }, { updatedAt: undefined }, { unresolvedVariables: ["eventVenue"] }]) {
      expect(canPublishCommunication({ ...state, preview: { ...state.preview!, data: { ...state.preview!.data, ...patch } } })).toBe(false);
    }
  });
  it("refresh membatalkan pratinjau namun tidak menghilangkan edit belum disimpan", () => {
    const state = communicationEditorReducer(readyState(), { type: "change", fields: { body: "Isi terbaru" } });
    const refreshed = communicationEditorReducer(state, { type: "invalidate" });
    expect(refreshed.fields.body).toBe("Isi terbaru");
    expect(isCommunicationDirty(refreshed)).toBe(true);
    expect(refreshed.preview).toBeNull();
  });
  it("token preview server harus cocok dengan versi draft yang dibuka", () => {
    const state = readyState();
    expect(canPublishCommunication({ ...state, preview: { ...state.preview!, data: { ...state.preview!.data, expectedUpdatedAt: "2026-10-03T02:00:00.000Z" } } })).toBe(false);
    expect(canPublishCommunication({ ...state, preview: { ...state.preview!, data: { ...state.preview!.data, expectedUpdatedAt: draft.updatedAt, updatedAt: undefined } } })).toBe(true);
  });
});

describe("validasi dan normalisasi komunikasi", () => {
  it("mendukung audiens panitia yang tersedia di backend", () => {
    expect(COMMUNICATION_AUDIENCES.map((item) => item.value)).toContain("COMMITTEE_ONLY");
    expect(validateCommunication({ ...fields, audienceType: "COMMITTEE_ONLY" })).toEqual([]);
  });
  it("memvalidasi judul, isi, subjek email, lembaga, dan variabel whitelist", () => {
    expect(validateCommunication(fields)).toEqual([]);
    expect(validateCommunication({ ...fields, title: "x", body: "x", emailSubject: "", audienceType: "SPECIFIC_INSTITUTION", targetInstitutionId: null })).toHaveLength(4);
    expect(validateCommunication({ ...fields, body: "Halo {{password}} {{ustadzName}}" }).join(" ")).toContain("password");
    expect(validateCommunication({ ...fields, sendEmailNotification: false, emailSubject: "" })).toEqual([]);
  });
  it("menghapus target lembaga usang dari segmen umum tanpa membuang pilihan email", () => {
    expect(communicationFields({ ...fields, targetInstitutionId: "stale" })).toEqual({ ...fields, targetInstitutionId: null });
    expect(communicationFields({ title: "Legacy", body: "Isi pesan", audienceType: "ALL_PARTICIPANTS" }).sendEmailNotification).toBe(false);
  });
  it("fingerprint stabil pada urutan properti dan mempertahankan whitespace konten", () => {
    expect(communicationFingerprint(fields)).toBe(communicationFingerprint({ ...fields, title: fields.title }));
    expect(communicationFingerprint({ ...fields, body: `${fields.body} ` })).not.toBe(communicationFingerprint(fields));
  });
  it("pencarian menggabungkan judul, subjek, isi, dan status", () => {
    const list = [draft, { ...draft, id: "published", status: "PUBLISHED", title: "Jadwal", body: "Registrasi aula" }];
    expect(filterCommunicationDrafts(list, " SUBJEK BERBEDA ", "DRAFT")).toEqual([draft]);
    expect(filterCommunicationDrafts(list, "aula", "ALL").map((item) => item.id)).toEqual(["published"]);
    expect(filterCommunicationDrafts(list, "Info", "PUBLISHED")).toEqual([]);
  });
  it("contoh lokal merender semua whitelist tanpa peringatan unresolved palsu", () => {
    const data = localCommunicationPreview({ ...fields, body: COMMUNICATION_AUDIENCES[0].label + " {{eventName}} {{eventDates}} {{eventVenue}} {{portalLink}} {{ustadzName}} {{participantCode}} {{institutionName}}" });
    expect(data.unresolvedVariables).toEqual([]);
    expect(data.body).not.toContain("{{");
    expect(data.warnings.join(" ")).toContain("Data contoh lokal");
  });
  it("placeholder editorial atau braces rusak muncul sebagai unresolved", () => {
    const data = localCommunicationPreview({ ...fields, body: "Halo [ISI: tautan resmi] {{eventName" });
    expect(data.unresolvedVariables).toContain("[ISI: tautan resmi]");
    expect(data.unresolvedVariables).toContain("Placeholder tidak lengkap");
  });
  it("HTML contoh meng-escape konten plain text", () => {
    const data = localCommunicationPreview({ ...fields, body: '<script>alert("x")</script> & pesan' });
    expect(data.emailHtml).not.toContain("<script>");
    expect(data.emailHtml).toContain("&lt;script&gt;");
    expect(data.body).toContain("<script>");
  });
});

describe("izin komunikasi lingkup program", () => {
  const permissions = (roleCode: CommunicationPermissions["assignments"][number]["roleCode"], eventId: string | null = "event-a"): CommunicationPermissions => ({
    effectivePermissions: ["announcements.read", "announcements.manage", "announcements.publish"], assignments: [{ roleCode, eventId }],
  });
  it("information officer dapat mengelola tapi tidak mempublikasikan", () => {
    expect(hasCommunicationPermission(permissions("INFORMATION_OFFICER"), "event-a", "announcements.manage")).toBe(true);
    expect(hasCommunicationPermission(permissions("INFORMATION_OFFICER"), "event-a", "announcements.publish")).toBe(false);
  });
  it("menolak lingkup berbeda, role tanpa scope, kedaluwarsa, atau belum aktif", () => {
    expect(hasCommunicationPermission(permissions("EVENT_ADMIN", "event-b"), "event-a", "announcements.manage")).toBe(false);
    expect(hasCommunicationPermission(permissions("EVENT_ADMIN", null), "event-a", "announcements.manage")).toBe(false);
    for (const dates of [{ endsAt: "2025-01-01" }, { startsAt: "2035-01-01" }]) {
      const info = permissions("EVENT_ADMIN"); info.assignments[0] = { ...info.assignments[0], ...dates };
      expect(hasCommunicationPermission(info, "event-a", "announcements.manage", new Date("2026-01-01"))).toBe(false);
    }
  });
  it("gagal tertutup dan memperbolehkan superadmin global", () => {
    expect(hasCommunicationPermission(null, "event-a", "announcements.publish")).toBe(false);
    expect(hasCommunicationPermission(permissions("SUPER_ADMIN", null), "event-a", "announcements.publish")).toBe(true);
    expect(hasCommunicationPermission({ ...permissions("EVENT_ADMIN"), effectivePermissions: [] }, "event-a", "announcements.manage")).toBe(false);
  });
});

describe("UI komunikasi SSR tanpa pengiriman nyata", () => {
  it("laporan perubahan mencakup draft kotor, editor template terbuka, dan permintaan tertunda", () => {
    expect(getCommunicationNavigationState(false, false, false)).toEqual({ hasUnsavedChanges: false, pending: false });
    expect(getCommunicationNavigationState(true, false, false)).toEqual({ hasUnsavedChanges: true, pending: false });
    expect(getCommunicationNavigationState(false, true, false)).toEqual({ hasUnsavedChanges: true, pending: false });
    expect(getCommunicationNavigationState(false, false, true)).toEqual({ hasUnsavedChanges: false, pending: true });
  });
  it("perpindahan event mengonfirmasi draft/template belum disimpan, dan tidak boleh saat permintaan tertunda", () => {
    const confirm = vi.fn(() => false);
    expect(canSwitchCommunicationEvent(getCommunicationNavigationState(true, false, false), "a", "b", confirm)).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    expect(canSwitchCommunicationEvent(getCommunicationNavigationState(false, true, false), "a", "b", confirm)).toBe(true);
    confirm.mockClear();
    expect(canSwitchCommunicationEvent(getCommunicationNavigationState(false, false, true), "a", "b", confirm)).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(canSwitchCommunicationEvent(getCommunicationNavigationState(false, false, false), "a", "b", confirm)).toBe(true);
    expect(canSwitchCommunicationEvent(getCommunicationNavigationState(true, true, true), "a", "a", confirm)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
  it("izin baca hanya memperbolehkan pratinjau tersimpan, bukan scratch atau unsaved preview", () => {
    expect(canPreviewCommunication(false, true, true, false)).toBe(true);
    expect(canPreviewCommunication(false, true, false, false)).toBe(false);
    expect(canPreviewCommunication(false, false, true, false)).toBe(false);
    expect(canPreviewCommunication(true, true, false, false)).toBe(true);
    expect(canPreviewCommunication(false, false, false, true)).toBe(true);
  });
  it("menampilkan editor terpisah, pustaka, filter, notice lokal, dan publikasi disabled", () => {
    const html = renderToStaticMarkup(<EventCommunicationCenter eventId="example" previewMode />);
    for (const text of ["Pusat komunikasi", "Pustaka template", "Cari template", "Kategori template", "Subjek email (terpisah", "Isi pesan — teks biasa", "Segmen penerima", "Antrekan notifikasi email", "Pratinjau contoh", "Simpan draft lokal", "Mode contoh lokal", "Konfirmasi publikasi", "Daftar draft", "Cari pengumuman", "Status pengumuman"]) expect(html).toContain(text);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*?Publikasikan pengumuman/s);
    expect(html).toContain('value="COMMITTEE_ONLY"');
    expect(html).toContain("grid-cols-2");
    expect(eventApi).not.toHaveBeenCalled();
  });
  it("semua template bawaan hadir dengan penanda hanya baca", () => {
    const html = renderToStaticMarkup(<EventCommunicationCenter eventId="sample" previewMode />);
    for (const template of BUILTIN_COMMUNICATION_TEMPLATES) expect(html).toContain(template.name);
    expect(html).toContain("Bawaan · hanya baca");
    expect(html).not.toContain("Edit template</button>");
  });
  it("SSR mode server tidak memberi akses mutasi sebelum izin dimuat", () => {
    const html = renderToStaticMarkup(<EventCommunicationCenter eventId="event-a" />);
    expect(html).toContain("Memuat draft, template, dan lembaga");
    expect(html).not.toContain("Publikasikan pengumuman");
    expect(html).not.toContain("Simpan sebagai template");
    expect(html).toMatch(/<fieldset disabled=""/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Gunakan template<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*<svg[\s\S]*?<\/svg>Pratinjau tanpa menyimpan<\/button>/);
    expect(eventApi).not.toHaveBeenCalled();
  });
  it("callback parent opsional dan tidak dijalankan selama SSR", () => {
    const callback = vi.fn();
    renderToStaticMarkup(<EventCommunicationCenter eventId="local" previewMode onUnsavedChange={callback} />);
    expect(callback).not.toHaveBeenCalled();
    expect(eventApi).not.toHaveBeenCalled();
  });
  it("kartu preview menampilkan hitungan, sample, dan iframe sandbox kosong", () => {
    const data = { ...previewData(), recipientCount: 20, emailRecipientCount: 16, missingEmailCount: 3, duplicateEmailCount: 1 };
    const html = renderToStaticMarkup(<CommunicationPreviewCard snapshot={{ data, draftId: draft.id, fingerprint: "fp", revision: 1 }} localOnly={false} sampleIndex={0} onSampleChange={() => undefined} />);
    for (const text of ["draft tersimpan", "Penerima portal", "Email unik valid", "Tanpa email valid", "Email duplikat", "Contoh personalisasi", "Ustadz Ahmad", "Subjek email"]) expect(html).toContain(text);
    expect(html).toContain('sandbox=""');
    expect(html).toContain("srcDoc=");
    expect(html).not.toContain("allow-scripts");
    expect(html).not.toContain("Variabel belum terisi");
    expect(html).not.toContain("{{ustadzName}}");
  });
  it("pilihan sample mengubah HTML sesuai penerima dan mengescape srcDoc", () => {
    const data = previewData(); data.emailHtml = "<p>Utama</p>"; data.samples[0].emailHtml = "<p>Sample khusus</p>";
    const html = renderToStaticMarkup(<CommunicationPreviewCard snapshot={{ data, draftId: draft.id, fingerprint: "fp", revision: 1 }} localOnly={false} sampleIndex={0} onSampleChange={() => undefined} />);
    expect(html).toContain("&lt;p&gt;Sample khusus&lt;/p&gt;");
    expect(html).not.toContain("&lt;p&gt;Utama&lt;/p&gt;");
  });
  it("menampilkan warnings dan unresolved tanpa klaim terkirim", () => {
    const data = { ...previewData(), warnings: ["Tiga penerima tidak memiliki email valid"], unresolvedVariables: ["eventVenue", "[ISI: tautan]"] };
    const html = renderToStaticMarkup(<CommunicationPreviewCard snapshot={{ data, draftId: null, fingerprint: "fp", revision: 1 }} localOnly={false} sampleIndex={-1} onSampleChange={() => undefined} />);
    expect(html).toContain("belum disimpan");
    expect(html).toContain("Tiga penerima tidak memiliki email valid");
    expect(html).toContain("Variabel belum terisi: eventVenue, [ISI: tautan]");
    expect(html).toContain('role="alert"');
    expect(html).toContain("Pratinjau tidak mengirim pesan");
    expect(eventApi).not.toHaveBeenCalled();
  });
});