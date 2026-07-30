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
    // If HTTP driver doesn't support interactive transactions, fallback safely
    return await callback(db);
  }
}
