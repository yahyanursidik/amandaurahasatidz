import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGetIdentity } from "@refinedev/core";
import { AlertTriangle, CalendarClock, Mail, Megaphone, RefreshCw, RotateCcw, Search, Send, Users } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { eventApi } from "@/lib/eventApi";
import { AuthIdentity } from "@/lib/refine/authProvider";

type EmailJob = {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  templateName?: string | null;
  subject?: string | null;
  status: string;
  scheduledAt: string;
  createdAt: string;
  updatedAt: string;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
};
type BroadcastTemplate = { id: string; name: string; subjectTemplate: string; bodyTemplate: string };
type Audience = { recipientCount: number; withoutValidEmail: number; duplicateEmails: number };
type Campaign = { campaignId: string; templateName: string | null; dailyLimit: number | null; total: number; queued: number; sent: number; delivered: number; failed: number; processing: number; cancelled: number; testSent: number; testFailed: number; lastTestAt: string | null; firstScheduledAt: string; lastScheduledAt: string; createdAt: string };
type Readiness = { workerEnabled: boolean; provider: string; configured: boolean; lastTest: { status: string; recipientEmail: string; attemptedAt: string; lastError: string | null; provider: string | null } | null };
type CampaignJob = { id: string; recipientEmail: string; recipientName: string | null; status: string; scheduledAt: string; updatedAt: string; attemptCount: number; lastError: string | null; deliveryStatus: string | null; provider: string | null };
type CampaignJobPage = { total: number; page: number; pageSize: number; items: CampaignJob[] };

const statusTone = (status: string) =>
  status === "SENT" ? "success" :
  status === "FAILED" || status === "DEAD_LETTER" ? "danger" :
  status === "PROCESSING" ? "info" : "warning";

const formatTime = (value: string) => new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
}).format(new Date(value));

export const AdminEmailJobsPage: React.FC<{ mode?: "broadcast" | "queue" }> = ({ mode = "queue" }) => {
  const { data: identity, isLoading: identityLoading } = useGetIdentity<AuthIdentity>();
  const canManageEmail = identity?.assignments.some((assignment) => assignment.roleCode === "SUPER_ADMIN") ?? false;
  const [jobs, setJobs] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Assalamu'alaikum, {{nama}}");
  const [body, setBody] = useState("Assalamu'alaikum Ustadz/Ustadzah {{nama}},\n\nSemoga antum senantiasa dalam keadaan sehat.\n\nSalam hangat,\nPanitia Daurah Asatidz");
  const [scheduledAt, setScheduledAt] = useState("");
  const [frequency, setFrequency] = useState<"ONCE" | "WEEKLY" | "MONTHLY">("ONCE");
  const [occurrences, setOccurrences] = useState(4);
  const [dailyLimit, setDailyLimit] = useState(100);
  const [testEmail, setTestEmail] = useState("");
  const [testName, setTestName] = useState("");
  const [expandedCampaign, setExpandedCampaign] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("ALL");
  const [campaignJobs, setCampaignJobs] = useState<CampaignJobPage | null>(null);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const pendingCampaignId = useRef<string>(crypto.randomUUID());
  const savedTemplate = templates.find((item) => item.id === templateId);
  const templateIsSaved = Boolean(savedTemplate && savedTemplate.name === name && savedTemplate.subjectTemplate === subject && savedTemplate.bodyTemplate === body);

  const loadTemplates = async () => setTemplates(await eventApi<BroadcastTemplate[]>("/email/broadcast/templates"));
  const loadCampaignData = async () => {
    const [recipients, history, status] = await Promise.all([
      eventApi<Audience>("/email/broadcast/audience"),
      eventApi<Campaign[]>("/email/broadcast/campaigns"),
      eventApi<Readiness>("/email/broadcast/readiness"),
    ]);
    setAudience(recipients); setCampaigns(history); setReadiness(status);
  };

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

  useEffect(() => {
    if (identityLoading || !canManageEmail) return;
    if (mode === "broadcast") {
      setLoading(false);
      void Promise.all([loadTemplates(), loadCampaignData()]).catch((err) => setError(err instanceof Error ? err.message : "Data BC gagal dimuat."));
    } else void loadJobs();
  }, [mode, canManageEmail, identityLoading]);

  useEffect(() => {
    if (identity?.email && !testEmail) setTestEmail(identity.email);
    if (identity?.name && !testName) setTestName(identity.name);
  }, [identity?.email, identity?.name]);

  const saveTemplate = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy("template"); setError(""); setNotice("");
    try {
      const saved = await eventApi<BroadcastTemplate>("/email/broadcast/templates", { method: "POST",
        body: JSON.stringify({ ...(templateId ? { id: templateId } : {}), name, subject, body }) });
      await loadTemplates(); setTemplateId(saved.id);
      setNotice("Template BC tersimpan. Pratinjau di bawah dapat diperiksa sebelum dijadwalkan.");
    } catch (err) { setError(err instanceof Error ? err.message : "Template gagal disimpan."); }
    finally { setBusy(""); }
  };

  const scheduleCampaign = async () => {
    if (!templateId || !scheduledAt || !window.confirm("Jadwalkan BC untuk seluruh profil asatidz aktif yang memiliki email?")) return;
    setBusy("schedule"); setError(""); setNotice("");
    try {
      const result = await eventApi<{ recipientCount: number; occurrenceCount: number; jobCount: number }>("/email/broadcast/schedule", {
        method: "POST", body: JSON.stringify({ campaignId: pendingCampaignId.current, templateId, scheduledAt: new Date(scheduledAt).toISOString(),
          frequency, occurrences: frequency === "ONCE" ? 1 : occurrences, dailyLimit }),
      });
      pendingCampaignId.current = crypto.randomUUID();
      setNotice(`BC terjadwal untuk ${result.recipientCount} alamat, ${result.occurrenceCount} kali (${result.jobCount} email).`);
      await loadCampaignData();
    } catch (err) { setError(err instanceof Error ? err.message : "Jadwal BC gagal dibuat."); }
    finally { setBusy(""); }
  };

  const sendTest = async (target: { templateId?: string; campaignId?: string }) => {
    if (!testEmail.trim() || !window.confirm(`Kirim SATU email uji nyata ke ${testEmail.trim()}? Email ini tidak dikirim ke daftar asatidz.`)) return;
    setBusy("test"); setError(""); setNotice("");
    try {
      const route = target.campaignId
        ? `/email/broadcast/campaigns/${target.campaignId}/test`
        : `/email/broadcast/templates/${target.templateId}/test`;
      const result = await eventApi<{ status: string; provider: string; error: string | null; providerMessageId: string | null }>(route, {
        method: "POST", body: JSON.stringify({ recipientEmail: testEmail.trim(), recipientName: testName.trim() || undefined }),
      });
      if (result.status === "FAILED") setError(`Uji kirim gagal (${result.provider}): ${result.error || "Penyedia menolak email."}`);
      else setNotice(`Email uji diterima oleh ${result.provider}${result.providerMessageId ? ` · ID ${result.providerMessageId}` : ""}. Periksa kotak masuk/spam untuk memastikan email tiba.`);
      await loadCampaignData();
    } catch (err) { setError(err instanceof Error ? err.message : "Uji kirim gagal diproses."); }
    finally { setBusy(""); }
  };

  const loadCampaignJobs = async (id: string, page = 1, filter = campaignFilter) => {
    setBusy("jobs"); setError("");
    try {
      const result = await eventApi<CampaignJobPage>(`/email/broadcast/campaigns/${id}/jobs?page=${page}&status=${filter}`);
      setCampaignJobs(result); setExpandedCampaign(id); setCampaignFilter(filter);
    } catch (err) { setError(err instanceof Error ? err.message : "Detail penerima gagal dimuat."); }
    finally { setBusy(""); }
  };

  const cancelCampaign = async (campaignId: string) => {
    if (!window.confirm("Batalkan semua email mendatang dari kampanye ini? Email yang telah terkirim tidak dapat ditarik kembali.")) return;
    setBusy(campaignId); setError(""); setNotice("");
    try {
      const result = await eventApi<{ cancelledCount: number }>(`/email/broadcast/campaigns/${campaignId}/cancel`, { method: "POST" });
      setNotice(`${result.cancelledCount} email yang belum diproses dibatalkan.`);
      await loadCampaignData();
    } catch (err) { setError(err instanceof Error ? err.message : "Kampanye gagal dibatalkan."); }
    finally { setBusy(""); }
  };

  const previewText = (text: string) => text.replace(/{{\s*nama\s*}}/gi, "Ustadz Ahmad")
    .replace(/{{\s*email\s*}}/gi, "ahmad@example.com");

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
  const dueCount = jobs.filter((job) => (job.status === "QUEUED" || job.status === "PENDING") && new Date(job.scheduledAt).getTime() <= Date.now()).length;
  const failedCount = jobs.filter((job) => job.status === "FAILED" || job.status === "DEAD_LETTER").length;

  return (
    <AdminLayout>
      <PageHeader
        title={mode === "broadcast" ? "BC & kampanye email" : "Antrean & pengiriman email"}
        description={mode === "broadcast" ? "Tulis sapaan personal, tinjau penerima, jadwalkan dan pantau kampanye." : "Periksa pengiriman, jadwal tertunda, dan email yang perlu ditangani."}
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: mode === "broadcast" ? "BC & kampanye email" : "Antrean email" }]}
        actions={mode === "broadcast" ? <Link to="/admin/email-jobs" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800"><Mail className="h-4 w-4" /> Lihat antrean email</Link> : <div className="flex flex-wrap gap-2">
          <Link to="/admin/broadcast" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-700 bg-white px-4 text-sm font-bold text-emerald-800"><Megaphone className="h-4 w-4" /> BC & kampanye</Link>
          <button type="button" onClick={() => void loadJobs()} disabled={loading || Boolean(busy)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Segarkan</button>
          <button type="button" onClick={() => void processQueue()} disabled={loading || Boolean(busy)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" /> Proses yang jatuh tempo{dueCount ? ` (${dueCount} terlihat)` : ""}</button>
        </div>}
      />

      {error && <div role="alert" className="mb-4 flex items-start gap-2 border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><AlertTriangle className="h-5 w-5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="mb-4 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">{notice}</div>}

      {!identityLoading && !canManageEmail ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">BC dan pengelolaan antrean email memerlukan akun Super Admin. Masuk menggunakan akun berwenang untuk membuat kampanye.</div> : <>

      {mode === "broadcast" && <>
      {readiness && <div role="status" className={`mb-5 rounded-xl border p-4 text-sm ${readiness.configured && readiness.workerEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
        <strong>{readiness.provider === "MAILKETING" ? "Koneksi Mailketing" : "Koneksi SMTP"}: {readiness.configured ? "konfigurasi tersedia" : "konfigurasi belum lengkap"}</strong> · Worker otomatis {readiness.workerEnabled ? "aktif" : "nonaktif"}.
        {readiness.lastTest ? <p className="mt-2">Uji kirim terakhir {formatTime(readiness.lastTest.attemptedAt)} ke {readiness.lastTest.recipientEmail} via {readiness.lastTest.provider || "penyedia"}: {readiness.lastTest.status === "SENT" ? "diterima penyedia" : "gagal"}{readiness.lastTest.lastError ? ` — ${readiness.lastTest.lastError}` : ""}.</p> : <p className="mt-2">Belum ada bukti penerimaan email uji oleh penyedia. Konfigurasi terisi bukan berarti koneksi sudah teruji.</p>}
        {!readiness.workerEnabled && <p className="mt-2">Agar BC terkirim otomatis, atur EMAIL_WORKER_ENABLED=true pada server terjadwal. Pada localhost proses email yang jatuh tempo dari halaman antrean.</p>}
      </div>}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><Users className="h-5 w-5 text-emerald-700" /><strong className="mt-2 block text-2xl text-emerald-950">{audience?.recipientCount ?? "—"}</strong><p className="text-sm text-emerald-900">Email unik siap menerima BC</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><Mail className="h-5 w-5 text-slate-600" /><strong className="mt-2 block text-2xl">{audience?.withoutValidEmail ?? "—"}</strong><p className="text-sm text-slate-600">Profil tanpa email valid</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><CalendarClock className="h-5 w-5 text-slate-600" /><strong className="mt-2 block text-2xl">{campaigns.length}</strong><p className="text-sm text-slate-600">Kampanye terbaru</p></div>
      </div>
      {audience && <p className="mb-5 text-sm text-slate-600">Penerima berasal dari profil asatidz aktif. {audience.duplicateEmails} alamat duplikat disatukan; profil tanpa email valid dilewati. <Link to="/admin/ustadz" className="font-bold text-emerald-800 underline">Periksa data asatidz</Link>.</p>}
      <section className="mb-6 grid gap-5 lg:grid-cols-2" aria-label="Kampanye sapaan asatidz">
        <form onSubmit={(event) => void saveTemplate(event)} className="space-y-3 border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-black text-slate-900">Template BC sapaan asatidz</h2>
          <p className="text-sm text-slate-600">Sisipkan variabel {"{{nama}}"} atau {"{{email}}"} untuk sapaan personal.</p>
          <label className="block text-sm font-bold">Pilih template tersimpan
            <select value={templateId} onChange={(event) => { const id = event.target.value; setTemplateId(id); const item = templates.find((entry) => entry.id === id); if (item) { setName(item.name); setSubject(item.subjectTemplate); setBody(item.bodyTemplate); } }} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3">
              <option value="">Template baru</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold">Nama template<input required minLength={3} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3" placeholder="Sapaan Jumat" /></label>
          <label className="block text-sm font-bold">Subjek email<input required minLength={3} maxLength={180} value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3" /></label>
          <label className="block text-sm font-bold">Isi pesan<textarea required minLength={10} maxLength={10000} rows={7} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-3 font-normal" /></label>
          <button disabled={Boolean(busy)} className="min-h-11 rounded bg-emerald-700 px-5 font-bold text-white disabled:opacity-50">Simpan template</button>
        </form>
        <div className="space-y-4">
          <div className="border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-black">Pratinjau email</h2>
            <img src="/images/tarbiyah-sunnah-logo.svg" alt="Tarbiyah Sunnah" width="160" height="46" className="mt-4 h-auto w-40 object-contain" />
            <p className="mt-3 text-sm font-bold">Subjek: {previewText(subject)}</p>
            <div className="mt-3 whitespace-pre-wrap break-words border-t border-slate-200 pt-3 text-sm leading-7">{previewText(body)}</div>
          </div>
          <div className="space-y-3 border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-black">Uji kirim satu email</h2>
            <p className="text-sm text-slate-600">Uji template sebelum menjadwalkan atau uji isi kampanye dari riwayat di bawah. Uji kirim memakai penyedia email sungguhan dan tidak mengurangi kuota BC harian.</p>
            <label className="block text-sm font-bold">Email penerima uji<input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="admin@contoh.id" className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3" /></label>
            <label className="block text-sm font-bold">Nama contoh<input value={testName} onChange={(event) => setTestName(event.target.value)} maxLength={120} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3" /></label>
            <button type="button" onClick={() => void sendTest({ templateId })} disabled={!templateIsSaved || !testEmail.trim() || Boolean(busy)} className="min-h-11 rounded-lg border border-emerald-700 px-4 text-sm font-bold text-emerald-800 disabled:opacity-50">Kirim uji template</button>
            {!templateIsSaved && <p className="text-xs text-amber-800">Simpan template dahulu sebelum uji kirim.</p>}
          </div>
          <div className="space-y-3 border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-black">Jadwalkan pengiriman otomatis</h2>
            <p className="text-sm text-slate-600">Waktu mengikuti zona waktu perangkat. Pengiriman berjalan saat worker email aktif.</p>
            <label className="block text-sm font-bold">Mulai kirim<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3" /></label>
            <label className="block text-sm font-bold">Pengulangan<select value={frequency} onChange={(event) => setFrequency(event.target.value as typeof frequency)} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3"><option value="ONCE">Sekali</option><option value="WEEKLY">Setiap minggu</option><option value="MONTHLY">Setiap bulan</option></select></label>
            {frequency !== "ONCE" && <label className="block text-sm font-bold">Jumlah pengiriman (maks. 12)<input type="number" min={2} max={12} value={occurrences} onChange={(event) => setOccurrences(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3" /></label>}
            <label className="block text-sm font-bold">Maksimal email per hari<input type="number" min={1} max={5000} value={dailyLimit} onChange={(event) => setDailyLimit(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3" /></label>
            {audience && <p className="text-xs text-slate-600">{audience.recipientCount} email unik dalam database → sekitar {dailyLimit > 0 ? Math.ceil(audience.recipientCount / dailyLimit) : "—"} hari per pengiriman. Waktu per hari mengikuti WIB; uji kirim tidak termasuk hitungan ini.</p>}
            {!templateIsSaved && <p className="text-xs text-amber-800">Simpan perubahan template sebelum menjadwalkan.</p>}
            <button type="button" onClick={() => void scheduleCampaign()} disabled={!templateIsSaved || !scheduledAt || Boolean(busy)} className="min-h-11 rounded bg-slate-950 px-5 font-bold text-white disabled:opacity-50">Jadwalkan BC</button>
          </div>
        </div>
      </section>

      <section className="mb-6 border border-slate-200 bg-white p-5" aria-labelledby="campaign-history">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="campaign-history" className="text-lg font-black">Riwayat kampanye</h2><p className="mt-1 text-sm text-slate-600">Ringkasan 30 kampanye terakhir; batalkan email yang belum diproses jika diperlukan.</p></div><button type="button" onClick={() => void loadCampaignData().catch((err) => setError(err instanceof Error ? err.message : "Kampanye gagal dimuat."))} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold"><RefreshCw className="h-4 w-4" /> Segarkan</button></div>
        {campaigns.length === 0 ? <p className="mt-5 text-sm text-slate-600">Belum ada kampanye terjadwal.</p> : <ul className="mt-4 divide-y divide-slate-200">{campaigns.map((item) => <li key={item.campaignId} className="py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-slate-900">{item.templateName || "BC asatidz"} · {item.total} email</p><p className="mt-1 text-xs text-slate-600">Dibuat {formatTime(item.createdAt)} · Jadwal {item.firstScheduledAt ? formatTime(item.firstScheduledAt) : "—"}{item.lastScheduledAt && item.lastScheduledAt !== item.firstScheduledAt ? ` – ${formatTime(item.lastScheduledAt)}` : ""} · Batas {item.dailyLimit || "—"}/hari</p><p className="mt-2 text-xs text-slate-700">{item.queued} antrean · {item.processing} diproses · {item.sent} diterima penyedia · {item.delivered} dikonfirmasi sampai · {item.failed} gagal/bounce · {item.cancelled} batal</p><p className="mt-1 text-xs text-slate-600">Uji: {item.testSent} diterima, {item.testFailed} gagal{item.lastTestAt ? ` · terakhir ${formatTime(item.lastTestAt)}` : ""}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void sendTest({ campaignId: item.campaignId })} disabled={!testEmail.trim() || Boolean(busy)} className="min-h-11 rounded-lg border border-emerald-700 px-3 text-sm font-bold text-emerald-800 disabled:opacity-50">Uji kampanye</button><button type="button" onClick={() => { if (expandedCampaign === item.campaignId) { setExpandedCampaign(""); setCampaignJobs(null); } else void loadCampaignJobs(item.campaignId, 1, "ALL"); }} disabled={Boolean(busy)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-bold disabled:opacity-50">{expandedCampaign === item.campaignId ? "Tutup detail" : "Lihat penerima"}</button>{item.queued > 0 && <button type="button" onClick={() => void cancelCampaign(item.campaignId)} disabled={Boolean(busy)} className="min-h-11 rounded-lg border border-rose-300 px-3 text-sm font-bold text-rose-800 disabled:opacity-50">Batalkan antrean</button>}</div></div>
        {expandedCampaign === item.campaignId && <div className="mt-4 rounded-lg bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><label className="text-xs font-bold">Filter status <select value={campaignFilter} onChange={(event) => void loadCampaignJobs(item.campaignId, 1, event.target.value)} className="ml-2 min-h-10 rounded border border-slate-300 bg-white px-2">{["ALL", "QUEUED", "PROCESSING", "SENT", "FAILED", "CANCELLED"].map((value) => <option key={value} value={value}>{value === "ALL" ? "Semua" : value === "SENT" ? "Diterima penyedia" : value === "QUEUED" ? "Antrean" : value === "FAILED" ? "Gagal" : value === "CANCELLED" ? "Batal" : "Diproses"}</option>)}</select></label><span className="text-xs text-slate-600">{campaignJobs?.total ?? "—"} penerima</span></div>{campaignJobs && <><ul className="mt-3 max-h-80 divide-y divide-slate-200 overflow-y-auto">{campaignJobs.items.map((job) => <li key={job.id} className="py-2 text-xs"><strong className="break-all">{job.recipientName ? `${job.recipientName} · ` : ""}{job.recipientEmail}</strong><p className="text-slate-600">{job.status} {job.deliveryStatus ? `· ${job.deliveryStatus} (${job.provider})` : ""} · Jadwal {formatTime(job.scheduledAt)}{job.lastError ? ` · ${job.lastError}` : ""}</p></li>)}</ul>{campaignJobs.items.length === 0 && <p className="mt-3 text-xs text-slate-600">Tidak ada penerima pada status ini.</p>}<div className="mt-3 flex items-center gap-3 text-xs"><button type="button" disabled={Boolean(busy) || campaignJobs.page <= 1} onClick={() => void loadCampaignJobs(item.campaignId, campaignJobs.page - 1)} className="min-h-10 rounded border border-slate-300 px-3 disabled:opacity-50">Sebelumnya</button>Halaman {campaignJobs.page}<button type="button" disabled={Boolean(busy) || campaignJobs.page * campaignJobs.pageSize >= campaignJobs.total} onClick={() => void loadCampaignJobs(item.campaignId, campaignJobs.page + 1)} className="min-h-10 rounded border border-slate-300 px-3 disabled:opacity-50">Berikutnya</button></div></>}</div>}
        </li>)}</ul>}
      </section>
      </>}

      {mode === "queue" && <>
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
            <div className="min-w-0"><p className="break-all text-sm font-black text-slate-950">{job.recipientName ? `${job.recipientName} · ` : ""}{job.recipientEmail}</p>{(job.templateName || job.subject) && <p className="mt-1 text-xs font-bold text-emerald-800">{job.templateName || job.subject}</p>}<p className="mt-1 text-xs text-slate-600">Jadwal {formatTime(job.scheduledAt)} · Dibuat {formatTime(job.createdAt)} · Percobaan {job.attemptCount}/{job.maxAttempts}</p>{job.lastError && <p className="mt-2 max-w-3xl break-words text-xs text-rose-700">{job.lastError}</p>}</div>
            <div className="flex shrink-0 items-center gap-3"><StatusBadge label={job.status.replaceAll("_", " ")} variant={statusTone(job.status)} />{(job.status === "FAILED" || job.status === "DEAD_LETTER") && <button type="button" onClick={() => void retry(job.id)} disabled={Boolean(busy)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-800 disabled:opacity-50"><RotateCcw className="h-4 w-4" /> Coba ulang</button>}</div>
          </li>)}</ul>}
      </section>
       <p className="mt-4 text-sm text-slate-600">Tindakan pengiriman dan percobaan ulang tercatat di <Link to="/admin/audit-logs" className="font-bold text-emerald-800 underline">audit sistem</Link>.</p>
      </>}
      </>}
    </AdminLayout>
  );
};
