/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 * genre: modern-minimal · macrostructure: Workbench · theme: existing emerald-slate
 */
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Copy, ExternalLink, FlaskConical, LockKeyhole, MonitorUp, Plus, RefreshCw, ShieldOff } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { EventWorkspaceNav } from "@/components/admin/events/EventWorkspaceNav";
import { PageHeader } from "@/components/common/PageHeader";
import { eventApi } from "@/lib/eventApi";
import { eventTimezoneLabel, formatEventDateTime } from "@/lib/eventDateTime";

type EventInfo = { id: string; name: string; code: string; slug: string; status: string; timezone: string;
  attendanceSetup?: { remainingQrUnitCount: number; manualUnitCount: number } };
type Device = { id: string; label: string; pairingExpiresAt: string; deviceExpiresAt: string | null;
  pairedAt: string | null; revokedAt: string | null; createdAt: string };
type Pairing = { id: string; slug: string; pairingToken: string; pairingExpiresAt: string };

export const EventKioskPage: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [label, setLabel] = useState("");
  const [pairingUrl, setPairingUrl] = useState("");
  const [pairingExpiresAt, setPairingExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pairingAllowed = Boolean(event && ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING"].includes(event.status) && event.attendanceSetup?.remainingQrUnitCount);
  const dateLabel = (value: string) => `${formatEventDateTime(value, event?.timezone || "Asia/Jakarta")} ${eventTimezoneLabel(event?.timezone || "Asia/Jakarta")}`;

  const load = async () => {
    try {
      const [eventInfo, items] = await Promise.all([
        eventApi<EventInfo>(`/events/${id}?view=attendance-setup`), eventApi<Device[]>(`/events/${id}/kiosk`),
      ]);
      setEvent(eventInfo); setDevices(items); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pengaturan kiosk gagal dimuat."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [id]);

  const create = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    if (!pairingAllowed || busy) return;
    if (label.trim().length < 2) { setError("Nama perangkat minimal 2 karakter."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const created = await eventApi<Pairing>(`/events/${id}/kiosk/pairings`, {
        method: "POST", body: JSON.stringify({ label: label.trim() }),
      });
      setPairingUrl(`${window.location.origin}/check-in/${created.slug}#pair=${created.pairingToken}`);
      setPairingExpiresAt(created.pairingExpiresAt);
      setLabel("");
      setNotice("Tautan aktivasi dibuat. Buka pada perangkat kiosk dalam 10 menit; tautan hanya bisa dipakai sekali.");
      const items = await eventApi<Device[]>(`/events/${id}/kiosk`); setDevices(items);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Tautan aktivasi gagal dibuat."); }
    finally { setBusy(false); }
  };

  const revoke = async (device: Device) => {
    if (!window.confirm(`Cabut akses perangkat “${device.label}”? Scan berikutnya akan ditolak.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await eventApi(`/events/${id}/kiosk/${device.id}/revoke`, { method: "POST" });
      setDevices((current) => current.map((item) => item.id === device.id ? { ...item, revokedAt: new Date().toISOString() } : item));
      setNotice(`Akses ${device.label} telah dicabut.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Akses gagal dicabut."); }
    finally { setBusy(false); }
  };

  const kioskUrl = event ? `${window.location.origin}/check-in/${event.slug}` : "";
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setNotice("Tautan disalin."); }
    catch { setError("Gagal menyalin otomatis. Salin tautan dari kolom yang tersedia."); }
  };

  return <AdminLayout>
    <PageHeader title="Kiosk QR" description={event ? `${event.name} · ${event.code}` : "Perangkat pemindai QR di lokasi acara"}
      breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event", href: "/admin/events" },
        { label: event?.code || "Event", href: `/admin/events/${id}` }, { label: "Kiosk QR" }]} />
    <EventWorkspaceNav eventId={id} />
    {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{notice}</p>}
    {loading ? <p className="p-6 text-slate-600">Memuat perangkat kiosk…</p> : event && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-5">
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6" aria-labelledby="rehearsal-title">
          <div className="flex items-start gap-3"><FlaskConical className="mt-1 h-6 w-6 shrink-0 text-emerald-800" aria-hidden="true" /><div>
            <h2 id="rehearsal-title" className="text-xl font-black text-emerald-950">Uji scanner sebelum acara</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-950">Pilih hari atau sesi, buat QR contoh, lalu coba kamera atau pemindai USB. Bisa dilakukan di luar jadwal tanpa mencatat kehadiran, mengubah peserta, atau mengirim email.</p>
          </div></div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to={`/committee/check-in?eventId=${encodeURIComponent(id)}&mode=test`} className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-800 px-4 font-bold text-white hover:bg-emerald-900 active:bg-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><FlaskConical className="h-5 w-5" aria-hidden="true" />Uji scanner panitia</Link>
            <a href={event ? `/check-in/${event.slug}?mode=test` : undefined} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-emerald-300 bg-white px-4 font-bold text-emerald-900 hover:bg-emerald-100 active:bg-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><ExternalLink className="h-5 w-5" aria-hidden="true" />Uji kiosk</a>
          </div>
          <p className="mt-3 text-sm leading-6 text-emerald-900">Kiosk tetap perlu diaktifkan di perangkat tersebut. Hasil uji tidak masuk rekap atau rapor; QR contoh tidak berlaku untuk absensi resmi.</p>
        </section>
        <section className="border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start gap-3"><MonitorUp className="mt-1 h-6 w-6 text-emerald-800" /><div>
            <h2 className="text-xl font-black text-slate-900">Aktifkan perangkat di lokasi</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Buat tautan untuk satu perangkat, lalu buka tautan itu pada browser kiosk. Setelah aktif, petugas dapat memindai tanpa login.</p>
          </div></div>
          <form onSubmit={(event) => void create(event)} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm font-bold text-slate-800">Nama perangkat
              <input value={label} onChange={(change) => setLabel(change.target.value)} maxLength={60} required placeholder="Contoh: Meja registrasi utama"
                className="mt-2 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base font-normal outline-2 outline-transparent focus-visible:outline-emerald-700" />
            </label>
            <button type="submit" disabled={busy || !pairingAllowed || label.trim().length < 2} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-5 font-bold text-white disabled:opacity-50"><Plus className="h-5 w-5" />{busy ? "Menyiapkan…" : "Buat tautan aktivasi"}</button>
          </form>
          {!pairingAllowed && <p className="mt-3 text-sm text-slate-700">Kiosk memerlukan event yang sudah terbit dan jadwal QR yang belum berakhir. <Link to={`/admin/events/${id}/schedule`} className="inline-flex min-h-11 items-center font-bold text-emerald-800 underline">Periksa jadwal</Link></p>}
          {pairingUrl && <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 font-bold text-amber-950"><LockKeyhole className="h-5 w-5" /> Tautan satu kali · berlaku sampai {dateLabel(pairingExpiresAt)}</p>
            <label className="mt-3 block text-sm font-semibold text-slate-800">Salin sekarang; tautan tidak ditampilkan lagi setelah halaman ditutup.
              <input readOnly value={pairingUrl} onFocus={(event) => event.target.select()} className="mt-2 min-h-12 w-full rounded-lg border border-amber-300 bg-white px-3 font-mono text-sm" />
            </label>
            <button type="button" onClick={() => void copy(pairingUrl)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-400 px-4 font-bold text-amber-950"><Copy className="h-4 w-4" /> Salin tautan aktivasi</button>
          </div>}
        </section>
        <section className="border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black text-slate-900">Perangkat event</h2>
            <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold"><RefreshCw className="h-4 w-4" /> Perbarui</button></div>
          {devices.length ? <ul className="mt-4 divide-y divide-slate-200">{devices.map((device) => {
            const status = device.revokedAt ? "Dicabut" : device.pairedAt && device.deviceExpiresAt && new Date(device.deviceExpiresAt) > new Date() ? "Aktif"
              : device.pairedAt ? "Kedaluwarsa" : new Date(device.pairingExpiresAt) > new Date() ? "Menunggu aktivasi" : "Tautan kedaluwarsa";
            return <li key={device.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div>
              <strong className="text-base text-slate-900">{device.label}</strong>
              <p className="mt-1 text-sm text-slate-600">{status === "Aktif" && !pairingAllowed ? "Terpasang · gate tidak tersedia" : status} · {device.pairedAt ? `Diaktifkan ${dateLabel(device.pairedAt)}` : `Dibuat ${dateLabel(device.createdAt)}`}</p>
            </div>{!device.revokedAt && <button type="button" disabled={busy} onClick={() => void revoke(device)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-200 px-3 text-sm font-bold text-rose-800 disabled:opacity-50"><ShieldOff className="h-4 w-4" /> Cabut akses</button>}</li>;
          })}</ul> : <p className="mt-4 text-sm text-slate-600">Belum ada perangkat. Buat tautan aktivasi untuk memulai.</p>}
        </section>
      </div>
      <aside className="space-y-4">
        <section className="border border-slate-200 bg-white p-5"><h2 className="text-base font-black text-slate-900">Shortcut kiosk</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Simpan alamat ini sebagai bookmark pada perangkat yang sudah diaktifkan.</p>
          <input readOnly value={kioskUrl} onFocus={(event) => event.target.select()} aria-label="Alamat kiosk event" className="mt-3 min-h-12 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm" />
          <button type="button" onClick={() => void copy(kioskUrl)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold"><Copy className="h-4 w-4" /> Salin shortcut</button>
          <a href={kioskUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 px-1 text-sm font-bold text-emerald-800">Buka halaman kiosk <ExternalLink className="h-4 w-4" /></a>
        </section>
        <section className="border border-emerald-200 bg-emerald-50 p-5"><CheckCircle2 className="h-6 w-6 text-emerald-800" />
          <h2 className="mt-2 font-black text-emerald-950">QR pribadi saja</h2>
          <p className="mt-2 text-sm leading-6 text-emerald-950">Kiosk tidak menampilkan identitas peserta dan tidak menerima kode manual. Pencarian ada di Scanner Peserta; koreksi dilakukan melalui rapor sesuai izin.</p>
          <Link to={`/admin/events/${id}/attendance`} className="mt-3 inline-flex min-h-11 items-center font-bold text-emerald-900 underline underline-offset-4">Lihat laporan kehadiran</Link>
        </section>
        <section className="border border-slate-200 bg-white p-5"><h2 className="text-base font-black text-slate-900">Perangkat panitia</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Gunakan scanner untuk QR pribadi atau tampilkan QR Lokasi agar asatidz dapat check-in mandiri.</p>
          <Link to={`/committee/check-in?eventId=${id}`} className="inline-flex min-h-11 items-center font-bold text-emerald-900 underline underline-offset-4">Buka scanner peserta</Link>
          <Link to={`/committee/location-qr?eventId=${id}`} className="inline-flex min-h-11 items-center font-bold text-emerald-900 underline underline-offset-4">Buka QR Lokasi</Link>
        </section>
      </aside>
    </div>}
  </AdminLayout>;
};
