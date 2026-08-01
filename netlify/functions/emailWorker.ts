import { Handler } from "@netlify/functions";
import { processEmailQueueWorker } from "./lib/services/emailQueueService";
import { logError } from "./lib/utils/logger";

export const handler: Handler = async () => {
  const requestId = `email_worker_${Date.now()}`;
  try {
    const result = await processEmailQueueWorker("netlify-email-worker", 20, requestId);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    logError(requestId, "Email queue worker failed", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Email worker failed" }) };
  }
};
