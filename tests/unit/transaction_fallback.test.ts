import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.fn();

vi.mock("../../netlify/functions/lib/db/client", () => ({
  getDbClient: () => ({ transaction }),
}));

describe("database transaction fallback", () => {
  beforeEach(() => transaction.mockReset());

  it("falls back for the Neon HTTP no-transaction message", async () => {
    transaction.mockRejectedValueOnce(new Error("No transactions support in neon-http driver"));
    const { withTransaction } = await import("../../netlify/functions/lib/db/transaction");
    const callback = vi.fn(async () => "fallback-ok");

    await expect(withTransaction(callback)).resolves.toBe("fallback-ok");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not hide unrelated transaction errors", async () => {
    transaction.mockRejectedValueOnce(new Error("Database connection failed"));
    const { withTransaction } = await import("../../netlify/functions/lib/db/transaction");
    await expect(withTransaction(async () => "unused")).rejects.toThrow("Database connection failed");
  });
});
