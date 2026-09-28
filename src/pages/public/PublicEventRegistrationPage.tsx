/* Hallmark · genre: modern-minimal · macrostructure: Narrative Workflow · design-system: design.md · designed-as-app */
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { ENV } from "@/config/env";

type EventSummary = {
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  venueName: string | null;
  status: string;
  audienceMode: string;
  regularQuota: number | null;
  regularApproved: number;
  capacity: number | null;
  invitationApproved: number;
  registrationOpenAt: string | null;
  registrationCloseAt: string | null;
};

type RegistrationResult = {
  participantCode: string;
  approvalStatus: string;
  portalLoginUrl: string;
  passwordSetupRequired: boolean;
  participants: Array<{ fullName: string; email: string; participantCode: string }>;
  emailQueued: number;
};

type Delegate = { fullName: string; email: string; whatsapp: string; address: string };
const emptyDelegate = (): Delegate => ({ fullName: "", email: "", whatsapp: "", address: "" });

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status >= 500 ? "Layanan pendaftaran sedang tidak tersedia. Coba lagi sebentar atau hubungi panitia." : payload.error?.message || "Permintaan tidak dapat diproses. Coba lagi.");
  return payload.data as T;
}

export const PublicEventRegistrationPage: React.FC = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [challengeToken, setChallengeToken] = useState("");
  const [previewCode, setPreviewCode] = useState("");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<RegistrationResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`${ENV.API_BASE_URL}/events/public/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(readResponse<EventSummary>)
      .then(setEvent)
      .catch((loadError) => { if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Program tidak dapat dimuat."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug]);

  const open = Boolean(event &&
    ["PUBLIC_OPEN", "MIXED"].includes(event.audienceMode) &&
    event.status === "REGISTRATION_OPEN" &&
    (event.regularQuota == null || event.regularApproved < event.regularQuota) &&
    (event.capacity == null || event.regularApproved + event.invitationApproved < event.capacity) &&
    (!event.registrationOpenAt || new Date(event.registrationOpenAt) <= new Date()) &&
    (!event.registrationCloseAt || new Date(event.registrationCloseAt) >= new Date()));

  const requestCode = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await readResponse<{ challengeToken: string; previewCode?: string }>(await fetch(
        `${ENV.API_BASE_URL}/events/public/${encodeURIComponent(slug)}/registration/code`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) },
      ));
      setChallengeToken(data.challengeToken);
      setPreviewCode(data.previewCode || "");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Kode verifikasi gagal dikirim.");
    } finally { setBusy(false); }
  };

  const submit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    const emails = [email, ...delegates.map((delegate) => delegate.email)].map((value) => value.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) { setError("Setiap asatidz perlu email pribadi yang berbeda."); return; }
    setBusy(true);
    setError("");
    try {
      const data = await readResponse<RegistrationResult>(await fetch(
        `${ENV.API_BASE_URL}/events/public/${encodeURIComponent(slug)}/registration`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, email: email.trim(), whatsapp, address, code, challengeToken, delegates, consentConfirmed: true }) },
      ));
      setResult(data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Pendaftaran belum tersimpan.");
    } finally { setBusy(false); }
  };

  return <PublicLayout>
    <div className="public-register">
      <nav aria-label="Navigasi pendaftaran" className="public-register__back"><Link to={`/events/${slug}`}><ArrowLeft aria-hidden="true" /> Informasi program</Link></nav>
      <header className="public-register__header">
        <div>
          <p>Pendaftaran reguler</p>
          <h1>{event?.name || "Daftar program daurah"}</h1>
          <span>Daftar sendiri atau sebagai kepala rombongan. Setiap asatidz memperoleh kode peserta, akun, dan QR masing-masing setelah disetujui panitia.</span>
        </div>
        <div className="public-register__steps" aria-label="Tahapan pendaftaran">
          <span>1. Isi email</span><span>2. Verifikasi</span><span>3. Isi data</span><span>4. Pantau status</span>
        </div>
      </header>
      {loading ? <p role="status" className="public-register__notice">Memuat informasi program…</p> : !event ? <p role="alert" className="public-register__error">{error || "Program tidak tersedia."}</p> : result ? (
        <section className="public-register__success" aria-live="polite">
          <CheckCircle2 aria-hidden="true" />
          <h2>Pendaftaran diterima untuk ditinjau</h2>
          <p>{result.participants.length} asatidz telah didaftarkan untuk ditinjau. Kode pendaftaran bukan tanda kursi sudah disetujui.</p>
          {result.emailQueued < result.participants.length && <p role="status">Sebagian email informasi belum masuk antrean. Data pendaftaran tetap tersimpan; gunakan kode di bawah dan hubungi panitia bila email tidak tiba.</p>}
          <ul className="public-register__result-list">{result.participants.map((person) => <li key={person.participantCode}><strong>{person.fullName}</strong><span>{person.email}</span><code>{person.participantCode}</code></li>)}</ul>
          <ol>
            <li>Panitia memeriksa data dan kuota reguler.</li>
            <li>{result.passwordSetupRequired ? "Buka Portal Asatidz dan pilih “Aktivasi atau atur ulang password” menggunakan email yang sama." : "Masuk ke Portal Asatidz dengan email dan password akun Anda."}</li>
            <li>Setiap anggota menerima email pendaftaran dan memakai emailnya sendiri untuk aktivasi/masuk portal. Di sana mereka memantau persetujuan, jadwal, dan QR individu.</li>
          </ol>
          <Link to="/login/ustadz" className="public-register__primary">Buka Portal Asatidz <ArrowRight aria-hidden="true" /></Link>
        </section>
      ) : !open ? <div className="public-register__notice"><strong>Pendaftaran reguler tidak sedang dibuka.</strong><p>Lihat informasi program atau hubungi panitia bila Anda menerima undangan khusus.</p></div> : (
        <div className="public-register__layout">
          <section className="public-register__form-panel">
            <h2>{challengeToken ? "Lengkapi rombongan" : "Mulai dengan email kepala rombongan"}</h2>
            <p>Gunakan email pribadi yang dapat Anda buka. Kode verifikasi dikirim ke kepala rombongan; setiap peserta nanti memakai emailnya sendiri untuk portal.</p>
            {error && <p role="alert" className="public-register__error">{error}</p>}
            {!challengeToken ? <form onSubmit={requestCode} className="public-register__form">
              <label htmlFor="register-email">Email pribadi</label>
              <input id="register-email" type="email" autoComplete="email" required value={email} onChange={(input) => setEmail(input.target.value)} placeholder="nama@contoh.id" />
              <button disabled={busy} type="submit" className="public-register__primary"><Mail aria-hidden="true" /> {busy ? "Mengirim kode…" : "Kirim kode verifikasi"}</button>
            </form> : <form onSubmit={submit} className="public-register__form">
              <p className="public-register__sent">Kode 6 digit dikirim ke <strong>{email}</strong>. Berlaku 5 menit.</p>
              {previewCode && <p className="public-register__sent">Mode lokal · kode uji: <strong>{previewCode}</strong></p>}
              <label htmlFor="register-code">Kode verifikasi email</label>
              <input id="register-code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(input) => setCode(input.target.value.replace(/\D/g, ""))} placeholder="6 digit" />
              <label htmlFor="register-name">Nama lengkap asatidz</label>
              <input id="register-name" required minLength={3} autoComplete="name" value={fullName} onChange={(input) => setFullName(input.target.value)} placeholder="Sesuai nama yang digunakan di lembaga" />
              <label htmlFor="register-whatsapp">Nomor WhatsApp aktif</label>
              <input id="register-whatsapp" required type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={(input) => setWhatsapp(input.target.value)} placeholder="08…" />
              <label htmlFor="register-address">Alamat domisili <span>(opsional)</span></label>
              <textarea id="register-address" rows={3} value={address} onChange={(input) => setAddress(input.target.value)} placeholder="Kota/kabupaten dan alamat ringkas" />
              <section className="public-register__group" aria-labelledby="group-members-title">
                <div className="public-register__group-head"><div><Users aria-hidden="true" /><h3 id="group-members-title">Anggota rombongan</h3><p>Anda adalah kepala rombongan. Tambahkan asatidz lain bila hadir bersama; maksimal 20 orang termasuk Anda.</p></div><button type="button" disabled={delegates.length >= 19} onClick={() => setDelegates((current) => [...current, emptyDelegate()])}><Plus aria-hidden="true" /> Tambah asatidz</button></div>
                {delegates.map((delegate, index) => <fieldset key={index} className="public-register__member"><legend>Asatidz {index + 2}</legend><button type="button" onClick={() => setDelegates((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Hapus asatidz ${index + 2}`}><Trash2 aria-hidden="true" /> Hapus</button><label htmlFor={`group-name-${index}`}>Nama lengkap *</label><input id={`group-name-${index}`} required minLength={3} maxLength={150} value={delegate.fullName} onChange={(event) => setDelegates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, fullName: event.target.value } : item))} /><label htmlFor={`group-email-${index}`}>Email pribadi untuk portal *</label><input id={`group-email-${index}`} type="email" required value={delegate.email} onChange={(event) => setDelegates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, email: event.target.value } : item))} /><label htmlFor={`group-whatsapp-${index}`}>WhatsApp aktif *</label><input id={`group-whatsapp-${index}`} type="tel" required minLength={9} value={delegate.whatsapp} onChange={(event) => setDelegates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, whatsapp: event.target.value } : item))} /><label htmlFor={`group-address-${index}`}>Alamat domisili <span>(opsional)</span></label><textarea id={`group-address-${index}`} rows={2} maxLength={500} value={delegate.address} onChange={(event) => setDelegates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, address: event.target.value } : item))} /></fieldset>)}
              </section>
              <label className="public-register__consent"><input type="checkbox" required /> <span>Saya telah mendapat persetujuan anggota rombongan untuk menyerahkan data kontak mereka kepada panitia dan mengirimkan informasi program melalui email.</span></label>
              <button disabled={busy} type="submit" className="public-register__primary">{busy ? "Menyimpan…" : "Kirim pendaftaran"} <ArrowRight aria-hidden="true" /></button>
              <button type="button" className="public-register__secondary" onClick={() => { setChallengeToken(""); setCode(""); setError(""); }}>Ganti email atau minta kode baru</button>
            </form>}
          </section>
          <aside className="public-register__aside">
            <ShieldCheck aria-hidden="true" />
            <h2>Sebelum mendaftar</h2>
            <ul>
              <li>Jika Anda sudah didaftarkan oleh lembaga, jangan mendaftar ulang melalui jalur reguler.</li>
              <li>Satu profil asatidz boleh mengikuti beberapa program, tetapi hanya satu pendaftaran per program. Kepala rombongan dapat mendaftarkan beberapa asatidz sekaligus.</li>
              <li>Setiap peserta memakai QR miliknya sendiri saat presensi.</li>
            </ul>
            <Link to="/login/ustadz">Sudah punya akun? Masuk portal</Link>
          </aside>
        </div>
      )}
    </div>
  </PublicLayout>;
};
