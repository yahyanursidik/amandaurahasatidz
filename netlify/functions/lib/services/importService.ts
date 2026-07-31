import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import { institutions, ustadzProfiles } from "../db/schema";
import { eq, or } from "drizzle-orm";
import { ValidationError, ForbiddenError } from "../utils/errors";
import { createAuditLog } from "./auditService";

export interface ImportRowItem {
  code?: string;
  name: string;
  email: string;
  phone?: string;
  provinceCode?: string;
  cityCode?: string;
  address?: string;
}

export interface DryRunResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  errorReport: { line: number; field: string; error: string }[];
  duplicateReport: { line: number; key: string; reason: string }[];
  previewData: ImportRowItem[];
}

export async function processSpreadsheetImportDryRunService(
  rows: ImportRowItem[]
): Promise<DryRunResult> {
  if (!rows || rows.length === 0) {
    throw new ValidationError("Data spreadsheet kosong. Harap unggah berkas yang berisi data.");
  }

  const errorReport: { line: number; field: string; error: string }[] = [];
  const duplicateReport: { line: number; key: string; reason: string }[] = [];
  const validRows: ImportRowItem[] = [];

  let existingEmails = new Set<string>();
  let existingPhones = new Set<string>();

  try {
    if (process.env.DATABASE_URL) {
      const db = getDbClient();
      const existingInsts = await db.select({ email: institutions.email, phone: institutions.phone }).from(institutions);
      existingEmails = new Set(existingInsts.map((i) => i.email).filter((e): e is string => Boolean(e)));
      existingPhones = new Set(existingInsts.map((i) => i.phone).filter((p): p is string => Boolean(p)));
    }
  } catch (_err) {
    // Offline / test environment fallback
  }

  rows.forEach((row, index) => {
    const lineNumber = index + 2; // Header at line 1

    // 1. Validation
    if (!row.name || row.name.trim().length < 2) {
      errorReport.push({ line: lineNumber, field: "name", error: "Nama lembaga/peserta wajib diisi (minimal 2 karakter)." });
    }

    if (!row.email || !row.email.includes("@")) {
      errorReport.push({ line: lineNumber, field: "email", error: "Format email tidak valid." });
    }

    // 2. Duplicate Detection
    if (row.email && existingEmails.has(row.email)) {
      duplicateReport.push({ line: lineNumber, key: row.email, reason: `Email ${row.email} sudah terdaftar di database.` });
    } else if (row.phone && existingPhones.has(row.phone)) {
      duplicateReport.push({ line: lineNumber, key: row.phone, reason: `No. Telepon ${row.phone} sudah terdaftar di database.` });
    } else {
      validRows.push(row);
    }
  });

  return {
    totalRows: rows.length,
    validCount: validRows.length,
    invalidCount: errorReport.length,
    duplicateCount: duplicateReport.length,
    errorReport,
    duplicateReport,
    previewData: validRows.slice(0, 10), // First 10 rows for preview
  };
}

export async function commitSpreadsheetImportService(
  input: {
    rows: ImportRowItem[];
    approved: boolean;
    targetType: "INSTITUTIONS" | "USTADZ";
  },
  actorUserId?: string,
  requestId = "req-import-commit"
) {
  // 1. Mandatory Approval Guard (Compliance Point 7)
  if (input.approved !== true) {
    throw new ForbiddenError(
      "Ditolak: Impor otomatis ke database dilarang tanpa konfirmasi preview dan persetujuan eksplisit (approved: true)."
    );
  }

  // 2. Run Dry-Run check first
  const dryRun = await processSpreadsheetImportDryRunService(input.rows);
  if (dryRun.validCount === 0) {
    throw new ValidationError("Tidak ada data valid yang dapat diimpor. Harap perbaiki errorReport dan duplicateReport.");
  }

  // 3. Execute Batch Transaction (Compliance Point 6)
  const insertedCount = await withTransaction(async (tx) => {
    let countInserted = 0;

    for (const row of dryRun.previewData) {
      if (input.targetType === "INSTITUTIONS") {
        await tx.insert(institutions).values({
          code: row.code || `INST-IMP-${Date.now()}-${countInserted}`,
          name: row.name,
          email: row.email,
          phone: row.phone || null,
          provinceCode: row.provinceCode || "32",
          cityCode: row.cityCode || "3273",
          address: row.address || null,
        });
        countInserted++;
      }
    }

    return countInserted;
  });

  // 4. Record Audit Log
  if (requestId) {
    await createAuditLog({
      actorUserId: actorUserId || null,
      action: "SPREADSHEET_IMPORTED",
      resourceType: input.targetType,
      resourceId: `batch_imp_${Date.now()}`,
      reason: `Impor spreadsheet ${input.targetType} berhasil sebanyak ${insertedCount} entri setelah persetujuan preview.`,
      requestId,
    });
  }

  return {
    status: "SUCCESS",
    message: `Impor batch ${input.targetType} berhasil menambahkan ${insertedCount} data baru ke database.`,
    importedCount: insertedCount,
  };
}
