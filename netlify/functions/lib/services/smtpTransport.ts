/**
 * smtpTransport.ts
 * Singleton SMTP transport layer menggunakan nodemailer.
 * Server: mail.radiotarbiyahsunnah.com | Port: 465 | SSL
 * From: no-reply@radiotarbiyahsunnah.com
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { logInfo, logError } from "../utils/logger";

// ─── Config ──────────────────────────────────────────────────────────────────

function getSmtpConfig() {
  const host = process.env.EMAIL_HOST || "mail.radiotarbiyahsunnah.com";
  const port = parseInt(process.env.EMAIL_PORT || "465", 10);
  const secure = process.env.EMAIL_SECURE !== "false"; // default true (SSL)
  const user = process.env.EMAIL_USER || "no-reply@radiotarbiyahsunnah.com";
  const pass = process.env.EMAIL_PASS || "";
  const fromName = process.env.EMAIL_FROM_NAME || "Panitia Daurah YTS";

  return { host, port, secure, user, pass, fromName };
}

// ─── Singleton Transporter ───────────────────────────────────────────────────

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const cfg = getSmtpConfig();

  _transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure, // true = SSL/TLS (port 465)
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    tls: {
      // Tidak strict reject jika self-signed cert (aman untuk shared hosting)
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000, // 10 detik timeout koneksi
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });

  return _transporter;
}

// ─── Reset for testing ───────────────────────────────────────────────────────

export function resetSmtpTransporter() {
  _transporter = null;
}

// ─── Main Send Function ──────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string;
  toName?: string | null;
  subject: string;
  htmlBody: string;
  textBody?: string;
  requestId?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmailViaSMTP(options: SendEmailOptions): Promise<SendEmailResult> {
  const cfg = getSmtpConfig();
  const reqId = options.requestId || "smtp-send";

  // Guard: Jangan kirim jika password belum dikonfigurasi
  if (!cfg.pass || cfg.pass === "GANTI_DENGAN_PASSWORD_EMAIL") {
    const msg = "SMTP password belum dikonfigurasi. Set variabel EMAIL_PASS di .env";
    logError(reqId, msg, new Error(msg));
    return { success: false, error: msg };
  }

  const from = `"${cfg.fromName}" <${cfg.user}>`;
  const toAddress = options.toName
    ? `"${options.toName}" <${options.to}>`
    : options.to;

  try {
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from,
      to: toAddress,
      subject: options.subject,
      text: options.textBody || stripHtmlTags(options.htmlBody),
      html: options.htmlBody,
    });

    logInfo(reqId, `Email terkirim ke ${options.to} | MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };

  } catch (err: any) {
    logError(reqId, `Gagal mengirim email ke ${options.to}`, err);
    return { success: false, error: err.message || "SMTP send failed" };
  }
}

// ─── Verify Connection (untuk health check) ──────────────────────────────────

export async function verifySmtpConnection(requestId = "smtp-verify"): Promise<boolean> {
  const cfg = getSmtpConfig();
  if (!cfg.pass || cfg.pass === "GANTI_DENGAN_PASSWORD_EMAIL") {
    logError(requestId, "SMTP password belum dikonfigurasi", new Error("No password"));
    return false;
  }

  try {
    const transporter = getTransporter();
    await transporter.verify();
    logInfo(requestId, `SMTP connection verified: ${cfg.host}:${cfg.port}`);
    return true;
  } catch (err: any) {
    logError(requestId, `SMTP connection failed: ${cfg.host}:${cfg.port}`, err);
    return false;
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}
