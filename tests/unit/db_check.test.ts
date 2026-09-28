import { describe, it, expect } from "vitest";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

describe("Neon Database Connection Empirical Test", () => {
  const integrationIt = process.env.RUN_NEON_INTEGRATION_TESTS === "1" ? it : it.skip;
  integrationIt("connects to Neon when integration testing is explicitly enabled", async () => {
    dotenv.config();
    const dbUrl = process.env.DATABASE_URL;
    expect(dbUrl && !dbUrl.includes("user:password@ep-sample")).toBeTruthy();
    const sql = neon(dbUrl!);
    const res = await sql`SELECT 1 as connected;`;
    expect(res[0]?.connected).toBe(1);
  });
});
