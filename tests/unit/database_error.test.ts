import { describe, expect, it } from "vitest";
import { classifyDatabaseError } from "../../netlify/functions/lib/utils/databaseError";

describe("pesan error database", () => {
  it("memberi arahan migrasi tanpa membocorkan SQL saat kolom belum tersedia", () => {
    expect(classifyDatabaseError({ name: "NeonDbError", message: 'column "regular_quota" of relation "events" does not exist' }))
      .toMatchObject({ code: "DATABASE_SCHEMA_OUTDATED", status: 503 });
    expect(classifyDatabaseError({ code: "42703", message: "column private_column does not exist" })?.message)
      .not.toContain("private_column");
  });

  it("membedakan database tidak terhubung dari kesalahan aplikasi lainnya", () => {
    expect(classifyDatabaseError(new Error("Error connecting to database: fetch failed"))?.status).toBe(503);
    expect(classifyDatabaseError(new Error("Form tidak valid"))).toBeNull();
  });
});
