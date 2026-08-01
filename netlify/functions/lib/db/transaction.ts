import { getDbClient } from "./client";

export async function withTransaction<T>(
  callback: (tx: ReturnType<typeof getDbClient>) => Promise<T>
): Promise<T> {
  const db = getDbClient();
  try {
    return await db.transaction(async (tx) => {
      return await callback(tx as unknown as ReturnType<typeof getDbClient>);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const transactionUnsupported =
      message.includes("transaction") &&
      (message.includes("not supported")
        || message.includes("does not support")
        || message.includes("no transaction")
        || message.includes("support in neon-http"));
    if (!transactionUnsupported) throw error;
    // Neon HTTP deployments that cannot run interactive transactions still execute once.
    return callback(db);
  }
}
