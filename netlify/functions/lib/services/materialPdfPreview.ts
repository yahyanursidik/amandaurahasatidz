import { PDF_PREVIEW_CHUNK_BYTES, PDF_PREVIEW_MAX_BYTES, parsePdfContentRange, type MaterialSource } from "../../../../src/lib/eventMaterial";
import { AppError, ValidationError } from "../utils/errors";
import { checkRateLimit } from "../utils/rateLimiter";

function previewUnavailable() {
  return new AppError("PDF belum bisa dimuat dari penyimpanan. Coba buka file di sumbernya.", 502, "PDF_SOURCE_UNAVAILABLE");
}

async function readPreviewBytes(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw previewUnavailable();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > PDF_PREVIEW_CHUNK_BYTES) {
        throw new ValidationError("Penyimpanan perlu mendukung permintaan bagian file untuk pratinjau PDF ini.");
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks, length);
}

export async function getMaterialPdfPart(source: MaterialSource, range: string | undefined, userId: string, requestId: string) {
  const rangeMatch = range?.match(/^bytes=(\d{1,10})-(\d{1,10})$/);
  const start = Number(rangeMatch?.[1]);
  const end = Number(rangeMatch?.[2]);
  if (!rangeMatch || end < start || end >= PDF_PREVIEW_MAX_BYTES || end - start >= PDF_PREVIEW_CHUNK_BYTES) {
    throw new ValidationError("Bagian file PDF tidak valid.");
  }
  const rate = checkRateLimit(`material_pdf:${userId}`, 180, 60_000);
  if (!rate.allowed) throw new AppError("Terlalu banyak permintaan pratinjau. Coba lagi sebentar.", 429, "PDF_PREVIEW_RATE_LIMIT");

  let upstream: Response | undefined;
  try {
    upstream = await fetch(source.url, {
      headers: { Range: range!, Accept: "application/pdf, application/octet-stream" },
      redirect: "error", credentials: "omit", signal: AbortSignal.timeout(12_000),
    });
    const type = upstream.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!upstream.ok || (type !== "application/pdf" && type !== "application/octet-stream")) throw previewUnavailable();

    const contentRange = parsePdfContentRange(upstream.headers.get("content-range"));
    if (upstream.status === 206) {
      if (!contentRange || contentRange.start !== start || contentRange.end !== Math.min(end, contentRange.size - 1)) {
        throw previewUnavailable();
      }
      if (contentRange.size > PDF_PREVIEW_MAX_BYTES) throw new ValidationError("PDF terlalu besar untuk pratinjau. Buka file di sumbernya.");
    } else if (upstream.status !== 200 || start !== 0 || Number(upstream.headers.get("content-length")) > PDF_PREVIEW_CHUNK_BYTES) {
      throw new ValidationError("Penyimpanan perlu mendukung permintaan bagian file untuk pratinjau PDF ini.");
    }

    const bytes = await readPreviewBytes(upstream);
    if (!bytes.length || (contentRange && bytes.length !== contentRange.end - start + 1) ||
      (start === 0 && !bytes.subarray(0, 1024).includes("%PDF-"))) throw previewUnavailable();

    const etag = upstream.headers.get("etag");
    return {
      statusCode: upstream.status,
      isBase64Encoded: true,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-ID": requestId,
        ...(etag && { ETag: etag }),
        ...(contentRange && { "Content-Range": `bytes ${contentRange.start}-${contentRange.end}/${contentRange.size}` }),
      },
      body: bytes.toString("base64"),
    };
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw previewUnavailable();
  } finally {
    if (!upstream?.bodyUsed) await upstream?.body?.cancel().catch(() => {});
  }
}
