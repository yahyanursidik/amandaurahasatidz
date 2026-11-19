import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getDocument, GlobalWorkerOptions, PDFDataRangeTransport, type PDFDocumentLoadingTask,
  type PDFDocumentProxy, type PDFPageProxy, type RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { ENV } from "@/config/env";
import { PDF_PREVIEW_CHUNK_BYTES, parsePdfContentRange } from "@/lib/eventMaterial";

GlobalWorkerOptions.workerSrc = workerUrl;
const assets = `${import.meta.env.BASE_URL}${import.meta.env.DEV ? "node_modules/pdfjs-dist" : "pdfjs"}`;
const previewError = "Pratinjau PDF gagal dimuat. Anda bisa membuka file di sumbernya.";

async function fetchPart(path: string, url: string, start: number, end: number, signal: AbortSignal) {
  const response = await fetch(`${ENV.API_BASE_URL}${path}`, {
    method: "POST", credentials: "include", cache: "no-store", signal,
    headers: { "Content-Type": "application/json", Range: `bytes=${start}-${end - 1}` },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error?.message || previewError);
  }
  const range = parsePdfContentRange(response.headers.get("content-range"));
  if (response.headers.get("content-type")?.split(";")[0] !== "application/pdf" ||
    (response.status === 206 ? (!range || range.start !== start || range.end !== Math.min(end, range.size) - 1)
      : (response.status !== 200 || start !== 0))) throw new Error(previewError);

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > PDF_PREVIEW_CHUNK_BYTES || (range && bytes.length !== range.end - start + 1)) {
    throw new Error(previewError);
  }
  return { bytes, size: range?.size ?? bytes.length, etag: response.headers.get("etag") };
}

export default function S3PdfPreview({ path, url, title, buttonClass }: { path: string; url: string; title: string; buttonClass: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [number, setNumber] = useState(1);
  const [rendered, setRendered] = useState<number | null>(null);
  const [pageText, setPageText] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let task: PDFDocumentLoadingTask | undefined;
    const stop = () => {
      if (controller.signal.aborted) return;
      controller.abort();
      void task?.destroy().catch(() => {});
    };
    const fail = (message: string) => {
      if (controller.signal.aborted) return;
      setError(message);
      stop();
    };
    const load = async () => {
      const { bytes, size, etag } = await fetchPart(path, url, 0, PDF_PREVIEW_CHUNK_BYTES, controller.signal);
      if (controller.signal.aborted) return;
      const range = bytes.length < size ? new PDFDataRangeTransport(size, bytes, true) : null;
      if (range) {
        range.requestDataRange = (begin, end) => {
          const loadRange = async () => {
            const chunk = new Uint8Array(end - begin);
            for (let offset = begin; offset < end; offset += PDF_PREVIEW_CHUNK_BYTES) {
              const part = await fetchPart(path, url, offset, Math.min(end, offset + PDF_PREVIEW_CHUNK_BYTES), controller.signal);
              if (part.size !== size || part.etag !== etag) throw new Error("File berubah saat dibuka. Muat ulang pratinjau.");
              chunk.set(part.bytes, offset - begin);
            }
            if (!controller.signal.aborted) range.onDataRange(begin, chunk);
          };
          void loadRange().catch((cause) => fail(cause instanceof Error ? cause.message : previewError));
        };
      }
      task = getDocument({
        ...(range ? { range, rangeChunkSize: PDF_PREVIEW_CHUNK_BYTES, disableStream: true, disableAutoFetch: true } : { data: bytes }),
        cMapUrl: `${assets}/cmaps/`, standardFontDataUrl: `${assets}/standard_fonts/`,
        iccUrl: `${assets}/iccs/`, wasmUrl: `${assets}/wasm/`, disableWorkerRendering: true,
      });
      task.onPassword = () => fail("PDF dilindungi kata sandi. Buka file di sumbernya.");
      const next = await task.promise;
      if (!controller.signal.aborted) setDocument(next);
    };
    void load().catch((cause) => fail(cause instanceof Error && cause.name === "Error" ? cause.message : previewError));
    return stop;
  }, [path, url, attempt]);

  useEffect(() => {
    const target = canvas.current;
    if (!document || !target) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    let page: PDFPageProxy | undefined;
    const draw = async () => {
      page = await document.getPage(number);
      if (cancelled) return;
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2.5, 1440 / original.width, 1800 / original.height) });
      target.width = Math.max(1, Math.floor(viewport.width));
      target.height = Math.max(1, Math.floor(viewport.height));
      task = page.render({ canvas: target, viewport });
      await task.promise;
      if (cancelled) return;
      setRendered(number);
      const content = await page.getTextContent().catch(() => null);
      if (!cancelled && content) setPageText(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    };
    void draw().catch(() => {
      if (!cancelled) setError((current) => current || previewError);
    });
    return () => {
      cancelled = true;
      task?.cancel();
      page?.cleanup();
    };
  }, [document, number]);

  const goTo = (next: number) => {
    setNumber(next);
    setRendered(null);
    setPageText("");
    scroll.current?.scrollTo({ top: 0 });
  };

  const retry = () => {
    setDocument(null);
    goTo(1);
    setError("");
    setAttempt((current) => current + 1);
  };

  return <div className="min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-slate-100">
    {document && !error && <div className="flex flex-wrap items-center justify-center gap-2 border-b border-slate-300 bg-white p-2 sm:gap-3">
      <button type="button" className={buttonClass} aria-label="Halaman sebelumnya" disabled={number <= 1}
        onClick={() => goTo(number - 1)}><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
      <span className="text-sm font-semibold tabular-nums text-slate-800" role="status">Halaman {number} dari {document.numPages}</span>
      <button type="button" className={buttonClass} aria-label="Halaman berikutnya" disabled={number >= document.numPages}
        onClick={() => goTo(number + 1)}><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
    </div>}
    {error ? <div className="flex flex-wrap items-center gap-3 p-4">
      <p className="text-sm font-medium text-slate-800" role="alert">{error}</p>
      <button type="button" className={buttonClass} onClick={retry}>Muat ulang</button>
    </div> : <div ref={scroll} className="max-h-[min(68vh,780px)] overflow-auto p-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-700 sm:p-3"
      role="region" aria-label={`Pratinjau ${title}`} tabIndex={rendered === number ? 0 : undefined}>
      {rendered !== number && <p role="status" className="grid min-h-40 place-items-center px-3 text-sm text-slate-700">Memuat halaman PDF…</p>}
      <canvas ref={canvas} aria-hidden="true" className={rendered === number ? "mx-auto block h-auto max-w-full bg-white shadow-sm" : "hidden"} />
      {pageText && <p className="sr-only">{pageText}</p>}
    </div>}
  </div>;
}
