import { Handler } from "@netlify/functions";
import { processScheduledReminderService } from "./lib/services/reminderService";
import { getDbClient } from "./lib/db/client";
import { events } from "./lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { logInfo, logError } from "./lib/utils/logger";

// Netlify Scheduled Function running via cron syntax in UTC (e.g. 0 1 * * * = 01:00 UTC / 08:00 WIB)
export const handler: Handler = async (_event, _context) => {
  const requestId = `sched_${Date.now()}`;
  logInfo(requestId, "Executing Netlify Scheduled Reminder Function in UTC...");

  try {
    if (process.env.ENABLE_AUTOMATED_REMINDERS !== "true") {
      return { statusCode: 200, body: JSON.stringify({ status: "DISABLED", reminders: [] }) };
    }
    const reminders = [];
    const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 86_400_000));
    const dueEvents = await getDbClient().select({ id: events.id }).from(events)
      .where(and(eq(events.startDate, tomorrow), inArray(events.status, ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"])));
    for (const event of dueEvents) reminders.push(await processScheduledReminderService("APPROVED_PARTICIPANTS", event.id, requestId));

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "SUCCESS",
        timestamp: new Date().toISOString(),
        reminders,
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
