import { parseMediaUrl, parseRecordingSource, type RecordingEvent, type RecordingSource } from "./eventRecording";

export const MATERIAL_KINDS = ["VIDEO", "PDF"] as const;
export const MATERIAL_SOURCE_LIMIT = 5;
export const MATERIALS_PORTAL_PATH = "/portal/materials";
export const PDF_PREVIEW_CHUNK_BYTES = 512 * 1024;
export const PDF_PREVIEW_MAX_BYTES = 64 * 1024 * 1024;
export type MaterialKind = typeof MATERIAL_KINDS[number];
export type MaterialSource = Omit<RecordingSource, "provider"> & { provider: RecordingSource["provider"] | "S3" };
export type MaterialSession = { id: string; title: string; date: string };
export type EventMaterial = {
  id: string;
  title: string;
  kind: MaterialKind;
  session: MaterialSession | null;
  sources: MaterialSource[];
};
export type AdminMaterial = EventMaterial & { published: boolean };
export type PortalMaterial = EventMaterial & { completedAt: string | null };
export type PortalMaterialGroup = RecordingEvent & { materials: PortalMaterial[] };
export type AdminMaterialLibrary = {
  event: RecordingEvent;
  materials: AdminMaterial[];
  sessions: MaterialSession[];
  storageHosts: string[];
};

export const materialKindLabel: Record<MaterialKind, string> = { VIDEO: "Video", PDF: "PDF" };

const awsS3Host = /^(?:[a-z0-9](?:[a-z0-9.-]{1,61}[a-z0-9])?\.)?s3(?:[.-](?:dualstack\.)?[a-z]{2}(?:-[a-z0-9]+)+-\d+)?\.amazonaws\.com(?:\.cn)?$/;
const configuredHost = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]$/;
const uuid = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
const materialScopeQuery = new RegExp(`^\\?event=(${uuid})(?:&session=(${uuid}))?$`, "i");

export function materialPortalPath(eventId: string, sessionId?: string) {
  const params = new URLSearchParams({ event: eventId });
  if (sessionId) params.set("session", sessionId);
  return `${MATERIALS_PORTAL_PATH}?${params}`;
}

export function parseMaterialPortalPath(value: string) {
  if (!value.startsWith(MATERIALS_PORTAL_PATH)) return null;
  const match = materialScopeQuery.exec(value.slice(MATERIALS_PORTAL_PATH.length));
  return match ? materialPortalPath(match[1].toLowerCase(), match[2]?.toLowerCase()) : null;
}

export function materialStorageHosts(value = "") {
  return [...new Set(value.toLowerCase().split(",").map((host) => host.trim()).filter((host) => configuredHost.test(host)))];
}

function hasTemporarySignature(url: URL) {
  return [...url.searchParams.keys()].some((key) => /^(?:x-amz-|x-goog-|awsaccesskeyid$|signature$|expires$|policy$|key-pair-id$)/i.test(key));
}

export function materialSourceError(kind: MaterialKind, value: string) {
  const url = parseMediaUrl(value);
  if (kind === "PDF" && url && hasTemporarySignature(url)) {
    return "Gunakan tautan tetap. Tautan bertanda tangan akan kedaluwarsa.";
  }
  return kind === "PDF" ? "Gunakan tautan file Google Drive atau URL .pdf dari S3."
    : "Gunakan tautan video YouTube atau Google Drive.";
}

export function parseMaterialSource(kind: MaterialKind, value: string, storageHosts: readonly string[] = []): MaterialSource | null {
  const recording = parseRecordingSource(value);
  if (kind === "VIDEO") return recording;
  if (recording?.provider === "Google Drive") return recording;

  const url = parseMediaUrl(value);
  if (!url || !/\.pdf$/i.test(url.pathname) || hasTemporarySignature(url)) return null;
  if (!awsS3Host.test(url.hostname) && !storageHosts.includes(url.hostname)) return null;

  url.hash = "";
  const version = url.searchParams.get("versionId");
  url.search = version ? new URLSearchParams({ versionId: version }).toString() : "";
  return { provider: "S3", url: url.href, previewUrl: url.href };
}

export function matchesMaterialSearch(item: EventMaterial, query: string, eventName = "") {
  const terms = query.toLocaleLowerCase("id-ID").trim().split(/\s+/);
  const content = [item.title, item.session?.title, eventName, ...item.sources.map((source) => source.provider)]
    .join(" ").toLocaleLowerCase("id-ID");
  return terms.every((term) => content.includes(term));
}

export function parsePdfContentRange(value: string | null) {
  const match = value?.match(/^bytes (\d{1,10})-(\d{1,10})\/(\d{1,10})$/);
  if (!match) return null;
  const [, start, end, size] = match.map(Number);
  return start <= end && end < size ? { start, end, size } : null;
}
