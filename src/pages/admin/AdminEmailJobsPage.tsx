import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Mail, RefreshCw, RotateCcw, Search, Send } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { eventApi } from "@/lib/eventApi";

type EmailJob = {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  status: string;
  scheduledAt: string;
  createdAt: string;
  updatedAt: string;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
};

const statusTone = (status: string) =>
  status === "SENT" ? "success" :
  status === "FAILED" || status === "DEAD_LETTER" ? "danger" :
  status === "PROCESSING" ? "info" : "warning";

const formatTime = (value: string) => new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
}).format(new Date(value));

export const AdminEmailJobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");

  const loadJobs = async () => {
    setLoading(true);
    setError("");
    try {
      setJobs(await eventApi<EmailJob[]>("/email/jobs"));
    } catch (loadError) {
      setJobs([]);
      setError(loadError instanceof Error ? loadError.message : "Antrean email gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadJobs(); }, []);

  const retry = async (jobId: string) => {
    setBusy(jobId);
    setError("");
    setNotice("");
    try {
      await eventApi(`/email/jobs/${jobId}/retry`, { method: "POST" });
      setNotice("Email gagal telah dimasukkan kembali ke antrean.");
      await loadJobs();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Email tidak dapat diantrekan ulang.");
    } finally {
      setBusy("");
    }
  };

  const processQueue = async () => {
    setBusy("process");
    setError("");
    setNotice("");
    try {
      const result = await eventApi<{ processedCount: number }>("/email/jobs/process", { method: "POST" });
      setNotice(`${result.processedCount} email diproses. Periksa status terbaru di bawah.`);
      await loadJobs();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Antrean email gagal diproses.");
    } finally {
      setBusy("");
    }
  };

  const visible = useMemo(() => jobs.filter((job) =>
    (status === "ALL" || job.status === status) &&
    (!query.trim() || [job.recipientEmail, job.recipientName, job.lastError]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(query.trim().toLowerCase()))),
  ), [jobs, query, status]);
  const queuedCount = jobs.filter((job) => job.status === "QUEUED" || job.status === "PENDING").length;
  const failedCount = jobs.filter((job) => job.status === "FAILED" || job.status === "DEAD_LETTER").length;

  return (
    <AdminLayout>
      <PageHeader
        title="Antrean email"
        description="Pantau pengiriman terbaru, tinjau kegagalan, dan jalankan ulang hanya email yang gagal."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Antrean email" }]}
        actions={<div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadJobs()} disabled={loading || Boolean(busy)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Segarkan</button>
          <button type="button" onClick={() => void processQueue()} disabled={loading || Boolean(busy) || queuedCount === 0} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" /> Proses antrean ({queuedCount})</button>
        </div>}
      />

      {error && <div role="alert" className="mb-4 flex items-start gap-2 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><AlertTriangle className="h-5 w-5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="mb-4 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</div>}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[["50 pengiriman terakhir", jobs.length], ["Menunggu kirim", queuedCount], ["Perlu ditangani", failedCount]].map(([label, value]) =>
          <div key={String(label)} className="border-t-2 border-emerald-700 bg-white p-4"><strong className="text-2xl text-slate-950">{loading ? "—" : value}</strong><p className="mt-1 text-sm text-slate-600">{label}</p></div>)}
      </div>

      <section className="border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <label className="relative flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><span className="sr-only">Cari penerima atau error</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari penerima atau penyebab gagal" className="min-h-[44px] w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm" /></label>
          <label className="sr-only" htmlFor="email-status">Filter status</label>
          <select id="email-status" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-sm"><option value="ALL">Semua status</option>{["QUEUED", "PENDING", "PROCESSING", "SENT", "FAILED", "DEAD_LETTER"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
        </div>
        {loading ? <p className="p-8 text-center text-sm text-slate-600">Memuat antrean email…</p> : visible.length === 0 ? <div className="grid justify-items-center gap-2 p-10 text-center text-slate-600"><Mail className="h-7 w-7" /><p className="text-sm">Tidak ada email yang cocok pada 50 pengiriman terakhir.</p></div> :
          <ul className="divide-y divide-slate-100">{visible.map((job) => <li key={job.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0"><p className="break-all text-sm font-black text-slate-950">{job.recipientName ? `${job.recipientName} · ` : ""}{job.recipientEmail}</p><p className="mt-1 text-xs text-slate-600">Dibuat {formatTime(job.createdAt)} · Percobaan {job.attemptCount}/{job.maxAttempts}</p>{job.lastError && <p className="mt-2 max-w-3xl break-words text-xs text-rose-700">{job.lastError}</p>}</div>
            <div className="flex shrink-0 items-center gap-3"><StatusBadge label={job.status.replaceAll("_", " ")} variant={statusTone(job.status)} />{(job.status === "FAILED" || job.status === "DEAD_LETTER") && <button type="button" onClick={() => void retry(job.id)} disabled={Boolean(busy)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-800 disabled:opacity-50"><RotateCcw className="h-4 w-4" /> Coba ulang</button>}</div>
          </li>)}</ul>}
      </section>
      <p className="mt-4 text-sm text-slate-600">Tindakan pengiriman dan percobaan ulang tercatat di <Link to="/admin/audit-logs" className="font-bold text-emerald-800 underline">audit sistem</Link>.</p>
    </AdminLayout>
  );
};
