import { useEffect, useId, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { eventApi } from "@/lib/eventApi";
import type { ManualAttendancePolicy } from "@/lib/attendance";
import "@/styles/attendance-workspace.css";

export function ManualAttendancePolicyPanel({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const path = `/events/${encodeURIComponent(eventId)}/attendance/policy`;
  const hintId = useId();
  const { hash } = useLocation();
  const [policy, setPolicy] = useState<ManualAttendancePolicy | null>(null);
  const [allow, setAllow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (hash === "#presensi-manual") document.getElementById("presensi-manual")?.scrollIntoView();
  }, [hash]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void eventApi<ManualAttendancePolicy>(path, { signal: controller.signal, cache: "no-store" }).then((data) => {
      if (!controller.signal.aborted) {
        setPolicy(data);
        setAllow(data.allowUnconfirmedManual);
      }
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Kebijakan presensi gagal dimuat.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, attempt]);

  const editable = Boolean(canManage && policy?.editable && policy.available);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editable || saving || allow === policy?.allowUnconfirmedManual) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await eventApi<ManualAttendancePolicy>(path, { method: "PATCH", body: JSON.stringify({ allowUnconfirmedManual: allow }) });
      setPolicy(saved);
      setAllow(saved.allowUnconfirmedManual);
      setNotice("Pengaturan presensi disimpan.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pengaturan presensi gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  return <section id="presensi-manual" className="attendance-panel mb-5 scroll-mt-24" aria-labelledby="manual-attendance-title">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="manual-attendance-title" className="inline-flex items-center gap-2">
        <ClipboardCheck size={20} className="shrink-0 text-emerald-800" aria-hidden="true" />Presensi manual
      </h2>
      {policy?.available && <StatusBadge label={policy.allowUnconfirmedManual ? "Aktif" : "Nonaktif"}
        variant={policy.allowUnconfirmedManual ? "success" : "neutral"} />}
    </header>
    {error && <div className="attendance-feedback" data-tone="error" role="alert">{error}</div>}
    {notice && <div className="attendance-feedback" data-tone="success" role="status">{notice}</div>}
    {loading ? <p role="status">Memuat pengaturan presensi…</p> : policy ? <form onSubmit={(event) => void save(event)} className="grid gap-3">
      <label className="manual-attendance-choice">
        <input type="checkbox" checked={allow} disabled={!editable || saving} aria-describedby={hintId}
          onChange={(event) => { setAllow(event.target.checked); setNotice(""); setError(""); }} />
        <span>Izinkan catat manual untuk peserta belum konfirmasi</span>
      </label>
      <p id={hintId}>{!policy.available ? "Pengaturan ini tersedia setelah migrasi database."
        : !policy.editable ? "Pengaturan event ini sudah ditutup."
        : !canManage ? "Pengelola event dapat mengubah pengaturan ini."
        : !policy.confirmationRequired ? "Konfirmasi di event ini opsional. Pengecualian berlaku saat konfirmasi diwajibkan."
        : "Berlaku untuk peserta disetujui melalui kode, pencarian peserta, atau rapor."}</p>
      {editable && <div className="attendance-actions"><button type="submit" data-primary className="attendance-control"
        disabled={saving || allow === policy.allowUnconfirmedManual}>{saving ? "Menyimpan…" : "Simpan pengaturan presensi"}</button></div>}
    </form> : <div className="attendance-actions"><button type="button" className="attendance-control"
      onClick={() => setAttempt((value) => value + 1)}>Muat ulang</button></div>}
  </section>;
}
