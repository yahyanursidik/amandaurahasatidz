import type { SendEmailOptions, SendEmailResult } from "./smtpTransport";

const MAILKETING_API_URL = "https://api.mailketing.co.id/api/v2";
const MAILKETING_SEND_URL = `${MAILKETING_API_URL}/send`;

export type MailketingConnectionCheck = {
  checkedAt: string;
  senderEmail: string;
  authenticated: boolean;
  senderListed: boolean;
  credits: number | null;
  readyToSend: boolean;
  issue: "TOKEN_MISSING" | "SENDER_MISSING" | "TOKEN_INVALID" | "SENDER_NOT_LISTED" | "NO_CREDITS" | "PROVIDER_ERROR" | "UNREACHABLE" | null;
};

/** Read-only verification: never sends a message or exposes the API token. */
export async function checkMailketingConnection(): Promise<MailketingConnectionCheck> {
  const token = process.env.MAILKETING_API_TOKEN?.trim();
  const senderEmail = process.env.MAILKETING_FROM_EMAIL?.trim().toLowerCase() || "";
  const base = { checkedAt: new Date().toISOString(), senderEmail, authenticated: false,
    senderListed: false, credits: null, readyToSend: false };
  if (!token) return { ...base, issue: "TOKEN_MISSING" };
  if (!senderEmail) return { ...base, issue: "SENDER_MISSING" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  try {
    const creditsResponse = await fetch(`${MAILKETING_API_URL}/credits`, {
      headers, signal: controller.signal, cache: "no-store",
    });
    const creditsBody = await creditsResponse.json().catch(() => null) as {
      success?: boolean; data?: { credits?: number };
    } | null;
    if (creditsResponse.status === 401) return { ...base, issue: "TOKEN_INVALID" };
    if (!creditsResponse.ok || creditsBody?.success !== true || !Number.isFinite(creditsBody.data?.credits)) {
      return { ...base, issue: "PROVIDER_ERROR" };
    }
    const credits = Number(creditsBody.data?.credits);
    const authenticated = { ...base, authenticated: true, credits };
    const sendersResponse = await fetch(`${MAILKETING_API_URL}/senders`, {
      headers, signal: controller.signal, cache: "no-store",
    });
    const sendersBody = await sendersResponse.json().catch(() => null) as {
      success?: boolean; data?: { senders?: Array<{ email?: string }> };
    } | null;
    if (!sendersResponse.ok || sendersBody?.success !== true || !Array.isArray(sendersBody.data?.senders)) {
      return { ...authenticated, issue: "PROVIDER_ERROR" };
    }
    const senderListed = sendersBody.data.senders.some((sender) => sender.email?.trim().toLowerCase() === senderEmail);
    return { ...authenticated, senderListed, readyToSend: senderListed && credits > 0,
      issue: !senderListed ? "SENDER_NOT_LISTED" : credits <= 0 ? "NO_CREDITS" : null };
  } catch {
    return { ...base, issue: "UNREACHABLE" };
  } finally {
    clearTimeout(timeout);
  }
}

function mailketingSendError(status: number): string {
  if (status === 401) return "Token Mailketing tidak valid. Perbarui MAILKETING_API_TOKEN di lingkungan server.";
  if (status === 402) return "Kredit Mailketing habis. Isi ulang sebelum mengirim email.";
  if (status === 403) return "Domain email pengirim belum diverifikasi di Mailketing.";
  if (status === 422) return "Data email ditolak Mailketing. Periksa alamat penerima dan isi pesan.";
  if (status === 429) return "Mailketing membatasi permintaan sementara. Coba lagi nanti.";
  return `Mailketing menolak email (HTTP ${status}). Periksa status penyedia dan coba lagi.`;
}

export async function sendEmailViaMailketing(options: SendEmailOptions): Promise<SendEmailResult> {
  const token = process.env.MAILKETING_API_TOKEN?.trim();
  if (!token) return { success: false, error: "MAILKETING_API_TOKEN belum dikonfigurasi." };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(MAILKETING_SEND_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        from_name: process.env.MAILKETING_FROM_NAME || "Daurah Duat dan Pegiat Dakwah",
        from_email: process.env.MAILKETING_FROM_EMAIL || "no-reply@yts.web.id",
        recipient: options.to,
        subject: options.subject,
        content: options.htmlBody,
      }),
    });
    const body = await response.json().catch(() => null) as { success?: boolean; message?: string; data?: { message_id?: string; id?: string } } | null;
    if (!response.ok || body?.success !== true) {
      return { success: false, retryable: response.status === 429 || response.status >= 500,
        error: response.ok ? "Mailketing belum menerima email. Periksa konfigurasi pengirim dan format pesan." : mailketingSendError(response.status) };
    }
    return { success: true, messageId: body?.data?.message_id || body?.data?.id };
  } catch (error) {
    return { success: false, retryable: true, error: error instanceof Error && error.name === "AbortError" ? "Mailketing tidak merespons dalam 12 detik." : "Koneksi ke Mailketing gagal." };
  } finally {
    clearTimeout(timeout);
  }
}
