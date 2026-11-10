import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), close: vi.fn(), tx: { marker: "transaction-only" } }));
vi.mock("../../netlify/functions/lib/db/transactionClient", () => ({
  createTransactionClient: () => ({ db: { transaction: mocks.transaction }, close: mocks.close }),
}));
import { withTransaction } from "../../netlify/functions/lib/db/transaction";

beforeEach(() => {
  vi.resetAllMocks(); mocks.close.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx));
});
describe("interactive transactions, without unsafe HTTP fallback", () => {
  it("executes only inside the transaction and closes the request-local pool", async () => {
    const callback = vi.fn(async () => "committed");
    expect(await withTransaction(callback)).toBe("committed");
    expect(callback).toHaveBeenCalledExactlyOnceWith(mocks.tx); expect(mocks.close).toHaveBeenCalledTimes(1);
  });
  it("propagates a callback failure without replaying writes", async () => {
    const callback = vi.fn(async () => { throw new Error("rollback"); });
    await expect(withTransaction(callback)).rejects.toThrow("rollback");
    expect(callback).toHaveBeenCalledTimes(1); expect(mocks.close).toHaveBeenCalledTimes(1);
  });
  it.each(["No transactions support in neon-http driver", "Database connection failed"])("fails closed: %s", async (message) => {
    mocks.transaction.mockRejectedValue(new Error(message)); const callback = vi.fn();
    await expect(withTransaction(callback)).rejects.toThrow(message);
    expect(callback).not.toHaveBeenCalled(); expect(mocks.close).toHaveBeenCalledTimes(1);
  });
  it("does not mask the original failure when connection cleanup also fails", async () => {
    mocks.close.mockRejectedValue(new Error("cleanup failed"));
    await expect(withTransaction(async () => { throw new Error("original"); })).rejects.toThrow("original");
  });
  it("does not report a committed write as failed when pool cleanup fails", async () => {
    mocks.close.mockRejectedValue(new Error("cleanup failed"));
    expect(await withTransaction(async () => "committed")).toBe("committed");
  });
});
