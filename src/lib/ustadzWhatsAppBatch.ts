import { buildWhatsAppUrl, normalizeWhatsAppNumber } from "@/lib/participantCommunication";

export const MAX_WHATSAPP_BATCH_RECIPIENTS = 100;
export const WHATSAPP_BATCH_STORAGE_PREFIX = "aman-daurah:ustadz-whatsapp:v1:";

export type WhatsAppBatchTemplate = "PROFILE_GREETING" | "CONTACT_CHECK" | "CUSTOM";
export type WhatsAppBatchRecipientStatus = "PENDING" | "OPENED" | "MARKED_SENT" | "SKIPPED";

export type WhatsAppBatch = {
  version: 1;
  id: string;
  ownerId: string;
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

export function whatsappBatchTemplateMessage(template: WhatsAppBatchTemplate): string {
  const opening = "Assalamu’alaikum warahmatullahi wabarakatuh, {{nama}}.\n\nPerkenalkan, saya {{pengirim}} dari Aman Daurah Asatidz.";
  const closing = "\n\nJazakumullahu khairan.\nWassalamu’alaikum warahmatullahi wabarakatuh.";
  if (template === "PROFILE_GREETING") return `${opening}\n\nSemoga antum senantiasa sehat. Kami ingin menjaga silaturahmi dan berbagi informasi daurah mendatang. Silakan kabari jika data kontak antum perlu diperbarui.${closing}`;
  if (template === "CONTACT_CHECK") return `${opening}\n\nKami sedang memperbarui data kontak asatidz. Mohon balas pesan ini untuk mengonfirmasi bahwa nomor WhatsApp antum masih aktif. Jika ada perubahan data, silakan sampaikan kepada kami.${closing}`;
  return `${opening}\n\n[Tulis isi pesan di sini]${closing}`;
}

export function validateWhatsAppBatchMessage(message: string): string | null {
  const clean = message.trim();
  if (clean.length < 30) return "Isi pesan minimal 30 karakter agar maksudnya jelas.";
  if (clean.length > 1500) return "Isi pesan maksimal 1.500 karakter agar tautan WhatsApp tetap dapat dibuka.";
  if (clean.includes("[Tulis isi pesan di sini]")) return "Ganti teks contoh dengan pesan yang akan dikirim.";
  const tokens = clean.match(/{{\s*[^{}]+\s*}}/g) || [];
  if (tokens.some((token) => !["{{nama}}", "{{pengirim}}"].includes(token))) return "Variabel yang tersedia hanya {{nama}} dan {{pengirim}}.";
  if (clean.includes("{{") || clean.includes("}}")) {
    const withoutKnown = clean.replaceAll("{{nama}}", "").replaceAll("{{pengirim}}", "");
    if (withoutKnown.includes("{{") || withoutKnown.includes("}}")) return "Periksa penulisan variabel pesan.";
  }
  return null;
}

export function renderWhatsAppBatchMessage(message: string, recipientName: string, senderName: string): string {
  return message.replaceAll("{{nama}}", recipientName.trim()).replaceAll("{{pengirim}}", senderName.trim());
}

export function whatsappBatchUrl(number: string | null | undefined, message: string): string | null {
  const normalized = normalizeWhatsAppNumber(number);
  return normalized ? buildWhatsAppUrl(normalized, message) : null;
}

export function createWhatsAppBatch(input: Omit<WhatsAppBatch, "version" | "statusById" | "createdAt" | "updatedAt">, now = new Date()): WhatsAppBatch {
  const recipientIds = [...new Set(input.recipientIds)];
  if (!input.ownerId || recipientIds.length === 0 || recipientIds.length > MAX_WHATSAPP_BATCH_RECIPIENTS || recipientIds.some((id) => !id)) throw new Error("Jumlah penerima tidak valid.");
  if (input.title.trim().length < 3 || input.title.trim().length > 100) throw new Error("Nama sesi perlu 3–100 karakter.");
  if (input.senderName.trim().length < 3 || input.senderName.trim().length > 80) throw new Error("Nama pengirim perlu 3–80 karakter.");
  if (!whatsappBatchTemplates.some((item) => item.id === input.template)) throw new Error("Template pesan tidak valid.");
  const messageError = validateWhatsAppBatchMessage(input.message);
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

export function readWhatsAppBatch(storage: Pick<Storage, "getItem">, ownerId: string): WhatsAppBatch | null {
  try {
    const raw = storage.getItem(`${WHATSAPP_BATCH_STORAGE_PREFIX}${ownerId}`);
    if (!raw) return null;
    const batch = JSON.parse(raw) as WhatsAppBatch;
    if (batch.version !== 1 || batch.ownerId !== ownerId || typeof batch.id !== "string" || !batch.id ||
      typeof batch.title !== "string" || batch.title.trim().length < 3 || batch.title.length > 100 ||
      !whatsappBatchTemplates.some((item) => item.id === batch.template) ||
      typeof batch.senderName !== "string" || batch.senderName.trim().length < 3 || batch.senderName.length > 80 ||
      !Array.isArray(batch.recipientIds) ||
      batch.recipientIds.length === 0 || batch.recipientIds.length > MAX_WHATSAPP_BATCH_RECIPIENTS ||
      new Set(batch.recipientIds).size !== batch.recipientIds.length || !batch.statusById ||
      batch.recipientIds.some((id) => typeof id !== "string" || !["PENDING", "OPENED", "MARKED_SENT", "SKIPPED"].includes(batch.statusById[id])) ||
      typeof batch.message !== "string" || validateWhatsAppBatchMessage(batch.message) ||
      typeof batch.createdAt !== "string" || typeof batch.updatedAt !== "string") return null;
    return batch;
  } catch { return null; }
}
