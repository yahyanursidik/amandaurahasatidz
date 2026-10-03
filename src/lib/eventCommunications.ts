import { COMMUNICATION_VARIABLES, findCommunicationVariables, renderCommunicationText, getUnresolvedCommunicationVariables } from "./communicationTemplates";
import { ROLE_PERMISSIONS, type RoleCode, type PermissionCode } from "../config/permissions";

export type CommunicationPermissions = {
  effectivePermissions: string[];
  assignments: Array<{ roleCode: RoleCode; eventId?: string | null; startsAt?: string | null; endsAt?: string | null }>;
};
export function hasCommunicationPermission(permissions: CommunicationPermissions | null, eventId: string, action: PermissionCode, now = new Date()): boolean {
  if (!permissions?.effectivePermissions.includes(action)) return false;
  return permissions.assignments.some((assignment) => {
    if (assignment.startsAt && new Date(assignment.startsAt) > now) return false;
    if (assignment.endsAt && new Date(assignment.endsAt) < now) return false;
    if (!ROLE_PERMISSIONS[assignment.roleCode]?.includes(action)) return false;
    if (assignment.roleCode === "SUPER_ADMIN") return true;
    if (assignment.eventId) return assignment.eventId === "*" || assignment.eventId === eventId;
    return !["EVENT_ADMIN", "COMMITTEE_LEAD", "REGISTRATION_OFFICER", "CHECKIN_OFFICER", "INFORMATION_OFFICER", "EVENT_VIEWER"].includes(assignment.roleCode);
  });
}

export const COMMUNICATION_AUDIENCES = [
  { value: "ALL_PARTICIPANTS", label: "Semua peserta" },
  { value: "APPROVED_ONLY", label: "Peserta disetujui" },
  { value: "UNCONFIRMED_ONLY", label: "Belum konfirmasi" },
  { value: "ATTENDED_SPECIFIC_DAY", label: "Peserta yang sudah hadir" },
  { value: "SPECIFIC_INSTITUTION", label: "Lembaga tertentu" },
  { value: "COMMITTEE_ONLY", label: "Panitia" },
] as const;

export type CommunicationFields = {
  title: string; emailSubject: string; body: string; audienceType: string;
  targetInstitutionId: string | null; sendEmailNotification: boolean;
};
export type CommunicationDraft = CommunicationFields & {
  id: string; status: string; createdAt?: string; updatedAt?: string; publishedAt?: string | null;
};
export type CommunicationTemplate = Omit<CommunicationFields, "targetInstitutionId"> & {
  id: string; name: string; category: string; description?: string;
};
export type CommunicationPreview = {
  title: string; body: string; emailSubject: string; emailHtml: string;
  updatedAt?: string; expectedUpdatedAt?: string;
  recipientCount: number; emailRecipientCount: number; missingEmailCount: number; duplicateEmailCount: number;
  samples: Array<{ name: string; email: string | null; title: string; body: string; emailSubject: string; emailHtml?: string }>;
  warnings: string[]; unresolvedVariables: string[];
};
export const emptyCommunication = (): CommunicationFields => ({
  title: "", body: "", emailSubject: "", audienceType: "ALL_PARTICIPANTS", targetInstitutionId: null, sendEmailNotification: false,
});
export function communicationFields(source: Partial<CommunicationFields>): CommunicationFields {
  return { title: source.title || "", body: source.body || "", emailSubject: source.emailSubject || "",
    audienceType: source.audienceType || "ALL_PARTICIPANTS",
    targetInstitutionId: source.audienceType === "SPECIFIC_INSTITUTION" ? source.targetInstitutionId || null : null,
    sendEmailNotification: source.sendEmailNotification === true };
}
export function communicationFingerprint(fields: CommunicationFields): string {
  return JSON.stringify(communicationFields(fields));
}
export function validateCommunication(fields: CommunicationFields): string[] {
  const errors: string[] = [];
  if (fields.title.trim().length < 3) errors.push("Judul minimal 3 karakter.");
  if (fields.body.trim().length < 5) errors.push("Isi pesan minimal 5 karakter.");
  if (fields.sendEmailNotification && !fields.emailSubject.trim()) errors.push("Subjek email wajib diisi jika notifikasi email aktif.");
  if (!COMMUNICATION_AUDIENCES.some((item) => item.value === fields.audienceType)) errors.push("Segmen penerima tidak didukung. Pilih segmen yang tersedia.");
  if (fields.audienceType === "SPECIFIC_INSTITUTION" && !fields.targetInstitutionId) errors.push("Pilih lembaga penerima.");
  const allowed = new Set<string>(COMMUNICATION_VARIABLES.map((item) => item.key));
  const unknown = findCommunicationVariables(fields.title, fields.emailSubject, fields.body).filter((key) => !allowed.has(key));
  if (unknown.length) errors.push(`Variabel tidak didukung: ${unknown.join(", ")}.`);
  return errors;
}
export type PreviewSnapshot = { data: CommunicationPreview; draftId: string | null; fingerprint: string; revision: number };
export type CommunicationEditorState = {
  fields: CommunicationFields; baseline: string; draftId: string | null; status: string;
  savedUpdatedAt?: string;
  revision: number; preview: PreviewSnapshot | null; confirmed: boolean;
};
export function createCommunicationEditor(fields = emptyCommunication()): CommunicationEditorState {
  return { fields, baseline: communicationFingerprint(fields), draftId: null, status: "DRAFT", revision: 0, preview: null, confirmed: false };
}
export type CommunicationEditorAction =
  | { type: "change"; fields: Partial<CommunicationFields> }
  | { type: "open"; fields: CommunicationFields; draftId?: string; status?: string; updatedAt?: string }
  | { type: "saved"; draft: CommunicationDraft }
  | { type: "preview"; data: CommunicationPreview; saved: boolean; expectedRevision?: number }
  | { type: "confirm"; value: boolean }
  | { type: "invalidate" };
export function communicationEditorReducer(state: CommunicationEditorState, action: CommunicationEditorAction): CommunicationEditorState {
  switch (action.type) {
    case "change": return { ...state, fields: communicationFields({ ...state.fields, ...action.fields }), revision: state.revision + 1, preview: null, confirmed: false };
    case "open": return { ...createCommunicationEditor(action.fields), baseline: communicationFingerprint(action.draftId ? action.fields : emptyCommunication()), draftId: action.draftId || null, status: action.status || "DRAFT", savedUpdatedAt: action.updatedAt, revision: state.revision + 1 };
    case "saved": return { ...state, fields: communicationFields(action.draft), baseline: communicationFingerprint(action.draft), draftId: action.draft.id, status: action.draft.status, savedUpdatedAt: action.draft.updatedAt, preview: null, confirmed: false, revision: state.revision + 1 };
    case "preview": return action.expectedRevision !== undefined && action.expectedRevision !== state.revision ? state
      : { ...state, confirmed: false, preview: { data: action.data, draftId: action.saved ? state.draftId : null, fingerprint: communicationFingerprint(state.fields), revision: state.revision } };
    case "confirm": return { ...state, confirmed: action.value };
    case "invalidate": return { ...state, preview: null, confirmed: false, revision: state.revision + 1 };
  }
}
export function isCommunicationDirty(state: CommunicationEditorState): boolean {
  return communicationFingerprint(state.fields) !== state.baseline;
}
export function canPublishCommunication(state: CommunicationEditorState, localOnly = false): boolean {
  return !localOnly && state.confirmed && !!state.draftId && ["DRAFT", "UNPUBLISHED"].includes(state.status) && !isCommunicationDirty(state)
    && state.preview?.draftId === state.draftId && state.preview.revision === state.revision
    && state.preview.fingerprint === communicationFingerprint(state.fields)
    && !!(state.preview.data.expectedUpdatedAt || state.preview.data.updatedAt)
    && (!state.savedUpdatedAt || state.savedUpdatedAt === (state.preview.data.expectedUpdatedAt || state.preview.data.updatedAt))
    && state.preview.data.unresolvedVariables.length === 0 && state.preview.data.recipientCount > 0
    && validateCommunication(state.fields).length === 0;
}
export function filterCommunicationDrafts(drafts: CommunicationDraft[], query: string, status: string): CommunicationDraft[] {
  const term = query.trim().toLocaleLowerCase("id");
  return drafts.filter((draft) => (status === "ALL" || draft.status === status)
    && `${draft.title} ${draft.body} ${draft.emailSubject || ""}`.toLocaleLowerCase("id").includes(term));
}
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
export function localCommunicationPreview(fields: CommunicationFields): CommunicationPreview {
  const variables = { eventName: "Daurah Asatidz (contoh)", eventDates: "15–17 Agustus 2026", eventVenue: "Aula Utama (contoh)",
    portalLink: "https://example.org/portal", ustadzName: "Ustadz Ahmad (contoh)", participantCode: "CONTOH-001", institutionName: "Lembaga Contoh" };
  const title = renderCommunicationText(fields.title, variables);
  const body = renderCommunicationText(fields.body, variables);
  const emailSubject = renderCommunicationText(fields.emailSubject, variables);
  return { title, body, emailSubject, emailHtml: `<html lang="id"><body><h1>${escapeHtml(title)}</h1><div style="white-space:pre-wrap">${escapeHtml(body)}</div></body></html>`,
    recipientCount: 1, emailRecipientCount: 1, missingEmailCount: 0, duplicateEmailCount: 0,
    samples: [{ name: variables.ustadzName, email: "contoh@example.org", title, body, emailSubject, emailHtml: `<html lang="id"><body><h1>${escapeHtml(title)}</h1><div style="white-space:pre-wrap">${escapeHtml(body)}</div></body></html>` }],
    warnings: ["Data contoh lokal, bukan jumlah penerima sebenarnya. Tidak ada pesan dikirim atau data disimpan ke server."],
    unresolvedVariables: getUnresolvedCommunicationVariables([fields.title, fields.body, fields.emailSubject], variables) };
}
