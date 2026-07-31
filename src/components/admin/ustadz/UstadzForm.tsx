import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2, Save, SearchCheck } from "lucide-react";
import { institutionApi, Institution } from "@/lib/institutionApi";
import {
  UstadzFormValues,
  UstadzProfile,
  UstadzProfileStatus,
  ustadzApi,
} from "@/lib/ustadzApi";

const EMPTY_VALUES: UstadzFormValues = {
  fullName: "",
  titlePrefix: "",
  titleSuffix: "",
  email: "",
  phone: "",
  whatsapp: "",
  birthPlace: "",
  birthDate: "",
  address: "",
  cityCode: "",
  provinceCode: "",
  educationSummary: "",
  expertiseSummary: "",
  institutionId: "",
  positionAtInstitution: "",
  isPrimaryInstitution: true,
  profileStatus: "ACTIVE",
};

interface UstadzFormProps {
  mode: "create" | "edit";
  profileId?: string;
  initialValues?: Partial<UstadzFormValues>;
  preview?: boolean;
}

export const UstadzForm: React.FC<UstadzFormProps> = ({
  mode,
  profileId,
  initialValues,
  preview = false,
}) => {
  const navigate = useNavigate();
  const [values, setValues] = useState<UstadzFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [duplicates, setDuplicates] = useState<UstadzProfile[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setValues({ ...EMPTY_VALUES, ...initialValues });
  }, [initialValues]);

  useEffect(() => {
    if (mode !== "create") return;
    const params = new URLSearchParams({ page: "1", pageSize: "100", status: "ACTIVE" });
    institutionApi
      .list(params)
      .then((response) => setInstitutions(response.data))
      .catch(() => setInstitutions([]));
  }, [mode]);

  useEffect(() => {
    const name = values.fullName.trim();
    if (name.length < 3) {
      setDuplicates([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setCheckingDuplicates(true);
      try {
        const result = await ustadzApi.findDuplicates({
          fullName: name,
          email: values.email || null,
          phone: values.phone || null,
          excludeId: profileId || null,
        });
        setDuplicates(result);
      } catch {
        setDuplicates([]);
      } finally {
        setCheckingDuplicates(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [profileId, values.email, values.fullName, values.phone]);

  const update = <K extends keyof UstadzFormValues>(key: K, value: UstadzFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError("");
    setSuccess("");
  };

  const contactHint = useMemo(() => {
    if (values.whatsapp && values.phone && values.whatsapp !== values.phone) {
      return "Nomor WhatsApp berbeda dari nomor telepon utama.";
    }
    return "Gunakan format nomor aktif; sistem akan menormalisasi kode negara.";
  }, [values.phone, values.whatsapp]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (preview) {
      setSuccess("Mode pratinjau aktif. Formulir tervalidasi tanpa mengubah data produksi.");
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        const result = await ustadzApi.create(values);
        navigate(`/admin/ustadz/${result.profile.id}`, { replace: true });
      } else if (profileId) {
        const updated = await ustadzApi.update(profileId, values);
        navigate(`/admin/ustadz/${updated.id}`, { replace: true });
      }
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Profil belum dapat disimpan. Periksa data lalu coba kembali.",
      );
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-100";

  return (
    <form className="ustadz-form" onSubmit={handleSubmit} aria-busy={saving}>
      {preview && (
        <div className="ustadz-form__notice">
          Mode pratinjau: profil contoh dapat diuji, tetapi tidak disimpan ke database.
        </div>
      )}

      <section className="ustadz-form__section" aria-labelledby="ustadz-identity-heading">
        <div className="ustadz-form__section-head">
          <span>01</span>
          <div>
            <h2 id="ustadz-identity-heading">Identitas dan gelar</h2>
            <p>Nama utama dipakai untuk pencarian, undangan, dan pencocokan peserta.</p>
          </div>
        </div>
        <div className="ustadz-form__grid">
          <label className="ustadz-field ustadz-field--wide">
            <span>Nama lengkap <b aria-hidden="true">*</b></span>
            <input
              className={fieldClass}
              value={values.fullName}
              onChange={(event) => update("fullName", event.target.value)}
              placeholder="Contoh: Muhammad Abdullah"
              required
              autoComplete="name"
            />
            <small>Masukkan nama tanpa sapaan “Ustadz”; gelar disediakan pada kolom terpisah.</small>
          </label>
          <label className="ustadz-field">
            <span>Gelar depan</span>
            <input
              className={fieldClass}
              value={values.titlePrefix}
              onChange={(event) => update("titlePrefix", event.target.value)}
              placeholder="Dr. / Prof."
            />
          </label>
          <label className="ustadz-field">
            <span>Gelar belakang</span>
            <input
              className={fieldClass}
              value={values.titleSuffix}
              onChange={(event) => update("titleSuffix", event.target.value)}
              placeholder="Lc., M.A."
            />
          </label>
          <label className="ustadz-field">
            <span>Tempat lahir</span>
            <input
              className={fieldClass}
              value={values.birthPlace}
              onChange={(event) => update("birthPlace", event.target.value)}
              placeholder="Kota kelahiran"
            />
          </label>
          <label className="ustadz-field">
            <span>Tanggal lahir</span>
            <input
              className={fieldClass}
              type="date"
              value={values.birthDate}
              onChange={(event) => update("birthDate", event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="ustadz-form__section" aria-labelledby="ustadz-contact-heading">
        <div className="ustadz-form__section-head">
          <span>02</span>
          <div>
            <h2 id="ustadz-contact-heading">Kontak dan domisili</h2>
            <p>Data ini membantu panitia menghubungi asatidz dan memetakan kebutuhan perjalanan.</p>
          </div>
        </div>
        <div className="ustadz-form__grid">
          <label className="ustadz-field">
            <span>Email</span>
            <input
              className={fieldClass}
              type="email"
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
              placeholder="nama@lembaga.id"
              autoComplete="email"
            />
          </label>
          <label className="ustadz-field">
            <span>Telepon</span>
            <input
              className={fieldClass}
              type="tel"
              value={values.phone}
              onChange={(event) => update("phone", event.target.value)}
              placeholder="0812 3456 7890"
              autoComplete="tel"
            />
          </label>
          <label className="ustadz-field">
            <span>WhatsApp</span>
            <input
              className={fieldClass}
              type="tel"
              value={values.whatsapp}
              onChange={(event) => update("whatsapp", event.target.value)}
              placeholder="Kosongkan bila sama"
            />
            <small>{contactHint}</small>
          </label>
          <label className="ustadz-field">
            <span>Kode kota/kabupaten</span>
            <input
              className={fieldClass}
              value={values.cityCode}
              onChange={(event) => update("cityCode", event.target.value)}
              placeholder="Kode wilayah"
            />
          </label>
          <label className="ustadz-field">
            <span>Kode provinsi</span>
            <input
              className={fieldClass}
              value={values.provinceCode}
              onChange={(event) => update("provinceCode", event.target.value)}
              placeholder="Kode provinsi"
            />
          </label>
          <label className="ustadz-field ustadz-field--wide">
            <span>Alamat</span>
            <textarea
              className={fieldClass}
              value={values.address}
              onChange={(event) => update("address", event.target.value)}
              rows={3}
              placeholder="Alamat domisili atau alamat korespondensi"
            />
          </label>
        </div>
      </section>

      <section className="ustadz-form__section" aria-labelledby="ustadz-professional-heading">
        <div className="ustadz-form__section-head">
          <span>03</span>
          <div>
            <h2 id="ustadz-professional-heading">Pendidikan dan bidang kajian</h2>
            <p>Ringkasan membantu kurasi program, penugasan, dan pencarian narasumber.</p>
          </div>
        </div>
        <div className="ustadz-form__grid">
          <label className="ustadz-field ustadz-field--wide">
            <span>Ringkasan pendidikan</span>
            <textarea
              className={fieldClass}
              value={values.educationSummary}
              onChange={(event) => update("educationSummary", event.target.value)}
              rows={4}
              placeholder="Lembaga pendidikan, program, atau sanad yang relevan"
            />
          </label>
          <label className="ustadz-field ustadz-field--wide">
            <span>Bidang kajian / kepakaran</span>
            <textarea
              className={fieldClass}
              value={values.expertiseSummary}
              onChange={(event) => update("expertiseSummary", event.target.value)}
              rows={4}
              placeholder="Contoh: fikih ibadah, bahasa Arab, pendidikan keluarga"
            />
          </label>
        </div>
      </section>

      {mode === "create" ? (
        <section className="ustadz-form__section" aria-labelledby="ustadz-affiliation-heading">
          <div className="ustadz-form__section-head">
            <span>04</span>
            <div>
              <h2 id="ustadz-affiliation-heading">Afiliasi awal</h2>
              <p>Opsional. Afiliasi lain dapat ditambahkan dari halaman detail setelah profil tersimpan.</p>
            </div>
          </div>
          <div className="ustadz-form__grid">
            <label className="ustadz-field">
              <span>Lembaga</span>
              <select
                className={fieldClass}
                value={values.institutionId}
                onChange={(event) => update("institutionId", event.target.value)}
              >
                <option value="">Belum ditentukan</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name} ({institution.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="ustadz-field">
              <span>Posisi di lembaga</span>
              <input
                className={fieldClass}
                value={values.positionAtInstitution}
                onChange={(event) => update("positionAtInstitution", event.target.value)}
                placeholder="Pengasuh / pembina / pengajar"
                disabled={!values.institutionId}
              />
            </label>
            <label className="ustadz-checkbox ustadz-field--wide">
              <input
                type="checkbox"
                checked={values.isPrimaryInstitution}
                onChange={(event) => update("isPrimaryInstitution", event.target.checked)}
                disabled={!values.institutionId}
              />
              <span>
                Jadikan afiliasi utama
                <small>Hanya satu lembaga dapat menjadi afiliasi utama aktif.</small>
              </span>
            </label>
          </div>
        </section>
      ) : (
        <section className="ustadz-form__section" aria-labelledby="ustadz-status-heading">
          <div className="ustadz-form__section-head">
            <span>04</span>
            <div>
              <h2 id="ustadz-status-heading">Status profil</h2>
              <p>Nonaktifkan profil tanpa menghapus riwayat undangan, afiliasi, dan kehadiran.</p>
            </div>
          </div>
          <label className="ustadz-field">
            <span>Status</span>
            <select
              className={fieldClass}
              value={values.profileStatus}
              onChange={(event) => update("profileStatus", event.target.value as UstadzProfileStatus)}
            >
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
              <option value="MERGED" disabled>
                Digabungkan (hanya melalui proses merge)
              </option>
            </select>
          </label>
        </section>
      )}

      <aside className="ustadz-duplicate-check" data-has-results={duplicates.length > 0}>
        <div>
          {duplicates.length > 0 ? <AlertTriangle aria-hidden="true" /> : <SearchCheck aria-hidden="true" />}
          <div>
            <h2>Pemeriksaan profil serupa</h2>
            <p>
              {checkingDuplicates
                ? "Memeriksa nama dan kontak…"
                : duplicates.length > 0
                  ? `${duplicates.length} profil serupa ditemukan. Periksa sebelum menyimpan.`
                  : "Tidak ada indikasi duplikat dari data yang telah diisi."}
            </p>
          </div>
        </div>
        {duplicates.length > 0 && (
          <ul>
            {duplicates.map((candidate) => (
              <li key={candidate.id}>
                <div>
                  <strong>{candidate.fullName}</strong>
                  <span>
                    {candidate.primaryInstitution?.institutionName || "Tanpa afiliasi utama"} ·{" "}
                    {candidate.phone || candidate.email || "Kontak belum tersedia"}
                  </span>
                </div>
                <Link to={`/admin/ustadz/${candidate.id}`}>Buka profil</Link>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {error && (
        <div className="ustadz-form__message ustadz-form__message--error" role="alert">
          <AlertTriangle aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="ustadz-form__message ustadz-form__message--success" role="status">
          <CheckCircle2 aria-hidden="true" />
          <span>{success}</span>
        </div>
      )}

      <div className="ustadz-form__actions">
        <button type="button" onClick={() => navigate(-1)} className="ustadz-button ustadz-button--secondary">
          Batal
        </button>
        <button type="submit" className="ustadz-button ustadz-button--primary" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          <span>{saving ? "Menyimpan…" : mode === "create" ? "Simpan profil" : "Simpan perubahan"}</span>
        </button>
      </div>
    </form>
  );
};
