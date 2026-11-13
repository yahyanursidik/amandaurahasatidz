import type { SendEmailOptions, SendEmailResult } from "./smtpTransport";
import { sendEmailViaSMTP } from "./smtpTransport";
import { sendEmailViaMailketing } from "./mailketingTransport";
import { renderHtmlEmailTemplate } from "./emailTemplateEngine";
import { getTransactionalEmailSettings } from "./transactionalEmailSettingsService";

export async function sendTransactionalEmail(options: SendEmailOptions): Promise<SendEmailResult & { provider: string }> {
  if (process.env.EMAIL_PROVIDER?.toUpperCase() === "SMTP") {
    return { ...await sendEmailViaSMTP(options), provider: "SMTP_CUSTOM" };
  }
  return { ...await sendEmailViaMailketing(options), provider: "MAILKETING" };
}

/** Request-bound delivery for short-lived secrets; never persist the rendered code or link. */
export async function sendImmediateTransactionalTemplate(input: {
  templateCode: string;
  recipientEmail: string;
  recipientName?: string | null;
  variables: Record<string, unknown>;
  requestId: string;
}) {
  const copy = input.templateCode === "OTP_CODE" ? undefined : (await getTransactionalEmailSettings()).settings;
  const rendered = renderHtmlEmailTemplate(input.templateCode, input.variables, copy);
  return sendTransactionalEmail({ to: input.recipientEmail, toName: input.recipientName,
    subject: rendered.subject, htmlBody: rendered.htmlBody, textBody: rendered.textBody, requestId: input.requestId });
}
