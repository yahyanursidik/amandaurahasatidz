/* Hallmark · pre-emit critique: P5 H4 E4 S5 R5 V4
 * genre: modern-minimal · macrostructure: Workbench · theme: existing emerald-slate
 * enrichment: none · navigation: anchored configuration · motion: control feedback
 */
import React, { useEffect, useState } from "react";
import { CalendarClock, CalendarDays, Image, MapPin, Save, Settings2, Users } from "lucide-react";
import { EventPosterField } from "./EventPosterField";
import { DEFAULT_EVENT_POSTER } from "@/lib/eventPoster";
import { isPublicPanitiaWhatsAppNumber } from "@/lib/eventWhatsApp";
import { eventTimezoneLabel, formatEventDate } from "@/lib/eventDateTime";
import {
  EventConfigurationErrors,
  includesInstitutionInvitation,
  includesInvitationRegistration,
  includesRegularRegistration,
  validateEventConfiguration,
} from "@/lib/eventConfiguration";

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
  publicContactWhatsapp: string;
  mapsUrl: string;
  defaultInstitutionQuota: string;
  capacity: string;
  regularQuota: string;
  invitationQuota: string;
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
  audienceMode: "MIXED",
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
  publicContactWhatsapp: "",
  mapsUrl: "",
  defaultInstitutionQuota: "2",
  capacity: "",
  regularQuota: "",
  invitationQuota: "",
};

type Props = {
  initialValues?: Partial<EventFormValues>;
  submitting?: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (values: EventFormValues) => Promise<void>;
  lockIdentity?: boolean;
  lockAttendance?: boolean;
  lockTimezone?: boolean;
};

const fieldClass = "min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-2 outline-transparent hover:border-slate-400 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60";

export const EventForm: React.FC<Props> = ({ initialValues, submitting, submitLabel, onCancel, onSubmit, lockIdentity, lockAttendance, lockTimezone }) => {
  const [values, setValues] = useState<EventFormValues>({ ...emptyValues, ...initialValues });
  const [configurationErrors, setConfigurationErrors] = useState<EventConfigurationErrors>({});
  const [contactError, setContactError] = useState("");
  const [activeSection, setActiveSection] = useState(() => typeof window === "undefined" ? "identity" : window.location.hash.slice(1) || "identity");

  useEffect(() => {
    const onHashChange = () => setActiveSection(window.location.hash.slice(1) || "identity");
    window.addEventListener("hashchange", onHashChange);
    if (window.location.hash) {
      requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" }));
    }
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const update = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => {
    setConfigurationErrors({});
    if (key === "publicContactWhatsapp") setContactError("");
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
    const errors = validateEventConfiguration(values);
    setConfigurationErrors(errors);
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      document.getElementById(`event-${firstError}`)?.focus();
      return;
    }
    if (!isPublicPanitiaWhatsAppNumber(values.publicContactWhatsapp)) {
      setContactError("Nomor WhatsApp panitia belum valid. Gunakan nomor seluler Indonesia, misalnya 081234567890.");
      document.getElementById("event-public-contact")?.focus();
      return;
    }
    await onSubmit(values);
  };

  const hasRegular = includesRegularRegistration(values.audienceMode);
  const hasInvitation = includesInvitationRegistration(values.audienceMode);
  const hasInstitution = includesInstitutionInvitation(values.audienceMode);
  const audienceOptions = [
    { value: "INSTITUTION_INVITATION", title: "Undangan lembaga", detail: "Perwakilan didaftarkan melalui tautan lembaga." },
    { value: "INDIVIDUAL_INVITATION", title: "Undangan individu", detail: "Tautan khusus untuk tiap asatidz." },
    { value: "PUBLIC_OPEN", title: "Reguler terbuka", detail: "Asatidz mendaftar dari halaman publik." },
    { value: "MIXED", title: "Reguler + undangan", detail: "Dua jalur dengan kuota terpisah." },
  ];
  const dateSummary = values.startDate
    ? `${formatEventDate(values.startDate)}${values.endDate && values.endDate !== values.startDate ? ` – ${formatEventDate(values.endDate)}` : ""}`
    : "Belum diisi";
  const quotaSummary = (value: string, enabled: boolean) => !enabled ? "Tidak digunakan" : value === "" ? "Ikuti kapasitas total" : value === "0" ? "Ditutup" : `${value} kursi`;

  return (
    <form onSubmit={submit} className={`event-form-shell max-w-6xl space-y-5 ${lockIdentity ? "event-form-shell--editing" : ""}`}>
      <nav aria-label="Bagian formulir event" className="event-form-section-nav">
        {[
          ["identity", "Identitas", CalendarDays],
          ["poster", "Poster", Image],
          ["configuration", "Jadwal & jalur", Settings2],
          ["deadlines", "Tenggat", CalendarClock],
          ["location", "Lokasi & kontak", MapPin],
        ].map(([target, label, Icon]) => {
          const SectionIcon = Icon as React.ComponentType<{ className?: string }>;
          return (
            <a key={String(target)} href={`#${target}`} aria-current={activeSection === target ? "location" : undefined} onClick={() => setActiveSection(String(target))} className="event-form-section-nav__item">
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

      <section id="configuration" className="event-form-section border border-slate-200 bg-white">
        <header className="event-form-section__header">
          <Settings2 aria-hidden="true" className="h-5 w-5 text-emerald-700" />
          <div><h2 className="text-lg font-black text-slate-900">Jadwal dan jalur peserta</h2><p className="mt-1 text-sm text-slate-600">Atur periode, cara mendaftar, dan batas kursi.</p></div>
        </header>
        <div className="event-config-layout">
          <div className="event-config-fields">
            <div className="event-config-block">
              <h3>Periode kegiatan</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="event-config-label">Tanggal mulai *</span><input id="event-startDate" type="date" value={values.startDate} disabled={lockAttendance} onChange={(event) => update("startDate", event.target.value)} required className={fieldClass} /></label>
                <label><span className="event-config-label">Tanggal selesai *</span><input id="event-endDate" type="date" value={values.endDate} min={values.startDate} disabled={lockAttendance} onChange={(event) => update("endDate", event.target.value)} required aria-invalid={Boolean(configurationErrors.endDate) || undefined} aria-describedby={configurationErrors.endDate ? "event-endDate-error" : undefined} className={fieldClass} />{configurationErrors.endDate && <span id="event-endDate-error" role="alert" className="event-config-error">{configurationErrors.endDate}</span>}</label>
                <label className="sm:col-span-2"><span className="event-config-label">Zona waktu *</span><select value={values.timezone} disabled={lockTimezone} onChange={(event) => update("timezone", event.target.value)} className={fieldClass}><option value="Asia/Jakarta">WIB · Asia/Jakarta</option><option value="Asia/Makassar">WITA · Asia/Makassar</option><option value="Asia/Jayapura">WIT · Asia/Jayapura</option></select>{lockTimezone && <span className="event-config-hint">Zona waktu terkunci agar jam pada jadwal dan rapor tidak bergeser.</span>}</label>
              </div>
              <p className="event-config-note">Tanggal berjeda boleh digunakan. Hari aktif dan rundown disusun setelah draft tersimpan.</p>
            </div>

            <fieldset className="event-config-block">
              <legend className="event-config-legend">Jalur pendaftaran</legend>
              <div className="event-audience-options">
                {audienceOptions.map((option) => (
                  <label key={option.value} className={`event-audience-option ${values.audienceMode === option.value ? "is-selected" : ""}`}>
                    <input type="radio" name="audienceMode" value={option.value} checked={values.audienceMode === option.value} onChange={() => update("audienceMode", option.value)} />
                    <span><strong>{option.title}</strong><small>{option.detail}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="event-config-block">
              <h3>Kuota dan presensi</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="event-config-label">Kapasitas total</span><input id="event-capacity" type="number" min="1" step="1" value={values.capacity} onChange={(event) => update("capacity", event.target.value)} placeholder="Tanpa batas" aria-invalid={Boolean(configurationErrors.capacity) || undefined} aria-describedby={configurationErrors.capacity ? "event-capacity-error" : "event-capacity-hint"} className={fieldClass} /><span id={configurationErrors.capacity ? "event-capacity-error" : "event-capacity-hint"} role={configurationErrors.capacity ? "alert" : undefined} className={configurationErrors.capacity ? "event-config-error" : "event-config-hint"}>{configurationErrors.capacity || "Kosong = tanpa batas total."}</span></label>
                <label><span className="event-config-label">Mode presensi</span><select value={values.attendanceMode} disabled={lockAttendance} onChange={(event) => update("attendanceMode", event.target.value)} className={fieldClass}><option value="DAILY_AND_SESSION">Per hari dan per sesi</option><option value="DAILY_ONLY">Per hari saja</option><option value="SESSION_ONLY">Per sesi saja</option></select><span className="event-config-hint">{lockAttendance ? "Mode dan tanggal terkunci untuk menjaga jadwal serta riwayat presensi." : "Hari/sesi dibuat di Jadwal setelah menyimpan."}</span></label>
                <label><span className="event-config-label">Kuota reguler {!hasRegular && <em>· tidak aktif</em>}</span><input id="event-regularQuota" type="number" min="0" step="1" value={values.regularQuota} onChange={(event) => update("regularQuota", event.target.value)} placeholder="Ikuti kapasitas" aria-invalid={Boolean(configurationErrors.regularQuota) || undefined} aria-describedby={configurationErrors.regularQuota ? "event-regularQuota-error" : "event-regularQuota-hint"} className={fieldClass} /><span id={configurationErrors.regularQuota ? "event-regularQuota-error" : "event-regularQuota-hint"} role={configurationErrors.regularQuota ? "alert" : undefined} className={configurationErrors.regularQuota ? "event-config-error" : "event-config-hint"}>{configurationErrors.regularQuota || "Kosong = ikut kapasitas; 0 = tutup jalur."}</span></label>
                <label><span className="event-config-label">Kuota undangan {!hasInvitation && <em>· tidak aktif</em>}</span><input id="event-invitationQuota" type="number" min="0" step="1" value={values.invitationQuota} onChange={(event) => update("invitationQuota", event.target.value)} placeholder="Ikuti kapasitas" aria-invalid={Boolean(configurationErrors.invitationQuota) || undefined} aria-describedby={configurationErrors.invitationQuota ? "event-invitationQuota-error" : "event-invitationQuota-hint"} className={fieldClass} /><span id={configurationErrors.invitationQuota ? "event-invitationQuota-error" : "event-invitationQuota-hint"} role={configurationErrors.invitationQuota ? "alert" : undefined} className={configurationErrors.invitationQuota ? "event-config-error" : "event-config-hint"}>{configurationErrors.invitationQuota || "Lembaga dan individu berbagi kuota ini."}</span></label>
                <label className="sm:col-span-2"><span className="event-config-label">Kuota awal per lembaga {!hasInstitution && <em>· tidak aktif</em>}</span><input id="event-defaultInstitutionQuota" type="number" min="1" step="1" value={values.defaultInstitutionQuota} onChange={(event) => update("defaultInstitutionQuota", event.target.value)} aria-invalid={Boolean(configurationErrors.defaultInstitutionQuota) || undefined} aria-describedby={configurationErrors.defaultInstitutionQuota ? "event-defaultInstitutionQuota-error" : "event-defaultInstitutionQuota-hint"} className={fieldClass} /><span id={configurationErrors.defaultInstitutionQuota ? "event-defaultInstitutionQuota-error" : "event-defaultInstitutionQuota-hint"} role={configurationErrors.defaultInstitutionQuota ? "alert" : undefined} className={configurationErrors.defaultInstitutionQuota ? "event-config-error" : "event-config-hint"}>{configurationErrors.defaultInstitutionQuota || "Dapat diubah untuk tiap undangan lembaga."}</span></label>
              </div>
            </div>
          </div>
          <aside className="event-config-summary" aria-label="Ringkasan konfigurasi">
            <div className="flex items-center gap-2"><Users aria-hidden="true" className="h-5 w-5" /><h3>Ringkasan</h3></div>
            <dl>
              <div><dt>Periode</dt><dd>{dateSummary}</dd></div>
              <div><dt>Zona waktu</dt><dd>{eventTimezoneLabel(values.timezone)}</dd></div>
              <div><dt>Jalur</dt><dd>{audienceOptions.find((option) => option.value === values.audienceMode)?.title}</dd></div>
              <div><dt>Kapasitas total</dt><dd>{values.capacity ? `${values.capacity} kursi` : "Tanpa batas"}</dd></div>
              <div><dt>Reguler</dt><dd>{quotaSummary(values.regularQuota, hasRegular)}</dd></div>
              <div><dt>Undangan</dt><dd>{quotaSummary(values.invitationQuota, hasInvitation)}</dd></div>
            </dl>
            <p>Setelah draft tersimpan: atur hari aktif, sesi, undangan, dan panitia dari halaman event.</p>
          </aside>
        </div>
      </section>

      <section id="deadlines" className="event-form-section border border-slate-200 bg-white">
        <header className="event-form-section__header">
          <CalendarClock aria-hidden="true" className="h-5 w-5 text-emerald-700" />
          <div><h2 className="text-lg font-black text-slate-900">Tenggat dan konfirmasi</h2><p className="mt-1 text-sm text-slate-600">Semua jam mengikuti {eventTimezoneLabel(values.timezone)}.</p></div>
        </header>
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <label><span className="event-config-label">Pendaftaran reguler dibuka {!hasRegular && <em>· tidak aktif</em>}</span><input id="event-registrationOpenAt" type="datetime-local" value={values.registrationOpenAt} onChange={(event) => update("registrationOpenAt", event.target.value)} className={fieldClass} /><span className="event-config-hint">Kosong = sejak admin membuka pendaftaran.</span></label>
          <label><span className="event-config-label">Pendaftaran reguler ditutup {!hasRegular && <em>· tidak aktif</em>}</span><input id="event-registrationCloseAt" type="datetime-local" value={values.registrationCloseAt} onChange={(event) => update("registrationCloseAt", event.target.value)} aria-invalid={Boolean(configurationErrors.registrationCloseAt) || undefined} aria-describedby={configurationErrors.registrationCloseAt ? "event-registrationCloseAt-error" : "event-registrationCloseAt-hint"} className={fieldClass} /><span id={configurationErrors.registrationCloseAt ? "event-registrationCloseAt-error" : "event-registrationCloseAt-hint"} role={configurationErrors.registrationCloseAt ? "alert" : undefined} className={configurationErrors.registrationCloseAt ? "event-config-error" : "event-config-hint"}>{configurationErrors.registrationCloseAt || "Kosong = sampai admin menutup pendaftaran."}</span></label>
          <label><span className="event-config-label">Batas respons undangan {!hasInvitation && <em>· tidak aktif</em>}</span><input id="event-invitationResponseDeadline" type="datetime-local" value={values.invitationResponseDeadline} onChange={(event) => update("invitationResponseDeadline", event.target.value)} aria-invalid={Boolean(configurationErrors.invitationResponseDeadline) || undefined} aria-describedby={configurationErrors.invitationResponseDeadline ? "event-invitationResponseDeadline-error" : "event-invitationResponseDeadline-hint"} className={fieldClass} /><span id={configurationErrors.invitationResponseDeadline ? "event-invitationResponseDeadline-error" : "event-invitationResponseDeadline-hint"} role={configurationErrors.invitationResponseDeadline ? "alert" : undefined} className={configurationErrors.invitationResponseDeadline ? "event-config-error" : "event-config-hint"}>{configurationErrors.invitationResponseDeadline || "Berlaku bila tautan undangan tidak punya tenggat khusus; harus sebelum tanggal mulai."}</span></label>
          <label><span className="event-config-label">Batas konfirmasi kehadiran</span><input type="datetime-local" value={values.attendanceConfirmationDeadline} onChange={(event) => update("attendanceConfirmationDeadline", event.target.value)} className={fieldClass} /><span className="event-config-hint">Kosong = tidak ada tenggat konfirmasi.</span></label>
          <label><span className="event-config-label">Jika konfirmasi terlambat</span><select value={values.lateConfirmationPolicy} onChange={(event) => update("lateConfirmationPolicy", event.target.value)} className={fieldClass}><option value="BLOCK">Tolak; hubungi panitia</option><option value="REVIEW">Masuk peninjauan panitia</option><option value="ALLOW">Terima otomatis</option></select></label>
          <label className="event-config-checkbox">
            <input type="checkbox" checked={values.attendanceConfirmationRequired} disabled={lockAttendance} onChange={(event) => update("attendanceConfirmationRequired", event.target.checked)} />
            <span><strong>Konfirmasi sebelum check-in</strong><small>Jika aktif, QR peserta yang belum konfirmasi belum dapat dipresensi.</small></span>
          </label>
        </div>
      </section>

      <section id="location" className="scroll-mt-28 border border-slate-200 bg-white">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 p-4">
          <MapPin className="h-4 w-4 text-emerald-700" />
          <div><h2 className="text-base font-black text-slate-900">Lokasi dan kontak</h2><p className="mt-1 text-sm text-slate-600">Informasi yang akan dilihat peserta dan lembaga.</p></div>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <label><span className="mb-1.5 block text-xs font-bold text-slate-700">Nama tempat</span><input value={values.venueName} onChange={(event) => update("venueName", event.target.value)} className={fieldClass} /></label>
          <label><span className="mb-1.5 block text-xs font-bold text-slate-700">Google Maps URL</span><input type="url" value={values.mapsUrl} onChange={(event) => update("mapsUrl", event.target.value)} className={fieldClass} /></label>
          <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-bold text-slate-700">WhatsApp panitia untuk peserta</span><input id="event-public-contact" type="tel" inputMode="tel" maxLength={24} value={values.publicContactWhatsapp} onChange={(event) => update("publicContactWhatsapp", event.target.value)} placeholder="081234567890" aria-invalid={Boolean(contactError) || undefined} aria-describedby="event-public-contact-hint" className={fieldClass} /><span id="event-public-contact-hint" role={contactError ? "alert" : undefined} className={`mt-1 block min-h-5 text-sm ${contactError ? "text-rose-700" : "text-slate-600"}`}>{contactError || "Opsional. Nomor ini menjadi tujuan WhatsApp pada halaman bukti pendaftaran publik."}</span></label>
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
