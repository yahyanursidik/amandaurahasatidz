import type { SendEmailOptions, SendEmailResult } from "./smtpTransport";

const MAILKETING_SEND_URL = "https://api.mailketing.co.id/api/v2/send";

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
        from_name: process.env.MAILKETING_FROM_NAME || "Aman Daurah Asatidz",
        from_email: process.env.MAILKETING_FROM_EMAIL || "no-reply@yts.web.id",
        recipient: options.to,
        subject: options.subject,
        content: options.htmlBody,
      }),
    });
    const body = await response.json().catch(() => null) as { success?: boolean; message?: string; data?: { message_id?: string; id?: string } } | null;
    if (!response.ok || body?.success !== true) {
      return { success: false, retryable: response.status === 429 || response.status >= 500, error: `Mailketing menolak email (HTTP ${response.status}). Periksa kredensial, sender terverifikasi, kredit, dan antrean.` };
    }
    return { success: true, messageId: body?.data?.message_id || body?.data?.id };
  } catch (error) {
    return { success: false, retryable: true, error: error instanceof Error && error.name === "AbortError" ? "Mailketing tidak merespons dalam 12 detik." : "Koneksi ke Mailketing gagal." };
  } finally {
    clearTimeout(timeout);
  }
}
