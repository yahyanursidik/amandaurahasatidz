import React, { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ENV } from "@/config/env";
import { FileClock, RefreshCw, Search, ShieldCheck } from "lucide-react";

type AuditLog = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  eventId: string | null;
  reason: string | null;
  requestId: string | null;
  createdAt: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
};

const readableAction = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLocaleLowerCase("id-ID")
    .replace(/^\w/, (letter) => letter.toUpperCase());

export const AdminAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/audit-logs?limit=100`, {
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Audit sistem gagal dimuat.");
      setLogs(Array.isArray(result.data) ? result.data : []);
    } catch (loadError) {
      setLogs([]);
      setError(loadError instanceof Error ? loadError.message : "Audit sistem gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  const visibleLogs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    if (!normalized) return logs;
    return logs.filter((log) =>
      [log.action, log.resourceType, log.actorName, log.actorEmail, log.reason, log.requestId]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("id-ID").includes(normalized))
    );
  }, [logs, query]);

  return (
    <AdminLayout>
      <PageHeader
        title="Audit Sistem"
        description="Riwayat perubahan penting untuk penelusuran operasional dan keamanan."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Audit Sistem" }]}
        actions={
          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Segarkan
          </button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block">
          <span className="sr-only">Cari audit sistem</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari aksi, pengguna, sumber daya, atau request ID"
            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-xs outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <div className="flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          <span className="text-xs font-bold text-slate-700">{visibleLogs.length} catatan</span>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
          Data audit langsung belum tersedia. Pastikan API lokal atau Netlify Functions berjalan.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[10rem_minmax(12rem,1.4fr)_minmax(10rem,1fr)_11rem] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 md:grid">
          <span>Waktu</span>
          <span>Aktivitas</span>
          <span>Pelaku</span>
          <span>Sumber daya</span>
        </div>

        {loading ? (
          <div className="space-y-3 p-4" aria-label="Memuat audit sistem">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <FileClock className="h-9 w-9 text-slate-300" />
            <h2 className="mt-3 text-sm font-black text-slate-800">
              {query ? "Tidak ada catatan yang cocok" : "Belum ada catatan audit"}
            </h2>
            <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
              {query
                ? "Coba gunakan kata kunci yang lebih pendek."
                : "Aktivitas penting akan muncul setelah perubahan data dilakukan melalui API."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleLogs.map((log) => (
              <li
                key={log.id}
                className="grid gap-2 px-4 py-4 text-xs md:grid-cols-[10rem_minmax(12rem,1.4fr)_minmax(10rem,1fr)_11rem] md:items-center md:gap-4"
              >
                <time className="font-semibold tabular-nums text-slate-500">
                  {new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Jakarta",
                  }).format(new Date(log.createdAt))}
                </time>
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-900">{readableAction(log.action)}</p>
                  {log.reason && <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{log.reason}</p>}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-800">{log.actorName || "Sistem"}</p>
                  {log.actorEmail && <p className="truncate text-[11px] text-slate-500">{log.actorEmail}</p>}
                </div>
                <div>
                  <StatusBadge label={log.resourceType.replaceAll("_", " ")} variant="neutral" />
                  {log.requestId && <p className="mt-1 truncate font-mono text-[9px] text-slate-400">{log.requestId}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  );
};
