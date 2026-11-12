import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { eventApiEnvelope } from "@/lib/eventApi";
import { collectParticipantExportRows, downloadParticipantExcel, MAX_PARTICIPANT_EXPORT_ROWS,
  type ParticipantExportEvent, type ParticipantExportRow, type ExportPage } from "@/lib/participantExcelExport";

type Props = {
  event: ParticipantExportEvent;
  queryString: string;
  filterSummary: string;
  total: number;
  canExport: boolean;
  disabled?: boolean;
  previewMode?: boolean;
  previewRecords?: ParticipantExportRow[];
};

export const ParticipantExcelExport: React.FC<Props> = ({ event, queryString, filterSummary, total,
  canExport, disabled = false, previewMode = false, previewRecords = [] }) => {
  const filterKey = useMemo(() => {
    const params = new URLSearchParams(queryString);
    for (const key of ["page", "pageSize", "projection", "includeInstitutions"]) params.delete(key);
    return params.toString();
  }, [queryString]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setBusy(false); setProgress(""); setError(""); setSuccess("");
    return () => { controllerRef.current?.abort(); controllerRef.current = null; };
  }, [event.id, filterKey]);

  if (!canExport) return null;

  const runExport = async () => {
    if (busy || disabled || !total || total > MAX_PARTICIPANT_EXPORT_ROWS) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true); setError(""); setSuccess(""); setProgress("Mengambil data peserta…");
    try {
      const records = previewMode ? previewRecords : await collectParticipantExportRows<ParticipantExportRow>(
        (page, pageSize, signal): Promise<ExportPage<ParticipantExportRow>> => {
          const params = new URLSearchParams(filterKey);
          params.set("page", String(page)); params.set("pageSize", String(pageSize)); params.set("projection", "full");
          return eventApiEnvelope<ParticipantExportRow[], { total: number }>(
            `/events/${event.id}/participants/export?${params}`, { signal });
        },
        (loaded, expected) => { if (!controller.signal.aborted) setProgress(`Mengambil ${loaded.toLocaleString("id-ID")} dari ${expected.toLocaleString("id-ID")} peserta…`); },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!records.length) throw new Error("Tidak ada peserta sesuai filter untuk diekspor.");
      setProgress("Membuat file Excel…");
      await downloadParticipantExcel(event, records, filterSummary, controller.signal);
      if (!controller.signal.aborted) setSuccess(`${records.length.toLocaleString("id-ID")} peserta diunduh sesuai filter aktif.`);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "File Excel gagal dibuat.");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setBusy(false); setProgress("");
      }
    }
  };

  return <div className="flex min-w-0 flex-col gap-1">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void runExport()} disabled={busy || disabled || total === 0 || total > MAX_PARTICIPANT_EXPORT_ROWS}
        title="Unduh seluruh peserta sesuai filter, termasuk halaman lain. Berisi data kontak pribadi."
        className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-emerald-700 bg-white px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? "Menyiapkan Excel…" : "Unduh Excel"}
      </button>
      {busy && <button type="button" onClick={() => controllerRef.current?.abort()}
        className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700">Batalkan</button>}
    </div>
    {!busy && !error && !success && total > 0 && total <= MAX_PARTICIPANT_EXPORT_ROWS &&
      <span className="text-xs text-slate-600">Berisi kontak pribadi. Simpan dan bagikan hanya kepada petugas berwenang.</span>}
    {busy && <span role="status" className="text-xs text-slate-600">{progress}</span>}
    {total > MAX_PARTICIPANT_EXPORT_ROWS && <span role="alert" className="text-xs font-semibold text-amber-900">Lebih dari {MAX_PARTICIPANT_EXPORT_ROWS.toLocaleString("id-ID")} peserta. Persempit filter sebelum ekspor.</span>}
    {error && <span role="alert" className="text-xs font-semibold text-rose-700">{error}</span>}
    {success && <span role="status" className="text-xs font-semibold text-emerald-800">{success}</span>}
  </div>;
};
