import { Handler } from "@netlify/functions";
import { logError } from "./lib/utils/logger";

function isEmailWorkerEnabled() {
  return process.env.EMAIL_WORKER_ENABLED === "true";
}

export const handler: Handler = async () => {
  const requestId = `email_worker_${Date.now()}`;

  if (!isEmailWorkerEnabled()) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "SKIPPED",
        reason: "EMAIL_WORKER_ENABLED is not true.",
        processedCount: 0,
      }),
    };
  }

  try {
    const { processEmailQueueWorker } = await import("./lib/services/emailQueueService");
    const result = await processEmailQueueWorker("netlify-email-worker", 20, requestId);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    logError(requestId, "Email queue worker failed", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Email worker failed" }) };
  }
};
