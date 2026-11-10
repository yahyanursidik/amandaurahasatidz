import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/transaction", () => ({ withTransaction: mocks.transaction }));
import {
  createRepresentativeRepository,
  updateRepresentativeRepository,
  deleteRepresentativeRepository,
} from "../../netlify/functions/lib/repositories/institutionRepository";

const institutionId = "11111111-1111-4111-8111-111111111111";
const firstId = "22222222-2222-4222-8222-222222222222";
const secondId = "33333333-3333-4333-8333-333333333333";

function transactionFixture(selections: unknown[][], mutations: unknown[][] = []) {
  const changes: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];
  const operations: string[] = [];
  const select = vi.fn(() => {
    const next = () => selections.shift() || [];
    const builder = {
      from: () => builder,
      where: () => builder,
      orderBy: () => builder,
      limit: () => builder,
      for: async () => { operations.push("lock"); return next(); },
      then: (resolve: (value: unknown[]) => void, reject: (error: unknown) => void) => Promise.resolve(next()).then(resolve, reject),
    };
    return builder;
  });
  const update = vi.fn(() => ({ set: (data: Record<string, unknown>) => {
    changes.push(data);
    return { where: () => ({
      then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => { operations.push("update"); return Promise.resolve().then(resolve, reject); },
      returning: async () => { operations.push("update"); return mutations.shift() || []; },
    }) };
  } }));
  const insert = vi.fn(() => ({ values: (data: Record<string, unknown>) => {
    inserts.push(data);
    return { returning: async () => { operations.push("insert"); return mutations.shift() || []; } };
  } }));
  const remove = vi.fn(() => ({ where: () => ({ returning: async () => { operations.push("delete"); return mutations.shift() || []; } }) }));
  const tx = { select, update, insert, delete: remove };
  mocks.transaction.mockImplementation((callback: (client: typeof tx) => Promise<unknown>) => {
    return callback(tx);
  });
  return { changes, inserts, operations };
}

beforeEach(() => { mocks.transaction.mockReset(); });

describe("PIC utama lembaga", () => {
  it("menjadikan PIC pertama sebagai kontak utama otomatis", async () => {
    const fixture = transactionFixture([[{ id: institutionId }], []], [[{ id: firstId, isPrimary: true }]]);
    const created = await createRepresentativeRepository({ institutionId, name: "PIC Pertama", email: "pertama@example.invalid", isPrimary: false });
    expect(created?.isPrimary).toBe(true);
    expect(fixture.inserts[0].isPrimary).toBe(true);
    expect(fixture.changes).toHaveLength(0);
  });
  it("mengganti PIC utama dan membuat PIC baru dalam satu transaksi", async () => {
    const fixture = transactionFixture([[{ id: institutionId }], [{ id: firstId }]], [[{ id: secondId, isPrimary: true }]]);
    const created = await createRepresentativeRepository({ institutionId, name: "PIC Baru", email: "pic@example.invalid", isPrimary: true });
    expect(created?.id).toBe(secondId);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(fixture.changes[0].isPrimary).toBe(false);
    expect(fixture.inserts[0].isPrimary).toBe(true);
    expect(fixture.operations).toEqual(["lock", "update", "insert"]);
  });
  it("memindahkan kontak utama saat PIC lama dan baru diedit", async () => {
    const fixture = transactionFixture([[{ institutionId }], [{ id: institutionId }], [{ id: secondId, institutionId, isPrimary: false }]], [[{ id: secondId, isPrimary: true }]]);
    const updated = await updateRepresentativeRepository(secondId, { isPrimary: true });
    expect(updated?.isPrimary).toBe(true);
    expect(fixture.changes.map((change) => change.isPrimary)).toEqual([false, true]);
    expect(fixture.operations).toEqual(["lock", "update", "update"]);
  });
  it("mempertahankan PIC utama bila ia satu-satunya kontak", async () => {
    const fixture = transactionFixture([[{ institutionId }], [{ id: institutionId }], [{ id: firstId, institutionId, isPrimary: true }], []], [[{ id: firstId, isPrimary: true }]]);
    const updated = await updateRepresentativeRepository(firstId, { isPrimary: false });
    expect(updated?.isPrimary).toBe(true);
    expect(fixture.changes.at(-1)?.isPrimary).toBe(true);
    expect(fixture.operations).toEqual(["lock", "update"]);
  });
  it("mempromosikan PIC berikutnya saat kontak utama dihapus", async () => {
    const fixture = transactionFixture([[{ institutionId }], [{ id: institutionId }], [{ id: firstId, institutionId, isPrimary: true }], [{ id: secondId }]], [[{ id: firstId }]]);
    const deleted = await deleteRepresentativeRepository(firstId);
    expect(deleted?.id).toBe(firstId);
    expect(fixture.changes[0].isPrimary).toBe(true);
    expect(fixture.operations).toEqual(["lock", "delete", "update"]);
  });
});
