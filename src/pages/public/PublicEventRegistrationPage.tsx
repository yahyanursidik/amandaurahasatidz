/* Hallmark · genre: modern-minimal · macrostructure: Narrative Workflow · design-system: design.md · designed-as-app */
import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Plus, Trash2, Users } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { ENV } from "@/config/env";
import { RegionFields, type RegionValue } from "@/components/public/RegionFields";
import { getRegularRegistrationState } from "@/lib/regularRegistration";
import { PublicRegistrationReceipt } from "@/components/public/PublicRegistrationReceipt";
import type { ReceiptParticipant } from "@/lib/publicRegistrationReceipt";
import { readRegistrationProof, saveRegistrationProof } from "@/lib/registrationProof";
import { buildEventWhatsAppUrl } from "@/lib/eventWhatsApp";

type EventSummary = {
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  venueName: string | null;
  publicContactWhatsapp?: string | null;
  attendanceConfirmationRequired?: boolean;
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
  participants: ReceiptParticipant[];
  emailQueued: number;
};

type Delegate = { id: number; fullName: string; email: string; whatsapp: string; address: string; region: RegionValue };
const emptyRegion = (): RegionValue => ({ city: "", province: "", cityCode: "", provinceCode: "" });
const emptyDelegate = (id: number, region: RegionValue): Delegate => ({ id, fullName: "", email: "", whatsapp: "", address: "", region: { ...region } });

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status >= 500 ? "Layanan pendaftaran sedang tidak tersedia. Coba lagi sebentar atau hubungi panitia." : payload.error?.message || "Permintaan tidak dapat diproses. Coba lagi.");
  return payload.data as T;
}

export const PublicEventRegistrationPage: React.FC<{ embeddedEvent?: EventSummary }> = ({ embeddedEvent }) => {
  const { slug = "" } = useParams<{ slug: string }>();
  const proofKey = `registration:regular:${embeddedEvent?.slug || slug}`;
  const [event, setEvent] = useState<EventSummary | null>(() => embeddedEvent || readRegistrationProof<EventSummary, RegistrationResult>(proofKey)?.event || null);
  const [loading, setLoading] = useState(!event);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [region, setRegion] = useState<RegionValue>(emptyRegion);
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(() => readRegistrationProof<EventSummary, RegistrationResult>(proofKey)?.result || null);
  const receiptHeadingRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const scrollAfterSubmit = useRef(false);
  const nextDelegateId = useRef(0);

  useEffect(() => {
    if (!result || !scrollAfterSubmit.current) return;
    scrollAfterSubmit.current = false;
    receiptHeadingRef.current?.scrollIntoView({ block: "start" });
  }, [result]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  useEffect(() => {
    const proof = readRegistrationProof<EventSummary, RegistrationResult>(proofKey);
    setResult(proof?.result || null);
    if (embeddedEvent) { setEvent(embeddedEvent); setLoading(false); return; }
    if (proof) { setEvent(proof.event); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch(`${ENV.API_BASE_URL}/events/public/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(readResponse<EventSummary>)
      .then(setEvent)
      .catch((loadError) => { if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Program tidak dapat dimuat."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, embeddedEvent, proofKey]);

  const registration = event ? getRegularRegistrationState(event) : null;
  const maxGroupSize = event ? Math.max(1, Math.min(20,
    event.regularQuota == null ? 20 : event.regularQuota - event.regularApproved,
    event.capacity == null ? 20 : event.capacity - event.regularApproved - event.invitationApproved,
  )) : 20;
  const contactUrl = event?.publicContactWhatsapp
    ? buildEventWhatsAppUrl(`Assalamu’alaikum warahmatullahi wabarakatuh. Saya perlu bantuan mendaftar ${event.name}. Jazakumullahu khairan.`, event.publicContactWhatsapp)
    : null;
  const addDelegate = () => {
    nextDelegateId.current += 1;
    const nextId = nextDelegateId.current;
    setConsent(false);
    setDelegates((current) => current.length >= maxGroupSize - 1 ? current : [...current, emptyDelegate(nextId, region)]);
  };

  const submit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    if (!consent) { setError("Setujui penggunaan data peserta sebelum mendaftar."); return; }
    if (delegates.length + 1 > maxGroupSize) { setError("Jumlah peserta melebihi batas saat ini. Kurangi anggota rombongan lalu coba lagi."); return; }
    const emails = [email, ...delegates.map((delegate) => delegate.email)].map((value) => value.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) { setError("Ada email yang dipakai lebih dari satu peserta. Gunakan email pribadi berbeda untuk tiap asatidz."); return; }
    setBusy(true);
    setError("");
    try {
      const data = await readResponse<RegistrationResult>(await fetch(
        `${ENV.API_BASE_URL}/events/public/${encodeURIComponent(slug)}/registration`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, email: email.trim(), whatsapp, address,
          institutionName: institutionName.trim(), ...region,
          delegates: delegates.map((delegate) => ({ fullName: delegate.fullName, email: delegate.email.trim(), whatsapp: delegate.whatsapp, address: delegate.address, ...delegate.region })),
          consentConfirmed: consent }) },
      ));
      setResult(data);
      scrollAfterSubmit.current = true;
      if (event) saveRegistrationProof(proofKey, { event, result: data });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Pendaftaran belum tersimpan.");
    } finally { setBusy(false); }
  };

  const content = (
    <div className="public-register">
      {!embeddedEvent && <nav aria-label="Navigasi pendaftaran" className="public-register__back"><Link to={`/events/${slug}`}><ArrowLeft aria-hidden="true" /> Informasi daurah</Link></nav>}
      <header ref={receiptHeadingRef} className="public-register__header scroll-mt-24">
        <div><p>{result ? "Bukti pendaftaran" : "Pendaftaran reguler"}</p>
          {embeddedEvent ? <h2>{result ? "Bukti pendaftaran" : "Daftar sebagai peserta"}</h2> : <h1>{result ? "Bukti pendaftaran" : event?.name || "Pendaftaran daurah"}</h1>}
          {!result && <span>Isi data Anda. Jika datang bersama asatidz lain, tambahkan anggota rombongan di bawah.</span>}
        </div>
      </header>
      {loading ? <p role="status" className="public-register__notice">Memuat informasi daurah…</p> : !event ? <p role="alert" className="public-register__error">{error || "Daurah tidak tersedia."}</p> : result ? (
        <PublicRegistrationReceipt event={event} participants={result.participants} emailQueued={result.emailQueued} approvalStatus={result.approvalStatus} />
      ) : !registration?.open ? <div className="public-register__notice" role="status"><strong>Formulir reguler belum dapat diisi.</strong><p>{registration?.reason}</p></div> : (
        <div className="public-register__layout">
          <section className="public-register__form-panel" aria-labelledby="register-data-title">
            <div className="public-register__form-heading"><div><h2 id="register-data-title">Data peserta pertama</h2><p>Nama yang mengisi formulir juga ikut terdaftar.</p></div><span>{delegates.length + 1} peserta</span></div>
            {error && <p ref={errorRef} tabIndex={-1} role="alert" className="public-register__error">{error}</p>}
            <form onSubmit={submit} className="public-register__form">
              <div className="public-register__field"><label htmlFor="register-name">Nama lengkap</label><input id="register-name" required minLength={3} maxLength={150} autoComplete="name" value={fullName} onChange={(input) => setFullName(input.target.value)} placeholder="Sesuai nama sehari-hari" /></div>
              <div className="public-register__field"><label htmlFor="register-email">Email pribadi</label><input id="register-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(input) => setEmail(input.target.value)} placeholder="nama@contoh.id" /><p>Email menjadi nama pengguna untuk masuk portal.</p></div>
              <div className="public-register__field"><label htmlFor="register-whatsapp">Nomor WhatsApp aktif</label><input id="register-whatsapp" required type="tel" inputMode="tel" autoComplete="tel" minLength={9} maxLength={20} pattern="[0-9+(). -]{9,20}" value={whatsapp} onChange={(input) => setWhatsapp(input.target.value)} placeholder="0812…" /></div>
              <div className="public-register__region"><h3>Domisili</h3><RegionFields prefix="register" value={region} onChange={setRegion} /></div>
              <details className="public-register__optional"><summary>Lembaga dan alamat <span>(opsional)</span></summary><div className="public-register__optional-fields"><div className="public-register__field"><label htmlFor="register-institution">Nama lembaga/komunitas</label><input id="register-institution" value={institutionName} onChange={(input) => setInstitutionName(input.target.value)} maxLength={180} placeholder="Jika mewakili lembaga" /></div><div className="public-register__field"><label htmlFor="register-address">Alamat domisili</label><textarea id="register-address" rows={3} maxLength={500} value={address} onChange={(input) => setAddress(input.target.value)} placeholder="Alamat ringkas" /></div></div></details>

              <section className="public-register__group" aria-labelledby="group-members-title">
                <div className="public-register__group-head"><div><Users aria-hidden="true" /><h3 id="group-members-title">Datang bersama rombongan?</h3><p>Tambahkan asatidz lain. Masing-masing mendapat QR dan akses portal pribadi.</p></div><button type="button" disabled={busy || delegates.length >= maxGroupSize - 1} onClick={addDelegate}><Plus aria-hidden="true" /> Tambah anggota</button></div>
                {delegates.map((delegate, index) => <fieldset key={delegate.id} className="public-register__member"><legend>Anggota {index + 2}</legend>
                  <button type="button" disabled={busy} onClick={() => { setConsent(false); setDelegates((current) => current.filter((item) => item.id !== delegate.id)); }} aria-label={`Hapus anggota ${index + 2}`}><Trash2 aria-hidden="true" /> Hapus</button>
                  <div className="public-register__field"><label htmlFor={`group-name-${delegate.id}`}>Nama lengkap</label><input id={`group-name-${delegate.id}`} required minLength={3} maxLength={150} autoComplete="off" value={delegate.fullName} onChange={(input) => setDelegates((current) => current.map((item) => item.id === delegate.id ? { ...item, fullName: input.target.value } : item))} /></div>
                  <div className="public-register__field"><label htmlFor={`group-email-${delegate.id}`}>Email pribadi</label><input id={`group-email-${delegate.id}`} type="email" required maxLength={254} autoComplete="off" value={delegate.email} onChange={(input) => setDelegates((current) => current.map((item) => item.id === delegate.id ? { ...item, email: input.target.value } : item))} /></div>
                  <div className="public-register__field"><label htmlFor={`group-whatsapp-${delegate.id}`}>Nomor WhatsApp</label><input id={`group-whatsapp-${delegate.id}`} type="tel" inputMode="tel" required minLength={9} maxLength={20} pattern="[0-9+(). -]{9,20}" autoComplete="off" value={delegate.whatsapp} onChange={(input) => setDelegates((current) => current.map((item) => item.id === delegate.id ? { ...item, whatsapp: input.target.value } : item))} /></div>
                  <div className="public-register__region"><h4>Domisili anggota</h4><RegionFields prefix={`group-${delegate.id}`} value={delegate.region} onChange={(next) => setDelegates((current) => current.map((item) => item.id === delegate.id ? { ...item, region: next } : item))} /></div>
                  <details className="public-register__optional"><summary>Alamat rinci <span>(opsional)</span></summary><div className="public-register__field"><label htmlFor={`group-address-${delegate.id}`}>Alamat domisili</label><textarea id={`group-address-${delegate.id}`} rows={2} maxLength={500} value={delegate.address} onChange={(input) => setDelegates((current) => current.map((item) => item.id === delegate.id ? { ...item, address: input.target.value } : item))} /></div></details>
                </fieldset>)}
                {delegates.length > 0 && <p className="public-register__group-tip">Domisili anggota baru mengikuti peserta pertama; ubah bila berbeda.</p>}
                <p className="public-register__group-limit">Batas satu pengiriman: {maxGroupSize} peserta, termasuk peserta pertama.</p>
              </section>

              <label className="public-register__consent"><input type="checkbox" required checked={consent} onChange={(input) => setConsent(input.target.checked)} /><span>{delegates.length ? "Saya telah mendapat izin dari anggota rombongan untuk mengirim data mereka dan akan membagikan QR serta sandi masing-masing secara pribadi." : "Saya setuju data saya digunakan panitia untuk pendaftaran dan informasi daurah ini."}</span></label>
              <div className="public-register__submit"><button disabled={busy} type="submit" className="public-register__primary">{busy ? "Menyimpan…" : `Daftarkan ${delegates.length + 1} ${delegates.length ? "orang" : "peserta"}`} <ArrowRight aria-hidden="true" /></button><p>Bukti pendaftaran langsung tersedia. QR presensi terbit setelah pendaftaran disetujui{event.attendanceConfirmationRequired !== false ? " dan Ustadz mengonfirmasi hadir" : ""}.</p></div>
            </form>
          </section>
          <aside className="public-register__aside"><h2>Sebelum mengirim</h2><ul><li>Periksa ejaan nama, email, dan WhatsApp tiap peserta.</li><li>Setiap asatidz menggunakan QR miliknya sendiri saat presensi.</li><li>Yang sudah terdaftar tidak perlu mendaftar ulang.</li></ul><Link to="/login/ustadz">Sudah terdaftar? Masuk portal</Link>{contactUrl && <a href={contactUrl} target="_blank" rel="noopener noreferrer">Butuh bantuan? WhatsApp panitia</a>}</aside>
        </div>
      )}
    </div>
  );
  return embeddedEvent ? content : <PublicLayout>{content}</PublicLayout>;
};
