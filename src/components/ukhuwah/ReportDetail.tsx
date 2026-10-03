import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { categoryLabels, publicationLabels, regionLabel, workStatusLabels, type UkhuwahReport } from "@/lib/ukhuwah";
import { ReportEditor } from "./ReportEditor";
import { api, button, card, field, Label, messageOf, Notice, primary, ResourceState, TextBody, useDirtyGuard, useResource } from "./ui";

function AdminActions({ report, onChanged }: { report: UkhuwahReport; onChanged: () => void }) {
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | "HIDDEN">(report.isOwner ? "REJECTED" : "APPROVED");
  const [reason, setReason] = useState("");
  const [followup, setFollowup] = useState({ workStatus: report.workStatus, followupSummary: report.followupSummary ?? "", coordinatorName: report.coordinatorName ?? "", dueDate: report.dueDate?.slice(0, 10) ?? "" });
  const [busy, setBusy] = useState(false); const pending = useRef(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const baseline = JSON.stringify({ workStatus: report.workStatus, followupSummary: report.followupSummary ?? "", coordinatorName: report.coordinatorName ?? "", dueDate: report.dueDate?.slice(0, 10) ?? "" });
  useDirtyGuard(!!reason || JSON.stringify(followup) !== baseline, busy);
  async function act(action: "moderate" | "followup") {
    if (pending.current) return;
    if (action === "moderate" && !reason.trim()) { setError("Alasan keputusan moderasi wajib diisi, termasuk persetujuan."); return; }
    const otherChanges = action === "moderate" ? JSON.stringify(followup) !== baseline : !!reason.trim();
    if (otherChanges && !window.confirm("Bagian lain memiliki perubahan belum disimpan. Simpan tindakan ini dan buang perubahan pada bagian lain?")) return;
    pending.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await api<UkhuwahReport>(`/admin/ukhuwah/reports/${report.id}/${action}`, { method: action === "moderate" ? "POST" : "PATCH", body: JSON.stringify({ ...(action === "moderate" ? { decision, reason: reason.trim() } : { ...followup, dueDate: followup.dueDate || null }), expectedVersion: report.version }) });
      setReason(""); setMessage(action === "moderate" ? "Keputusan moderasi tersimpan." : "Tindak lanjut tersimpan."); onChanged();
    } catch (e) { setError(`${messageOf(e)} Muat ulang detail bila revisi telah berubah.`); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className={`${card} space-y-5`} aria-label="Pengelolaan laporan">
    {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
    <fieldset disabled={busy} className="space-y-4"><legend className="text-lg font-bold">Moderasi eksplisit</legend>
      <p className="text-sm text-slate-600">Persetujuan publikasi bukan verifikasi kebenaran atau penyelesaian. Laporan khusus pengelola tidak berubah menjadi bersama saat disetujui.</p>
      {report.isOwner && <Notice>Laporan sendiri harus disetujui oleh pengelola lain; tidak dapat menyetujui publikasi sendiri.</Notice>}
      <Label name="Keputusan"><select className={field} value={decision} onChange={e => setDecision(e.target.value as typeof decision)}>{!report.isOwner && <option value="APPROVED">Setujui</option>}<option value="REJECTED">Minta koreksi / tolak</option><option value="HIDDEN">Sembunyikan dari papan</option></select></Label>
      <Label name="Alasan moderasi (wajib)"><textarea id="ukhuwah-moderationReason" className={field} maxLength={2000} rows={3} value={reason} onChange={e => setReason(e.target.value)} /></Label><button className={primary} onClick={() => act("moderate")} disabled={!reason.trim()}>Simpan keputusan moderasi</button>
    </fieldset>
    <fieldset disabled={busy} className="space-y-4 border-t pt-5"><legend className="text-lg font-bold">Tindak lanjut</legend>
      <Label name="Status pekerjaan"><select className={field} value={followup.workStatus} onChange={e => setFollowup(f => ({ ...f, workStatus: e.target.value as UkhuwahReport["workStatus"] }))}>{Object.entries(workStatusLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></Label>
      <Label name="Koordinator"><input id="ukhuwah-coordinatorName" className={field} maxLength={200} value={followup.coordinatorName} onChange={e => setFollowup(f => ({ ...f, coordinatorName: e.target.value }))} /></Label>
      <Label name="Tenggat"><input id="ukhuwah-dueDate" className={field} type="date" value={followup.dueDate} onChange={e => setFollowup(f => ({ ...f, dueDate: e.target.value }))} /></Label>
      <Label name="Ringkasan tindak lanjut"><textarea id="ukhuwah-followupSummary" className={field} maxLength={4000} rows={4} value={followup.followupSummary} onChange={e => setFollowup(f => ({ ...f, followupSummary: e.target.value }))} /></Label>
      <p className="text-sm text-amber-900">Ringkasan ini terlihat oleh anggota bila laporan bersama telah disetujui. Jangan masukkan catatan internal, identitas sensitif, atau nomor pribadi.</p><button className={primary} disabled={JSON.stringify(followup) === baseline} onClick={() => act("followup")}>Simpan tindak lanjut</button>
    </fieldset>
  </section>;
}

export function ReportDetail({ id, prefix, root, admin }: { id: string; prefix: string; root: string; admin: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const resource = useResource<UkhuwahReport>(`${prefix}/reports/${encodeURIComponent(id)}`, refresh);
  const [mode, setMode] = useState<"view" | "edit" | "duplicate">("view");
  const report = resource.data;
  return <div className="space-y-5"><Link className={button} to={`${root}/laporan`}>Kembali ke laporan</Link><ResourceState resource={resource} />
    {report && <>
      <article className={`${card} space-y-4`} aria-label="Detail laporan"><div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded bg-slate-100 px-3 py-1">{publicationLabels[report.publicationStatus]}</span><span className="rounded bg-emerald-50 px-3 py-1">{workStatusLabels[report.workStatus]}</span><span className="rounded bg-amber-50 px-3 py-1">{report.audience === "ADMIN_ONLY" ? "Khusus penulis dan pengelola" : "Bersama"}</span></div><h2 className="text-2xl font-bold break-words">{report.title}</h2><p className="text-sm text-slate-600">{regionLabel(report.cityCode)}{report.district ? ` · ${report.district}` : ""} · {categoryLabels[report.category]}</p><p className="text-sm">Pengamatan: {report.observedAt.slice(0, 10)} · Penulis: {report.hideAuthor && !admin && !report.isOwner ? "Disembunyikan" : report.authorName || "Disembunyikan"} · Revisi {report.version}</p><TextBody>{report.body}</TextBody><div className="border-t pt-4"><h3 className="font-semibold">Sumber dan keterbatasan</h3><TextBody>{report.source}</TextBody></div>
        {(admin || report.isOwner) && report.moderationReason && <Notice>Alasan moderasi: {report.moderationReason}</Notice>}
        {report.followupSummary && <section className="rounded-lg bg-emerald-50 p-4 space-y-2"><h3 className="font-bold">Tindak lanjut</h3><TextBody>{report.followupSummary}</TextBody>{report.coordinatorName && <p className="text-sm">Koordinator: {report.coordinatorName}</p>}{report.dueDate && <p className="text-sm">Tenggat: {report.dueDate.slice(0, 10)}</p>}</section>}
        <div className="flex flex-wrap gap-3">{report.isOwner && <button data-ukhuwah-navigation className={button} disabled={report.publicationStatus === "PENDING" || mode === "edit"} onClick={() => setMode("edit")}>Edit laporan saya</button>}<button data-ukhuwah-navigation className={button} disabled={mode === "duplicate"} onClick={() => setMode("duplicate")}>Duplikat sebagai draf baru</button><button data-ukhuwah-navigation className={button} onClick={resource.retry}>Muat ulang detail</button>{mode !== "view" && <button data-ukhuwah-navigation className={button} onClick={() => setMode("view")}>Tutup editor laporan</button>}</div>
      </article>
      {mode === "edit" && report.isOwner && <ReportEditor key={`edit:${report.id}:${report.version}`} prefix={prefix} report={report} />}
      {mode === "duplicate" && <ReportEditor key={`copy:${report.id}`} prefix={prefix} report={report} duplicate />}
      {admin && mode === "view" && <AdminActions key={`actions:${report.id}:${report.version}`} report={report} onChanged={() => setRefresh(n => n + 1)} />}
    </>}
  </div>;
}