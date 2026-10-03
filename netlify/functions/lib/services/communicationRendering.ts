import { COMMUNICATION_VARIABLES, renderCommunicationText, getUnresolvedCommunicationVariables } from "../../../../src/lib/communicationTemplates";
import { renderBrandedTextEmailHtml } from "./emailHtmlTemplates";

export interface CommunicationContent {
  title: string;
  body: string;
  emailSubject?: string | null;
  contentFormat?: string;
  sendEmailNotification?: boolean;
}

export interface CommunicationRecipient {
  participantId: string | null;
  institutionId: string | null;
  userId: string | null;
  email: string | null;
  name: string;
  participantCode: string | null;
  institutionName: string | null;
}

export interface CommunicationEvent {
  name: string;
  startDate: string;
  endDate: string;
  venueName: string | null;
  venueAddress: string | null;
}

export function legacyCommunicationText(body: string) {
  return body.replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?\s*>|<\/p\s*>|<\/div\s*>/gi, "\n").replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}

export function normalizeCommunicationEmail(email: string | null) {
  const value = email?.trim().toLowerCase();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

export function communicationVariables(event: CommunicationEvent, recipient?: CommunicationRecipient) {
  let portalLink = "";
  try {
    const origin = new URL(process.env.APP_URL || process.env.URL || "");
    if (origin.protocol === "https:" || (origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) {
      portalLink = new URL("/portal/announcements", origin).toString();
    }
  } catch { /* Unconfigured URL is an unresolved variable, not a relative email link. */ }
  return {
    eventName: event.name,
    eventDates: event.startDate === event.endDate ? event.startDate : `${event.startDate} – ${event.endDate}`,
    eventVenue: [event.venueName, event.venueAddress].filter(Boolean).join(", "),
    portalLink,
    ustadzName: recipient?.name || "",
    participantCode: recipient?.participantCode || "",
    institutionName: recipient?.institutionName || "",
  };
}

export function renderFinalCommunication(content: CommunicationContent, variables: Record<string, string>) {
  const bodyText = content.contentFormat === "LEGACY_HTML" ? legacyCommunicationText(content.body) : content.body;
  const title = renderCommunicationText(content.title, variables);
  const body = renderCommunicationText(bodyText, variables);
  const emailSubject = renderCommunicationText(content.emailSubject?.trim() || content.title, variables).replace(/[\r\n]+/g, " ");
  // Static layout title; all user and variable content is escaped by the branded renderer.
  const emailHtml = renderBrandedTextEmailHtml(`${title}\n\n${body}`);
  return { title, body, emailSubject, emailHtml };
}

export function buildCommunicationPreview(content: CommunicationContent, event: CommunicationEvent, recipients: CommunicationRecipient[]) {
  const texts = [content.title, content.contentFormat === "LEGACY_HTML" ? legacyCommunicationText(content.body) : content.body, content.emailSubject?.trim() || content.title];
  const unresolvedVariables = new Set<string>();
  const allowed = new Set<string>(COMMUNICATION_VARIABLES.map((item) => item.key));
  const rendered: Array<ReturnType<typeof renderFinalCommunication> & { recipient?: CommunicationRecipient }> = [];
  for (const [index, recipient] of (recipients.length ? recipients : [undefined]).entries()) {
    const variables = communicationVariables(event, recipient);
    const unresolved = getUnresolvedCommunicationVariables(texts, variables);
    unresolved.forEach((key) => unresolvedVariables.add(key));
    // Also detect unknown/malformed tokens, independently of shared rendering behavior.
    for (const text of texts) {
      for (const match of text.matchAll(/{{([^{}]*)}}/g)) {
        const key = match[1].trim();
        if (!allowed.has(key)) unresolvedVariables.add(key || "(empty)");
      }
      if (/{{|}}/.test(text.replace(/{{[^{}]*}}/g, ""))) unresolvedVariables.add("(malformed)");
    }
    if (index < 5) rendered.push({ recipient, ...renderFinalCommunication(content, variables) });
  }
  const emails = new Set<string>();
  let missingEmailCount = 0;
  let duplicateEmailCount = 0;
  for (const recipient of recipients) {
    const email = normalizeCommunicationEmail(recipient.email);
    if (!email) missingEmailCount++;
    else if (emails.has(email)) duplicateEmailCount++;
    else emails.add(email);
  }
  const warnings: string[] = [];
  if (!recipients.length) warnings.push("Tidak ada penerima dalam audiens ini.");
  if (missingEmailCount) warnings.push(`${missingEmailCount} penerima tidak memiliki alamat email yang valid; pesan portal tetap tersedia.`);
  if (duplicateEmailCount) warnings.push(`${duplicateEmailCount} alamat email duplikat; hanya satu email per alamat akan diantrekan.`);
  if (!content.sendEmailNotification) warnings.push("Notifikasi email dinonaktifkan; hanya pesan portal yang dipublikasikan.");
  if (unresolvedVariables.size) warnings.push("Variabel belum terselesaikan. Perbaiki sebelum publikasi.");
  const first = rendered[0];
  return {
    title: first.title, body: first.body, emailSubject: first.emailSubject, emailHtml: first.emailHtml,
    recipientCount: recipients.length,
    emailRecipientCount: emails.size,
    missingEmailCount, duplicateEmailCount,
    samples: rendered.filter((item) => item.recipient).slice(0, 5).map((item) => ({
      name: item.recipient!.name, email: normalizeCommunicationEmail(item.recipient!.email),
      title: item.title, body: item.body, emailSubject: item.emailSubject,
      emailHtml: item.emailHtml,
    })),
    warnings, unresolvedVariables: [...unresolvedVariables].sort(),
  };
}