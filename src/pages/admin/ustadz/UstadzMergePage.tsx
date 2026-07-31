import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  GitMerge,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { UstadzWorkspaceNav } from "@/components/admin/ustadz/UstadzWorkspaceNav";
import { UstadzProfile, ustadzApi } from "@/lib/ustadzApi";
import { ustadzPreviewProfiles } from "@/lib/ustadzPreview";

const ProfileCard: React.FC<{
  profile?: UstadzProfile;
  tone: "source" | "target";
}> = ({ profile, tone }) => (
  <article className="ustadz-merge-profile" data-tone={tone}>
    <div className="ustadz-merge-profile__label">
      <span>{tone === "source" ? "Sumber" : "Target utama"}</span>
      <strong>{tone === "source" ? "Akan dinonaktifkan" : "Akan dipertahankan"}</strong>
    </div>
    {profile ? (
      <>
        <h3>{profile.fullName}</h3>
        <dl>
          <div><dt><Mail aria-hidden="true" /> Email</dt><dd>{profile.email || "Belum ada"}</dd></div>
          <div><dt><Phone aria-hidden="true" /> Telepon</dt><dd>{profile.phone || "Belum ada"}</dd></div>
          <div><dt><Building2 aria-hidden="true" /> Afiliasi utama</dt><dd>{profile.primaryInstitution?.institutionName || "Belum ada"}</dd></div>
          <div><dt>Kelengkapan</dt><dd>{profile.completenessPercent || 0}%</dd></div>
        </dl>
        <Link to={`/admin/ustadz/${profile.id}`} target="_blank">Buka profil di tab baru</Link>
      </>
    ) : (
      <p>Pilih profil untuk melihat perbandingan data.</p>
    )}
  </article>
);

export const UstadzMergePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profiles, setProfiles] = useState<UstadzProfile[]>([]);
  const [sourceId, setSourceId] = useState(searchParams.get("source") || "");
  const [targetId, setTargetId] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ page: "1", pageSize: "100", profileStatus: "ACTIVE" });
    ustadzApi
      .list(params)
      .then((response) => {
        setProfiles(response.data);
        setPreview(false);
      })
      .catch(() => {
        setProfiles(ustadzPreviewProfiles.filter((profile) => profile.profileStatus === "ACTIVE"));
        setPreview(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const source = useMemo(() => profiles.find((profile) => profile.id === sourceId), [profiles, sourceId]);
  const target = useMemo(() => profiles.find((profile) => profile.id === targetId), [profiles, targetId]);
  const isValid =
    Boolean(source && target) &&
    sourceId !== targetId &&
    notes.trim().length >= 5 &&
    confirmation === "GABUNGKAN";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!isValid) {
      setError("Pilih dua profil berbeda, isi alasan, lalu ketik GABUNGKAN untuk mengonfirmasi.");
      return;
    }
    if (preview) {
      setSuccess("Mode pratinjau: simulasi penggabungan berhasil tanpa mengubah data produksi.");
      return;
    }
    setSaving(true);
    try {
      await ustadzApi.merge({
        sourceUstadzIds: [sourceId],
        targetUstadzId: targetId,
        notes: notes.trim(),
      });
      navigate(`/admin/ustadz/${targetId}`, { replace: true });
    } catch (mergeError) {
      setError(mergeError instanceof Error ? mergeError.message : "Profil belum dapat digabungkan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="ustadz-workspace">
        <PageHeader
          title="Gabungkan profil duplikat"
          description="Satukan riwayat lembaga dan partisipasi ke profil utama tanpa menghapus jejak audit."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Asatidz", href: "/admin/ustadz" },
            { label: "Gabungkan profil" },
          ]}
        />
        <UstadzWorkspaceNav />

        {preview && (
          <div className="ustadz-preview-notice" role="status">
            <AlertTriangle aria-hidden="true" />
            <div><strong>Mode pratinjau aktif</strong><span>Alur penggabungan dapat dicoba tanpa mengubah data produksi.</span></div>
          </div>
        )}

        <section className="ustadz-merge-intro">
          <ShieldCheck aria-hidden="true" />
          <div>
            <p>Operasi dengan jejak audit</p>
            <h2>Apa yang terjadi saat profil digabungkan?</h2>
            <ul>
              <li>Partisipasi event dan afiliasi dipindahkan ke profil target.</li>
              <li>Profil sumber berstatus “Digabungkan” dan tidak lagi dipakai untuk pendaftaran baru.</li>
              <li>Identitas profil target tidak ditimpa otomatis; admin dapat melengkapinya setelah proses selesai.</li>
            </ul>
          </div>
        </section>

        <form className="ustadz-merge-form" onSubmit={handleSubmit}>
          <section className="ustadz-merge-form__selection">
            <div>
              <label htmlFor="merge-source">Profil sumber</label>
              <span>Akan dinonaktifkan setelah seluruh relasi dipindahkan.</span>
              <select id="merge-source" value={sourceId} onChange={(event) => setSourceId(event.target.value)} required>
                <option value="">Pilih profil sumber</option>
                {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.fullName}</option>)}
              </select>
            </div>
            <ArrowRight aria-hidden="true" />
            <div>
              <label htmlFor="merge-target">Profil target utama</label>
              <span>Profil inilah yang dipertahankan dan digunakan selanjutnya.</span>
              <select id="merge-target" value={targetId} onChange={(event) => setTargetId(event.target.value)} required>
                <option value="">Pilih profil target</option>
                {profiles.filter((profile) => profile.id !== sourceId).map((profile) => <option key={profile.id} value={profile.id}>{profile.fullName}</option>)}
              </select>
            </div>
          </section>

          {loading ? (
            <div className="ustadz-loading" role="status"><Loader2 className="animate-spin" aria-hidden="true" /> Memuat profil aktif…</div>
          ) : (
            <div className="ustadz-merge-comparison">
              <ProfileCard profile={source} tone="source" />
              <ProfileCard profile={target} tone="target" />
            </div>
          )}

          <section className="ustadz-merge-confirm">
            <label>
              <span>Alasan penggabungan</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Contoh: nomor WhatsApp dan identitas terkonfirmasi sebagai orang yang sama" required minLength={5} />
            </label>
            <label>
              <span>Ketik <strong>GABUNGKAN</strong> untuk konfirmasi</span>
              <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" placeholder="GABUNGKAN" />
            </label>
          </section>

          {error && <div className="ustadz-form__message ustadz-form__message--error" role="alert"><AlertTriangle aria-hidden="true" />{error}</div>}
          {success && <div className="ustadz-form__message ustadz-form__message--success" role="status"><CheckCircle2 aria-hidden="true" />{success}</div>}

          <div className="ustadz-form__actions">
            <Link to="/admin/ustadz" className="ustadz-button ustadz-button--secondary">Batal</Link>
            <button type="submit" className="ustadz-button ustadz-button--warning" disabled={!isValid || saving}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <GitMerge aria-hidden="true" />}
              {saving ? "Menggabungkan…" : "Gabungkan ke profil target"}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};
