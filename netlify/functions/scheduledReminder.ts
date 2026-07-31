import { Handler } from "@netlify/functions";
import { processScheduledReminderService } from "./lib/services/reminderService";
import { processEmailQueueWorker } from "./lib/services/emailQueueService";
import { logInfo, logError } from "./lib/utils/logger";

// Netlify Scheduled Function running via cron syntax in UTC (e.g. 0 1 * * * = 01:00 UTC / 08:00 WIB)
export const handler: Handler = async (_event, _context) => {
  const requestId = `sched_${Date.now()}`;
  logInfo(requestId, "Executing Netlify Scheduled Reminder Function in UTC...");

  try {
    const dummyEventId = "00000000-0000-0000-0000-000000000001";

    // Run reminders for target segments
    const res1 = await processScheduledReminderService("UNOPENED_LINK", dummyEventId, requestId);
    const res2 = await processScheduledReminderService("NO_RESPONSE", dummyEventId, requestId);

    // Process queued email jobs
    const workerRes = await processEmailQueueWorker("scheduled-worker", 20, requestId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "SUCCESS",
        timestamp: new Date().toISOString(),
        reminders: [res1, res2],
        workerRes,
      }),
    };
  } catch (error) {
    logError(requestId, "Error executing scheduled reminder function", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Scheduled execution failed" }),
    };
  }
};
