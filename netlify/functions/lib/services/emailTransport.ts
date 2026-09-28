import type { SendEmailOptions, SendEmailResult } from "./smtpTransport";
import { sendEmailViaSMTP } from "./smtpTransport";
import { sendEmailViaMailketing } from "./mailketingTransport";

export async function sendTransactionalEmail(options: SendEmailOptions): Promise<SendEmailResult & { provider: string }> {
  if (process.env.EMAIL_PROVIDER?.toUpperCase() === "SMTP") {
    return { ...await sendEmailViaSMTP(options), provider: "SMTP_CUSTOM" };
  }
  return { ...await sendEmailViaMailketing(options), provider: "MAILKETING" };
}
