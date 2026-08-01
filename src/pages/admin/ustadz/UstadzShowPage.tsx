import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Edit3,
  GitMerge,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Save,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { UstadzWorkspaceNav } from "@/components/admin/ustadz/UstadzWorkspaceNav";
import { institutionApi, Institution } from "@/lib/institutionApi";
import { UstadzProfile, ustadzApi } from "@/lib/ustadzApi";
import { getUstadzPreviewProfile } from "@/lib/ustadzPreview";

type Tab = "PROFILE" | "AFFILIATIONS" | "EVENTS" | "QUALITY";

const formatDate = (value?: string | null) => {
  if (!value) return "Belum tersedia";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
};

const missingLabels: Array<[keyof UstadzProfile, string]> = [
  ["email", "Email"],
  ["phone", "Telepon"],
  ["whatsapp", "WhatsApp"],
  ["address", "Alamat"],
  ["cityCode", "Kota/kabupaten"],
  ["provinceCode", "Provinsi"],
  ["educationSummary", "Riwayat pendidikan"],
  ["expertiseSummary", "Bidang kajian"],
];

export const UstadzShowPage: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UstadzProfile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("PROFILE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);
  const [showAffiliationForm, setShowAffiliationForm] = useState(false);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState("");
  const [position, setPosition] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [savingAffiliation, setSavingAffiliation] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [duplicates, setDuplicates] = useState<UstadzProfile[]>([]);

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      if (id.startsWith("preview-")) {
        setProfile(getUstadzPreviewProfile(id));
        setPreview(true);
      } else {
        setProfile(await ustadzApi.get(id));
        setPreview(false);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Profil belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [id]);

  useEffect(() => {
    if (!showAffiliationForm) return;
    const params = new URLSearchParams({ page: "1", pageSize: "100", status: "ACTIVE" });
    institutionApi
      .list(params)
      .then((response) => setInstitutions(response.data))
      .catch(() => setInstitutions([]));
  }, [showAffiliationForm]);

  useEffect(() => {
    if (activeTab !== "QUALITY" || !profile) return;
    if (preview) {
      setDuplicates(profile.hasDuplicateAlert ? [getUstadzPreviewProfile("preview-ustadz-3")] : []);
      return;
    }
    ustadzApi
      .findDuplicates({
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        excludeId: profile.id,
      })
      .then(setDuplicates)
      .catch(() => setDuplicates([]));
  }, [activeTab, preview, profile]);

  const missingFields = useMemo(
    () => (profile ? missingLabels.filter(([key]) => !profile[key]).map(([, label]) => label) : []),
    [profile],
  );

  const handleAddAffiliation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !institutionId) return;
    if (preview) {
      setActionMessage("Mode pratinjau: afiliasi tervalidasi tanpa mengubah database.");
      setShowAffiliationForm(false);
      return;
    }
    setSavingAffiliation(true);
    setActionMessage("");
    try {
      await ustadzApi.addAffiliation(profile.id, { institutionId, position, isPrimary });
      setInstitutionId("");
      setPosition("");
      setIsPrimary(false);
      setShowAffiliationForm(false);
      setActionMessage("Afiliasi berhasil ditambahkan.");
      await loadProfile();
    } catch (affiliationError) {
      setActionMessage(
        affiliationError instanceof Error ? affiliationError.message : "Afiliasi belum dapat disimpan.",
      );
    } finally {
      setSavingAffiliation(false);
    }
  };

  const markPrimary = async (affiliationId: string) => {
    if (!profile) return;
    if (preview) {
      setActionMessage("Mode pratinjau: pilihan afiliasi utama tidak mengubah database.");
      return;
    }
    try {
      await ustadzApi.updateAffiliation(profile.id, affiliationId, { isPrimary: true });
      setActionMessage("Afiliasi utama diperbarui.");
      await loadProfile();
    } catch (actionError) {
      setActionMessage(actionError instanceof Error ? actionError.message : "Aksi belum dapat diproses.");
    }
  };

  const endAffiliation = async (affiliationId: string) => {
    if (!profile) return;
    if (!window.confirm("Akhiri afiliasi ini? Riwayatnya tetap disimpan.")) return;
    if (preview) {
      setActionMessage("Mode pratinjau: afiliasi tidak diubah.");
      return;
    }
    try {
      await ustadzApi.endAffiliation(profile.id, affiliationId);
      setActionMessage("Afiliasi diakhiri dan riwayat tetap tersimpan.");
      await loadProfile();
    } catch (actionError) {
      setActionMessage(actionError instanceof Error ? actionError.message : "Aksi belum dapat diproses.");
    }
  };

  const whatsappHref = profile?.whatsapp || profile?.phone
    ? `https://wa.me/${(profile.whatsapp || profile.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(
        `Assalamu'alaikum warahmatullahi wabarakatuh, Ustadz ${profile.fullName}. Saya admin Aman Daurah Asatidz.`,
      )}`
    : "";

  return (
    <AdminLayout>
      <div className="ustadz-workspace">
        <PageHeader
          title={profile?.fullName || "Detail profil asatidz"}
          description="Profil terhubung dengan lembaga, event, konfirmasi, dan kehadiran individu."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Asatidz", href: "/admin/ustadz" },
            { label: profile?.fullName || "Detail" },
          ]}
          actions={
            profile ? (
              <div className="ustadz-page-actions">
                <Link to={`/admin/ustadz/merge?source=${profile.id}`} className="ustadz-button ustadz-button--warning">
                  <GitMerge aria-hidden="true" />
                  <span>Gabungkan</span>
                </Link>
                <Link to={`/admin/ustadz/${profile.id}/edit`} className="ustadz-button ustadz-button--primary">
                  <Edit3 aria-hidden="true" />
                  <span>Edit profil</span>
                </Link>
              </div>
            ) : undefined
          }
        />
        <UstadzWorkspaceNav />

        {loading && (
          <div className="ustadz-loading" role="status">
            <Loader2 className="animate-spin" aria-hidden="true" /> Memuat profil…
          </div>
        )}
        {error && (
          <div className="ustadz-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <div><strong>Profil belum dapat dimuat</strong><p>{error}</p><Link to="/admin/ustadz">Kembali ke direktori</Link></div>
          </div>
        )}

        {profile && (
          <>
            {preview && (
              <div className="ustadz-preview-notice" role="status">
                <AlertTriangle aria-hidden="true" />
                <div><strong>Mode pratinjau aktif</strong><span>Interaksi dapat dicoba tanpa mengubah data produksi.</span></div>
              </div>
            )}
            {actionMessage && (
              <div className="ustadz-form__message ustadz-form__message--success" role="status">
                <CheckCircle2 aria-hidden="true" /> {actionMessage}
              </div>
            )}

            <section className="ustadz-profile-band">
              <div className="ustadz-profile-band__identity">
                <span className="ustadz-profile-band__monogram" aria-hidden="true">
                  {profile.fullName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("")}
                </span>
                <div>
                  <p>Profil terverifikasi internal</p>
                  <h2>
                    {[profile.titlePrefix, profile.fullName, profile.titleSuffix].filter(Boolean).join(" ")}
                  </h2>
                  <span>ID {profile.id}</span>
                </div>
              </div>
              <div className="ustadz-profile-band__score">
                <span>Kelengkapan profil</span>
                <strong>{profile.completenessPercent ?? Math.max(20, 100 - missingFields.length * 10)}%</strong>
                <progress max={100} value={profile.completenessPercent ?? Math.max(20, 100 - missingFields.length * 10)} />
              </div>
              <div className="ustadz-profile-band__contact">
                {profile.email && <a href={`mailto:${profile.email}`}><Mail aria-hidden="true" /> Email</a>}
                {whatsappHref && <a href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /> WhatsApp</a>}
              </div>
            </section>

            <nav className="ustadz-tabs" aria-label="Bagian profil">
              {([
                ["PROFILE", "Profil", UserRoundCheck],
                ["AFFILIATIONS", `Afiliasi (${profile.affiliations?.length || 0})`, Building2],
                ["EVENTS", `Riwayat event (${profile.eventHistory?.length || 0})`, CalendarDays],
                ["QUALITY", "Kualitas data", ShieldCheck],
              ] as Array<[Tab, string, React.ComponentType<{ className?: string }>]>).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  data-active={activeTab === key}
                  aria-selected={activeTab === key}
                  onClick={() => setActiveTab(key)}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>

            {activeTab === "PROFILE" && (
              <section className="ustadz-panel">
                <div className="ustadz-panel__head">
                  <div><p>Data inti</p><h2>Identitas dan keahlian</h2></div>
                  <span className="ustadz-status" data-status={profile.profileStatus}>
                    {profile.profileStatus === "ACTIVE" ? "Aktif" : profile.profileStatus === "INACTIVE" ? "Nonaktif" : "Digabungkan"}
                  </span>
                </div>
                <dl className="ustadz-definition-grid">
                  <div><dt>Email</dt><dd><Mail aria-hidden="true" />{profile.email || "Belum tersedia"}</dd></div>
                  <div><dt>Telepon</dt><dd><Phone aria-hidden="true" />{profile.phone || "Belum tersedia"}</dd></div>
                  <div><dt>WhatsApp</dt><dd><MessageCircle aria-hidden="true" />{profile.whatsapp || "Belum tersedia"}</dd></div>
                  <div><dt>Tempat, tanggal lahir</dt><dd>{profile.birthPlace || "—"}, {formatDate(profile.birthDate)}</dd></div>
                  <div><dt>Domisili</dt><dd><MapPin aria-hidden="true" />{profile.address || "Belum tersedia"}</dd></div>
                  <div><dt>Kode wilayah</dt><dd>{profile.cityCode || "—"} / {profile.provinceCode || "—"}</dd></div>
                </dl>
                <div className="ustadz-narratives">
                  <article><BookOpenCheck aria-hidden="true" /><div><h3>Ringkasan pendidikan</h3><p>{profile.educationSummary || "Belum ada ringkasan pendidikan."}</p></div></article>
                  <article><ShieldCheck aria-hidden="true" /><div><h3>Bidang kajian</h3><p>{profile.expertiseSummary || "Belum ada bidang kajian yang dicatat."}</p></div></article>
                </div>
              </section>
            )}

            {activeTab === "AFFILIATIONS" && (
              <section className="ustadz-panel">
                <div className="ustadz-panel__head">
                  <div><p>Relasi kelembagaan</p><h2>Afiliasi aktif dan riwayat</h2></div>
                  <button type="button" className="ustadz-button ustadz-button--primary" onClick={() => setShowAffiliationForm(true)}>
                    <Plus aria-hidden="true" /> Tambah afiliasi
                  </button>
                </div>
                {showAffiliationForm && (
                  <form className="ustadz-inline-form" onSubmit={handleAddAffiliation}>
                    <div className="ustadz-inline-form__head">
                      <strong>Afiliasi baru</strong>
                      <button type="button" onClick={() => setShowAffiliationForm(false)} aria-label="Tutup formulir"><X aria-hidden="true" /></button>
                    </div>
                    <label><span>Lembaga</span><select value={institutionId} onChange={(event) => setInstitutionId(event.target.value)} required><option value="">Pilih lembaga</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></label>
                    <label><span>Posisi</span><input value={position} onChange={(event) => setPosition(event.target.value)} placeholder="Pengasuh / pembina / pengajar" /></label>
                    <label className="ustadz-checkbox"><input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} /><span>Jadikan afiliasi utama</span></label>
                    <button className="ustadz-button ustadz-button--primary" type="submit" disabled={savingAffiliation}><Save aria-hidden="true" />{savingAffiliation ? "Menyimpan…" : "Simpan afiliasi"}</button>
                  </form>
                )}
                <div className="ustadz-affiliation-list">
                  {(profile.affiliations || []).length === 0 ? (
                    <p className="ustadz-panel__empty">Belum ada afiliasi lembaga pada profil ini.</p>
                  ) : (
                    profile.affiliations?.map((affiliation) => (
                      <article key={affiliation.id} data-primary={affiliation.isPrimary}>
                        <Building2 aria-hidden="true" />
                        <div>
                          <div><strong>{affiliation.institutionName}</strong>{affiliation.isPrimary && <span>Utama</span>}</div>
                          <p>{affiliation.institutionCode} · {affiliation.position || "Posisi belum dicatat"}</p>
                          <small>{formatDate(affiliation.startDate)} — {affiliation.endDate ? formatDate(affiliation.endDate) : "sekarang"}</small>
                        </div>
                        {affiliation.status === "ACTIVE" && (
                          <div>
                            {!affiliation.isPrimary && <button type="button" onClick={() => markPrimary(affiliation.id)}>Jadikan utama</button>}
                            <button type="button" onClick={() => endAffiliation(affiliation.id)}>Akhiri</button>
                          </div>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </section>
            )}

            {activeTab === "EVENTS" && (
              <section className="ustadz-panel">
                <div className="ustadz-panel__head"><div><p>Jejak partisipasi</p><h2>Undangan, konfirmasi, dan kehadiran</h2></div></div>
                <div className="ustadz-event-list">
                  {(profile.eventHistory || []).length === 0 ? (
                    <p className="ustadz-panel__empty">Belum ada riwayat event yang tertaut ke profil ini.</p>
                  ) : (
                    profile.eventHistory?.map((event) => (
                      <article key={event.participantId}>
                        <time>{formatDate(event.eventStartDate)}</time>
                        <div><strong>{event.eventName}</strong><span>{event.eventCode} · Peserta {event.participantCode}</span><small>{event.institutionName || "Peserta individual"} · {event.registrationSource.replaceAll("_", " ")}</small></div>
                        <div><span>{event.attendanceStatus.replaceAll("_", " ")}</span><strong>{event.attendedUnits}/{event.requiredUnits} unit · {event.completionPercentage}%</strong></div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            )}

            {activeTab === "QUALITY" && (
              <section className="ustadz-panel">
                <div className="ustadz-panel__head"><div><p>Tata kelola data</p><h2>Kelengkapan dan potensi duplikat</h2></div></div>
                <div className="ustadz-quality-grid">
                  <article>
                    <h3>Data yang perlu dilengkapi</h3>
                    {missingFields.length === 0 ? <p>Semua data utama telah tersedia.</p> : <ul>{missingFields.map((label) => <li key={label}>{label}</li>)}</ul>}
                    <Link to={`/admin/ustadz/${profile.id}/edit`}>Lengkapi profil</Link>
                  </article>
                  <article>
                    <h3>Profil serupa</h3>
                    {duplicates.length === 0 ? <p>Tidak ditemukan profil serupa dari nama dan kontak.</p> : <ul>{duplicates.map((candidate) => <li key={candidate.id}><Link to={`/admin/ustadz/${candidate.id}`}>{candidate.fullName}</Link><span>{candidate.phone || candidate.email || "Tanpa kontak"}</span></li>)}</ul>}
                    {duplicates.length > 0 && <Link to={`/admin/ustadz/merge?source=${profile.id}`}>Buka proses penggabungan</Link>}
                  </article>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};
