/* Hallmark · macrostructure: Poster-Led Wayfinding · theme: existing emerald-slate
 * enrichment: generated faceless library interior · motion: image reveal + control feedback
 */
import React, { useState } from "react";
import { CalendarClock, CalendarDays, Image, MapPin, Save, Settings2 } from "lucide-react";
import { EventPosterField } from "./EventPosterField";
import { DEFAULT_EVENT_POSTER } from "@/lib/eventPoster";

export type EventFormValues = {
  code: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  posterUrl: string;
  posterAlt: string;
  posterFocalPoint: string;
  audienceMode: string;
  attendanceMode: string;
  timezone: string;
  startDate: string;
  endDate: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  invitationResponseDeadline: string;
  attendanceConfirmationDeadline: string;
  attendanceConfirmationRequired: boolean;
  lateConfirmationPolicy: string;
  venueName: string;
  venueAddress: string;
  mapsUrl: string;
  defaultInstitutionQuota: string;
  capacity: string;
};

const emptyValues: EventFormValues = {
  code: "",
  slug: "",
  name: "",
  subtitle: "",
  description: "",
  posterUrl: DEFAULT_EVENT_POSTER,
  posterAlt: "Interior perpustakaan sebagai poster event daurah",
  posterFocalPoint: "CENTER",
  audienceMode: "INSTITUTION_INVITATION",
  attendanceMode: "DAILY_AND_SESSION",
  timezone: "Asia/Jakarta",
  startDate: "",
  endDate: "",
  registrationOpenAt: "",
  registrationCloseAt: "",
  invitationResponseDeadline: "",
  attendanceConfirmationDeadline: "",
  attendanceConfirmationRequired: true,
  lateConfirmationPolicy: "BLOCK",
  venueName: "",
  venueAddress: "",
  mapsUrl: "",
  defaultInstitutionQuota: "2",
  capacity: "",
};

type Props = {
  initialValues?: Partial<EventFormValues>;
  submitting?: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (values: EventFormValues) => Promise<void>;
  lockIdentity?: boolean;
};

const fieldClass = "min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-2 outline-transparent hover:border-slate-400 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60";

export const EventForm: React.FC<Props> = ({ initialValues, submitting, submitLabel, onCancel, onSubmit, lockIdentity }) => {
  const [values, setValues] = useState<EventFormValues>({ ...emptyValues, ...initialValues });

  const update = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "name" && typeof value === "string" && !lockIdentity && (!current.slug || current.slug === current.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))) {
        next.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit(values);
  };

  return (
    <form onSubmit={submit} className="event-form-shell max-w-6xl space-y-5">
      <nav aria-label="Bagian formulir event" className={`event-form-section-nav ${lockIdentity ? "top-32" : "top-16"}`}>
        {[
          ["identity", "Identitas", CalendarDays],
          ["poster", "Poster", Image],
          ["deadlines", "Konfirmasi", CalendarClock],
          ["configuration", "Jadwal & jalur", Settings2],
          ["location", "Lokasi", MapPin],
        ].map(([target, label, Icon]) => {
          const SectionIcon = Icon as React.ComponentType<{ className?: string }>;
          return (
            <a key={String(target)} href={`#${target}`} className="event-form-section-nav__item">
              <SectionIcon className="h-4 w-4" />
              {String(label)}
            </a>
          );
        })}
      </nav>

      <section id="identity" className="scroll-mt-28 border border-slate-200 bg-white">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 p-4">
          <CalendarDays className="h-4 w-4 text-emerald-700" />
          <div><h2 className="text-base font-black text-slate-900">Identitas event</h2><p className="mt-1 text-sm text-slate-600">Nama, kode, halaman publik, dan informasi utama.</p></div>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Kode event *</span><input value={values.code} onChange={(event) => update("code", event.target.value.toUpperCase())} disabled={lockIdentity} required placeholder="DAURAH-2026-BDG" className={fieldClass} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-700">Slug halaman publik *</span><input value={values.slug} onChange={(event) => update("slug", event.target.value)} disabled={lockIdentity} required placeholder="daurah-asatidz-bandung" className={fieldClass} /></label>
          <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">Nama event *</span><input value={values.name} onChange={(event) => update("name", event.target.value)} required className={fieldClass} /></label>
          <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">Subjudul</span><input value={values.subtitle} onChange={(event) => update("subtitle", event.target.value)} className={fieldClass} /></label>
          <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">Deskripsi</span><textarea value={values.description} onChange={(event) => update("description", event.target.value)} rows={4} className={`${fieldClass} min-h-28 py-3`} /></label>
        </div>
      </section>

      <EventPosterField
        source={values.posterUrl}
        altText={values.posterAlt}
        focalPoint={values.posterFocalPoint}
        eventName={values.name}
        onSourceChange={(value) => update("posterUrl", value)}
        onAltTextChange={(value) => update("posterAlt", value)}
        onFocalPointChange={(value) => update("posterFocalPoint", value)}
      />

      <section id="deadlines" className="scroll-mt-28 border border-slate-200 bg-white">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 p-4">
          <CalendarClock className="h-4 w-4 text-emerald-700" />
          <div><h2 className="text-sm font-black text-slate-900">Batas konfirmasi dan kebijakan terlambat</h2><p className="mt-1 text-xs text-slate-500">Tenggat ini menjadi acuan undangan, peserta, dan kelayakan check-in.</p></div>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Pendaftaran dibuka</span><input type="datetime-local" value={values.registrationOpenAt} onChange={(event) => update("registrationOpenAt", event.target.value)} className={fieldClass} /></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Pendaftaran ditutup</span><input type="datetime-local" value={values.registrationCloseAt} onChange={(event) => update("registrationCloseAt", event.target.value)} className={fieldClass} /></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Batas respons undangan</span><input type="datetime-local" value={values.invitationResponseDeadline} onChange={(event) => update("invitationResponseDeadline", event.target.value)} className={fieldClass} /><span className="mt-1 block text-xs text-slate-500">Digunakan otomatis jika undangan tidak memiliki tenggat khusus.</span></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Batas konfirmasi kehadiran</span><input type="datetime-local" value={values.attendanceConfirmationDeadline} onChange={(event) => update("attendanceConfirmationDeadline", event.target.value)} className={fieldClass} /><span className="mt-1 block text-xs text-slate-500">Peserta yang belum konfirmasi akan ditahan dari check-in.</span></label>
          <label><span className="mb-1.5 block text-sm font-bold text-slate-700">Jika konfirmasi terlambat</span><select value={values.lateConfirmationPolicy} onChange={(event) => update("lateConfirmationPolicy", event.target.value)} className={fieldClass}><option value="BLOCK">Tolak dan arahkan ke panitia</option><option value="REVIEW">Terima untuk ditinjau panitia</option><option value="ALLOW">Terima otomatis</option></select></label>
          <label className="flex min-h-[48px] items-center gap-3 self-end border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
            <input type="checkbox" checked={values.attendanceConfirmationRequired} onChange={(event) => update("attendanceConfirmationRequired", event.target.checked)} className="h-4 w-4 accent-emerald-700" />
            Wajib konfirmasi sebelum check-in
          </label>
        </div>
      </section>

      <section id="configuration" className="scroll-mt-28 border border-slate-200 bg-white">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 p-4">
          <Settings2 className="h-4 w-4 text-emerald-700" />
          <div><h2 className="text-base font-black text-slate-900">Periode dan konfigurasi</h2><p className="mt-1 text-sm text-slate-600">Tentukan jadwal, jalur peserta, dan model presensi.</p></div>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label><span className="mb-1.5 block text-xs font-bold text-slate-700">Tanggal mulai *</span><input type="date" value={values.startDate} onChange={(event) => update("startDate", event.target.value)} required className={fieldClass} /></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-700">Tanggal selesai *</span><input type="date" value={values.endDate} min={values.startDate} onChange={(event) => update("endDate", event.target.value)} required className={fieldClass} /></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-700">Zona waktu *</span><select value={values.timezone} onChange={(event) => update("timezone", event.target.value)} className={fieldClass}><option value="Asia/Jakarta">WIB · Asia/Jakarta</option><option value="Asia/Makassar">WITA · Asia/Makassar</option><option value="Asia/Jayapura">WIT · Asia/Jayapura</option></select></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-700">Jalur peserta</span><select value={values.audienceMode} onChange={(event) => update("audienceMode", event.target.value)} className={fieldClass}><option value="INSTITUTION_INVITATION">Undangan lembaga</option><option value="INDIVIDUAL_INVITATION">Undangan individu</option><option value="PUBLIC_OPEN">Pendaftaran terbuka</option></select></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-700">Mode presensi</span><select value={values.attendanceMode} onChange={(event) => update("attendanceMode", event.target.value)} className={fieldClass}><option value="DAILY_AND_SESSION">Harian dan per sesi</option><option value="DAILY_ONLY">Harian saja</option><option value="SESSION_ONLY">Per sesi saja</option></select></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-700">Kapasitas</span><input type="number" min="1" value={values.capacity} onChange={(event) => update("capacity", event.target.value)} placeholder="Tidak dibatasi" className={fieldClass} /></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-700">Quota default lembaga</span><input type="number" min="1" value={values.defaultInstitutionQuota} onChange={(event) => update("defaultInstitutionQuota", event.target.value)} className={fieldClass} /></label>
        </div>
      </section>

      <section id="location" className="scroll-mt-28 border border-slate-200 bg-white">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 p-4">
          <MapPin className="h-4 w-4 text-emerald-700" />
          <div><h2 className="text-base font-black text-slate-900">Lokasi kegiatan</h2><p className="mt-1 text-sm text-slate-600">Informasi yang akan dilihat peserta dan lembaga.</p></div>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <label><span className="mb-1.5 block text-xs font-bold text-slate-700">Nama tempat</span><input value={values.venueName} onChange={(event) => update("venueName", event.target.value)} className={fieldClass} /></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-700">Google Maps URL</span><input type="url" value={values.mapsUrl} onChange={(event) => update("mapsUrl", event.target.value)} className={fieldClass} /></label>
          <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold text-slate-700">Alamat lengkap</span><textarea value={values.venueAddress} onChange={(event) => update("venueAddress", event.target.value)} rows={3} className={`${fieldClass} min-h-24 py-3`} /></label>
        </div>
      </section>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/95 py-3 backdrop-blur-sm">
        <button type="button" onClick={onCancel} className="min-h-[44px] whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 active:bg-slate-200">Batal</button>
        <button type="submit" disabled={submitting} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-4 text-xs font-black text-white hover:bg-emerald-800 active:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" />{submitting ? "Menyimpan…" : submitLabel}</button>
      </div>
    </form>
  );
};
