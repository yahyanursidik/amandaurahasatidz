import { describe, it, expect } from "vitest";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config();

describe("Neon Database Connection Empirical Test", () => {
  it("should check if real DATABASE_URL is configured and test connection", async () => {
    const dbUrl = process.env.DATABASE_URL;
    console.log("Current DATABASE_URL:", dbUrl ? dbUrl.substring(0, 30) + "..." : "NOT SET");

    if (!dbUrl || dbUrl.includes("user:password@ep-sample")) {
      console.log("[NOTICE] DATABASE_URL masih berisi URL placeholder dari .env.example.");
      expect(true).toBe(true);
      return;
    }

    try {
      const sql = neon(dbUrl);
      const res = await sql`SELECT 1 as connected, NOW() as current_time;`;
      console.log("[SUCCESS] Neon Database Connected:", res);
      expect(res.length).toBeGreaterThan(0);
    } catch (err: any) {
      console.log("[FAILED] Neon Database Connection Error:", err.message);
      expect(err).toBeUndefined();
    }
  });
});
