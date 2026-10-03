import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { ukhuwahLocations, ukhuwahReports } from "../../netlify/functions/lib/db/schema";

const path = resolve("drizzle/0011_peta_ukhuwah.sql"), sql = readFileSync(path, "utf8");
describe("ukhuwah migration static safety", () => {
  it("contains two idempotent tables and three indexes, no seed/private data or destructive operations", () => {
    expect(sql.split("--> statement-breakpoint").filter(s => s.trim())).toHaveLength(5);
    expect(sql.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(2);
    expect(sql.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(3);
    expect(sql).not.toMatch(/(?:^|;)\s*(DROP|TRUNCATE|DELETE|INSERT|UPDATE)\b/im);
  });
  it.each([ukhuwahLocations, ukhuwahReports])("matches ORM column and index identifiers", table => {
    const config = getTableConfig(table);
    const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS ${config.name} (`);
    expect(start).toBeGreaterThanOrEqual(0);
    const statement = sql.slice(start).split("--> statement-breakpoint")[0];
    for (const col of config.columns) expect(statement).toMatch(new RegExp(`\\b${col.name}\\s+`));
    for (const index of config.indexes) expect(sql).toContain(`CREATE INDEX IF NOT EXISTS ${index.config.name} ON ${config.name}`);
    expect(config.columns.length).toBe(config.name === "ukhuwah_locations" ? 26 : 23);
  });
  it("enforces region, contact consent, coordinates, sensitive audience and independent approval", () => {
    for (const constraint of ["ukhuwah_location_region", "ukhuwah_location_coordinates", "ukhuwah_location_consent", "ukhuwah_location_contact", "ukhuwah_report_region", "ukhuwah_report_sensitive", "ukhuwah_report_moderation", "ukhuwah_report_content"]) expect(sql).toContain(`CONSTRAINT ${constraint} CHECK`);
    expect(sql).toContain("moderated_by <> author_user_id"); expect(sql).toContain("category <> 'SENSITIVE' OR audience = 'ADMIN_ONLY'");
  });
  it("runs dry-run offline with invalid database configuration and no side effects", () => {
    const output = execFileSync(process.execPath, [resolve("scripts/apply-ukhuwah-migration.mjs")], {
      env: { ...process.env, DATABASE_URL: "not-a-valid-url", DATABASE_MIGRATION_URL: "not-a-valid-url" }, encoding: "utf8", timeout: 10000,
    });
    expect(output).toContain('"mode": "dry-run"'); expect(output).toContain('"statementCount": 5'); expect(output).not.toContain('"mode": "apply"');
  });
});