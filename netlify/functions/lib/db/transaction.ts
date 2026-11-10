import type { getDbClient } from "./client";
import { createTransactionClient } from "./transactionClient";

export async function withTransaction<T>(
  callback: (tx: ReturnType<typeof getDbClient>) => Promise<T>
): Promise<T> {
  const { db, close } = createTransactionClient();
  try {
    return await db.transaction(async (tx) => {
      return await callback(tx as unknown as ReturnType<typeof getDbClient>);
    });
  } finally {
    // Cleanup failure after COMMIT must not turn a successful mutation into an
    // error that invites the caller to repeat it. Never replay the callback.
    await close().catch(() => {});
  }
}
