import React, { useState } from "react";
import { Building2, Contact, MapPinned, Save, ShieldCheck, Loader2 } from "lucide-react";
import { InstitutionFormValues } from "@/lib/institutionApi";

export const emptyInstitutionValues: InstitutionFormValues = {
  code: "",
  name: "",
  legalName: "",
  institutionType: "Pesantren / Ma'had",
  email: "",
  phone: "",
  whatsapp: "",
  address: "",
  provinceCode: "",
  cityCode: "",
  district: "",
  postalCode: "",
  website: "",
  notes: "",
  status: "ACTIVE",
  verificationStatus: "UNVERIFIED",
};

interface InstitutionFormProps {
  initialValues?: InstitutionFormValues;
  submitLabel: string;
  pending?: boolean;
  error?: string;
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (values: InstitutionFormValues) => Promise<void>;
}

const Field = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  hint,
}: {
  label: string;
  name: keyof InstitutionFormValues;
  value: string;
  onChange: (name: keyof InstitutionFormValues, value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) => (
  <label className="institution-field">
    <span>{label}{required ? " *" : ""}</span>
    <input
      name={name}
      type={type}
      value={value}
      onChange={(event) => onChange(name, event.target.value)}
      required={required}
      placeholder={placeholder}
      aria-describedby={hint ? `${name}-hint` : undefined}
    />
    <small id={`${name}-hint`}>{hint || "\u00a0"}</small>
  </label>
);

export const InstitutionForm: React.FC<InstitutionFormProps> = ({
  initialValues = emptyInstitutionValues,
  submitLabel,
  pending = false,
  error,
  mode,
  onCancel,
  onSubmit,
}) => {
  const [values, setValues] = useState(initialValues);
  const update = (name: keyof InstitutionFormValues, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  return (
    <form
      className="institution-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(values);
      }}
      aria-busy={pending}
    >
      <section>
        <div className="institution-form__section-head">
          <Building2 aria-hidden="true" />
          <div>
            <h2>Identitas lembaga</h2>
            <p>Nama yang digunakan sistem dan dokumen resmi.</p>
          </div>
        </div>
        <div className="institution-form__grid">
          <Field label="Kode lembaga" name="code" value={values.code} onChange={update} required placeholder="MISB-01" hint="Unik, singkat, dan tidak berubah setelah dipakai." />
          <Field label="Nama lembaga" name="name" value={values.name} onChange={update} required placeholder="Nama lembaga" />
          <Field label="Nama badan hukum" name="legalName" value={values.legalName} onChange={update} placeholder="Nama yayasan atau badan hukum" />
          <label className="institution-field">
            <span>Jenis lembaga</span>
            <select name="institutionType" value={values.institutionType} onChange={(event) => update("institutionType", event.target.value)}>
              <option>Pesantren / Ma&apos;had</option>
              <option>Yayasan Dakwah</option>
              <option>Rumah Qur&apos;an</option>
              <option>Masjid / Majelis</option>
              <option>Lembaga Pendidikan</option>
              <option>Lainnya</option>
            </select>
            <small>&nbsp;</small>
          </label>
        </div>
      </section>

      <section>
        <div className="institution-form__section-head">
          <Contact aria-hidden="true" />
          <div>
            <h2>Kontak resmi</h2>
            <p>Dipakai untuk korespondensi dan pengiriman undangan.</p>
          </div>
        </div>
        <div className="institution-form__grid">
          <Field label="Email resmi" name="email" value={values.email} onChange={update} type="email" placeholder="sekretariat@lembaga.or.id" />
          <Field label="Telepon" name="phone" value={values.phone} onChange={update} type="tel" placeholder="022…" />
          <Field label="WhatsApp" name="whatsapp" value={values.whatsapp} onChange={update} type="tel" placeholder="62812…" hint="Gunakan format internasional tanpa tanda +." />
          <Field label="Website" name="website" value={values.website} onChange={update} type="url" placeholder="https://…" />
        </div>
      </section>

      <section>
        <div className="institution-form__section-head">
          <MapPinned aria-hidden="true" />
          <div>
            <h2>Wilayah dan alamat</h2>
            <p>Kode wilayah membantu filter, laporan, dan distribusi undangan.</p>
          </div>
        </div>
        <div className="institution-form__grid">
          <Field label="Kode provinsi" name="provinceCode" value={values.provinceCode} onChange={update} placeholder="32" />
          <Field label="Kode kota/kabupaten" name="cityCode" value={values.cityCode} onChange={update} placeholder="3273" />
          <Field label="Kecamatan" name="district" value={values.district} onChange={update} />
          <Field label="Kode pos" name="postalCode" value={values.postalCode} onChange={update} />
          <label className="institution-field institution-field--wide">
            <span>Alamat lengkap</span>
            <textarea name="address" value={values.address} onChange={(event) => update("address", event.target.value)} rows={3} placeholder="Jalan, nomor, kelurahan, kecamatan" />
            <small>&nbsp;</small>
          </label>
        </div>
      </section>

      {mode === "edit" && (
        <section>
          <div className="institution-form__section-head">
            <ShieldCheck aria-hidden="true" />
            <div>
              <h2>Status dan verifikasi</h2>
              <p>Verifikasi hanya jika identitas dan kontak dapat dipertanggungjawabkan.</p>
            </div>
          </div>
          <div className="institution-form__grid">
            <label className="institution-field">
              <span>Status operasional</span>
              <select value={values.status} onChange={(event) => update("status", event.target.value)}>
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
              <small>&nbsp;</small>
            </label>
            <label className="institution-field">
              <span>Status verifikasi</span>
              <select value={values.verificationStatus} onChange={(event) => update("verificationStatus", event.target.value)}>
                <option value="UNVERIFIED">Belum diverifikasi</option>
                <option value="VERIFIED">Terverifikasi</option>
              </select>
              <small>&nbsp;</small>
            </label>
          </div>
        </section>
      )}

      <section>
        <label className="institution-field">
          <span>Catatan internal</span>
          <textarea name="notes" value={values.notes} onChange={(event) => update("notes", event.target.value)} rows={4} placeholder="Catatan hanya untuk admin…" />
          <small>Jangan masukkan data sensitif yang tidak diperlukan.</small>
        </label>
      </section>

      {error && <div className="institution-form__error" role="alert">{error}</div>}

      <div className="institution-form__actions">
        <button type="button" className="institution-button institution-button--quiet" onClick={onCancel} disabled={pending}>Batal</button>
        <button type="submit" className="institution-button institution-button--primary" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          {pending ? "Menyimpan…" : submitLabel}
        </button>
      </div>
    </form>
  );
};
