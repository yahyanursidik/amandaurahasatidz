import { buildWhatsAppUrl, normalizeWhatsAppNumber } from "./participantCommunication";

export const MAX_WHATSAPP_BATCH_RECIPIENTS = 100;
export const WHATSAPP_BATCH_STORAGE_PREFIX = "aman-daurah:ustadz-whatsapp:v1:";

export type WhatsAppBatchTemplate = "PROFILE_GREETING" | "CONTACT_CHECK" | "CUSTOM"
  | "EVENT_REMINDER" | "EVENT_CONFIRMATION" | "EVENT_SCHEDULE_CHANGE" | "EVENT_FOLLOWUP";
export type WhatsAppBatchRecipientStatus = "PENDING" | "OPENED" | "MARKED_SENT" | "SKIPPED";

export type WhatsAppBatch = {
  version: 1;
  id: string;
  ownerId: string;
  eventId?: string;
  title: string;
  template: WhatsAppBatchTemplate;
  message: string;
  senderName: string;
  recipientIds: string[];
  statusById: Record<string, WhatsAppBatchRecipientStatus>;
  createdAt: string;
  updatedAt: string;
};

export const whatsappBatchTemplates: Array<{ id: WhatsAppBatchTemplate; label: string; description: string }> = [
  { id: "PROFILE_GREETING", label: "Sapaan asatidz", description: "Silaturahmi dan pembaruan informasi daurah." },
  { id: "CONTACT_CHECK", label: "Konfirmasi kontak", description: "Memastikan nomor WhatsApp penerima masih aktif." },
  { id: "CUSTOM", label: "Pesan khusus", description: "Salam dan perkenalan siap disunting." },
];

export const eventWhatsAppBatchTemplates: typeof whatsappBatchTemplates = [
  { id: "EVENT_REMINDER", label: "Pengingat daurah", description: "Informasi jadwal dan lokasi; tidak mengubah status peserta." },
  { id: "EVENT_CONFIRMATION", label: "Minta konfirmasi hadir", description: "Untuk peserta disetujui yang belum konfirmasi, dengan tautan pribadi." },
  { id: "EVENT_SCHEDULE_CHANGE", label: "Pembaruan jadwal", description: "Arahkan peserta ke rundown terbaru." },
  { id: "EVENT_FOLLOWUP", label: "Tindak lanjut", description: "Hubungi peserta setelah acara tanpa menganggap semua hadir." },
  ...whatsappBatchTemplates.filter(({ id }) => id !== "PROFILE_GREETING"),
];

export function whatsappBatchTemplateMessage(template: WhatsAppBatchTemplate, event = false): string {
  const opening = "Assalamu’alaikum warahmatullahi wabarakatuh, {{nama}}.\n\nPerkenalkan, saya {{pengirim}} " +
    (event ? "dari panitia {{event}}." : "dari Daurah Duat dan Pegiat Dakwah.");
  const closing = "\n\nJazakumullahu khairan.\nWassalamu’alaikum warahmatullahi wabarakatuh.";
  if (template === "EVENT_REMINDER") return `${opening}\n\nKami mengingatkan jadwal daurah: {{tanggal}}. Lokasi: {{lokasi}}. Silakan lihat rundown dan pantau status pendaftaran di Portal Asatidz.\n{{rundown}}${closing}`;
  if (template === "EVENT_CONFIRMATION") return `${opening}\n\nPendaftaran antum telah disetujui. Mohon buka tautan pribadi ini untuk memilih hadir atau berhalangan; tidak perlu login. QR presensi akan tersedia setelah syarat kehadiran terpenuhi.\n{{tautan_status}}\n\nJangan teruskan tautan pribadi ini kepada orang lain.${closing}`;
  if (template === "EVENT_SCHEDULE_CHANGE") return `${opening}\n\nAda pembaruan informasi kegiatan. Mohon periksa rundown terbaru pada tautan ini:\n{{rundown}}${closing}`;
  if (template === "EVENT_FOLLOWUP") return `${opening}\n\nTerima kasih telah mendaftar pada kegiatan kami. Jika antum memiliki masukan atau pertanyaan tentang materi dan tindak lanjut, silakan balas pesan ini.${closing}`;
  if (template === "PROFILE_GREETING") return `${opening}\n\nSemoga antum senantiasa sehat. Kami ingin menjaga silaturahmi dan berbagi informasi daurah mendatang. Silakan kabari jika data kontak antum perlu diperbarui.${closing}`;
  if (template === "CONTACT_CHECK") return `${opening}\n\nKami sedang memperbarui data kontak asatidz. Mohon balas pesan ini untuk mengonfirmasi bahwa nomor WhatsApp antum masih aktif. Jika ada perubahan data, silakan sampaikan kepada kami.${closing}`;
  return `${opening}\n\n[Tulis isi pesan di sini]${closing}`;
}

type MessageScope = { eventId?: string; template?: WhatsAppBatchTemplate };
export function validateWhatsAppBatchMessage(message: string, scope: MessageScope = {}): string | null {
  const clean = message.trim();
  if (clean.length < 30) return "Isi pesan minimal 30 karakter agar maksudnya jelas.";
  if (clean.length > 1500) return "Isi pesan maksimal 1.500 karakter agar tautan WhatsApp tetap dapat dibuka.";
  if (clean.includes("[Tulis isi pesan di sini]")) return "Ganti teks contoh dengan pesan yang akan dikirim.";
  const allowed = ["{{nama}}", "{{pengirim}}", ...(scope.eventId ? ["{{event}}", "{{kode}}", "{{tanggal}}", "{{lokasi}}", "{{rundown}}"] : []),
    ...(scope.eventId && scope.template === "EVENT_CONFIRMATION" ? ["{{tautan_status}}"] : [])];
  const tokens: string[] = clean.match(/{{\s*[^{}]+\s*}}/g) || [];
  if (tokens.some((token) => !allowed.includes(token))) return "Variabel pesan tidak tersedia untuk template ini. Gunakan variabel pada petunjuk.";
  if (clean.includes("{{") || clean.includes("}}")) {
    const withoutKnown = allowed.reduce((text, token) => text.replaceAll(token, ""), clean);
    if (withoutKnown.includes("{{") || withoutKnown.includes("}}")) return "Periksa penulisan variabel pesan.";
  }
  if (scope.eventId) {
    if (/(?:pcf_|pqr_|inv_(?:inst|ind|self)_|\/confirm[#?]|\/card\?token=)/i.test(clean)) {
      return "Jangan tempel tautan pribadi ke pesan massal. Gunakan template konfirmasi untuk tautan per peserta.";
    }
    if (scope.template === "EVENT_CONFIRMATION" && !tokens.includes("{{tautan_status}}")) return "Sertakan {{tautan_status}} agar setiap peserta mendapat tautan konfirmasi pribadi.";
  }
  return null;
}

export function renderWhatsAppBatchMessage(message: string, recipientName: string, senderName: string, fields: Record<string, string> = {}): string {
  const values: Record<string, string> = { ...fields, nama: recipientName.trim(), pengirim: senderName.trim() };
  return message.replace(/{{([a-z_]+)}}/g, (token, key: string) => Object.hasOwn(values, key) ? values[key] : token);
}

export function whatsappBatchUrl(number: string | null | undefined, message: string): string | null {
  const normalized = normalizeWhatsAppNumber(number);
  return normalized ? buildWhatsAppUrl(normalized, message.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD")) : null;
}

export function createWhatsAppBatch(input: Omit<WhatsAppBatch, "version" | "statusById" | "createdAt" | "updatedAt">, now = new Date()): WhatsAppBatch {
  const recipientIds = [...new Set(input.recipientIds)];
  if (!input.ownerId || recipientIds.length === 0 || recipientIds.length > MAX_WHATSAPP_BATCH_RECIPIENTS || recipientIds.some((id) => !id)) throw new Error("Jumlah penerima tidak valid.");
  if (input.title.trim().length < 3 || input.title.trim().length > 100) throw new Error("Nama sesi perlu 3–100 karakter.");
  if (input.senderName.trim().length < 3 || input.senderName.trim().length > 80) throw new Error("Nama pengirim perlu 3–80 karakter.");
  if (!(input.eventId ? eventWhatsAppBatchTemplates : whatsappBatchTemplates).some((item) => item.id === input.template)) throw new Error("Template pesan tidak valid.");
  const messageError = validateWhatsAppBatchMessage(input.message, input);
  if (messageError) throw new Error(messageError);
  return {
    ...input, version: 1, recipientIds,
    statusById: Object.fromEntries(recipientIds.map((id) => [id, "PENDING" as const])),
    createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
}

export function updateWhatsAppBatchStatus(batch: WhatsAppBatch, recipientId: string, status: WhatsAppBatchRecipientStatus, now = new Date()): WhatsAppBatch {
  if (!batch.recipientIds.includes(recipientId)) throw new Error("Penerima tidak ada dalam sesi ini.");
  const current = batch.statusById[recipientId];
  if (status === "MARKED_SENT" && current !== "OPENED") throw new Error("Buka WhatsApp dahulu, lalu tandai setelah pesan dikirim.");
  if (status === "OPENED" && current !== "PENDING" && current !== "OPENED") throw new Error("Penerima ini sudah ditangani.");
  if (status === "SKIPPED" && current !== "PENDING" && current !== "OPENED") throw new Error("Penerima ini sudah ditangani.");
  if (status === "PENDING" && current !== "MARKED_SENT" && current !== "SKIPPED") throw new Error("Status penerima belum perlu dikembalikan.");
  return { ...batch, statusById: { ...batch.statusById, [recipientId]: status }, updatedAt: now.toISOString() };
}

export function whatsappBatchProgress(batch: WhatsAppBatch) {
  const values = batch.recipientIds.map((id) => batch.statusById[id]);
  return {
    total: values.length,
    markedSent: values.filter((status) => status === "MARKED_SENT").length,
    skipped: values.filter((status) => status === "SKIPPED").length,
    remaining: values.filter((status) => status === "PENDING" || status === "OPENED").length,
    nextId: batch.recipientIds.find((id) => ["PENDING", "OPENED"].includes(batch.statusById[id])) || null,
  };
}

export const whatsappBatchStorageKey = (ownerId: string, eventId?: string) => eventId
  ? `daurah:event-participant-whatsapp:v1:${encodeURIComponent(ownerId)}:${encodeURIComponent(eventId)}`
  : `${WHATSAPP_BATCH_STORAGE_PREFIX}${ownerId}`;

export function readWhatsAppBatch(storage: Pick<Storage, "getItem">, ownerId: string, eventId?: string): WhatsAppBatch | null {
  try {
    const raw = storage.getItem(whatsappBatchStorageKey(ownerId, eventId));
    if (!raw) return null;
    const batch = JSON.parse(raw) as WhatsAppBatch;
    if (batch.version !== 1 || batch.ownerId !== ownerId || batch.eventId !== eventId || typeof batch.id !== "string" || !batch.id ||
      typeof batch.title !== "string" || batch.title.trim().length < 3 || batch.title.length > 100 ||
      !(eventId ? eventWhatsAppBatchTemplates : whatsappBatchTemplates).some((item) => item.id === batch.template) ||
      typeof batch.senderName !== "string" || batch.senderName.trim().length < 3 || batch.senderName.length > 80 ||
      !Array.isArray(batch.recipientIds) ||
      batch.recipientIds.length === 0 || batch.recipientIds.length > MAX_WHATSAPP_BATCH_RECIPIENTS ||
      new Set(batch.recipientIds).size !== batch.recipientIds.length || !batch.statusById ||
      batch.recipientIds.some((id) => typeof id !== "string" || !["PENDING", "OPENED", "MARKED_SENT", "SKIPPED"].includes(batch.statusById[id])) ||
      typeof batch.message !== "string" || validateWhatsAppBatchMessage(batch.message, batch) ||
      typeof batch.createdAt !== "string" || typeof batch.updatedAt !== "string") return null;
    return batch;
  } catch { return null; }
}
