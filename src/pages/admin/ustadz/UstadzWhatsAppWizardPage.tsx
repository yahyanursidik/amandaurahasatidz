/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · Workbench · calm-operational */
import React, { useEffect, useMemo, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, MessageCircle, RotateCcw, Search, SkipForward } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { UstadzWorkspaceNav } from "@/components/admin/ustadz/UstadzWorkspaceNav";
import type { AuthIdentity } from "@/lib/refine/authProvider";
import { normalizeWhatsAppNumber } from "@/lib/participantCommunication";
import { ustadzApi, type UstadzProfile } from "@/lib/ustadzApi";
import {
  createWhatsAppBatch, MAX_WHATSAPP_BATCH_RECIPIENTS, readWhatsAppBatch, renderWhatsAppBatchMessage,
  updateWhatsAppBatchStatus, validateWhatsAppBatchMessage, whatsappBatchProgress, whatsappBatchTemplateMessage,
  whatsappBatchTemplates, whatsappBatchUrl, WHATSAPP_BATCH_STORAGE_PREFIX,
  type WhatsAppBatch, type WhatsAppBatchTemplate,
} from "@/lib/ustadzWhatsAppBatch";

type Step = "MESSAGE" | "RECIPIENTS" | "SEND";

const contactNumber = (profile: UstadzProfile) => normalizeWhatsAppNumber(profile.whatsapp) || normalizeWhatsAppNumber(profile.phone);
const contactSource = (profile: UstadzProfile) => normalizeWhatsAppNumber(profile.whatsapp) ? "WhatsApp" : "Telepon cadangan";

export const UstadzWhatsAppWizardPage: React.FC = () => {
  const { data: identity, isLoading: identityLoading } = useGetIdentity<AuthIdentity>();
  const ownerId = identity?.id || "";
  const [profiles, setProfiles] = useState<UstadzProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [step, setStep] = useState<Step>("MESSAGE");
  const [batch, setBatch] = useState<WhatsAppBatch | null>(null);
  const [template, setTemplate] = useState<WhatsAppBatchTemplate>("PROFILE_GREETING");
  const [title, setTitle] = useState("Sapaan asatidz");
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState(() => whatsappBatchTemplateMessage("PROFILE_GREETING"));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"title" | "sender" | "message" | null>(null);
  const [storageWarning, setStorageWarning] = useState("");

  useEffect(() => { if (ownerId) setSenderName(identity?.name || ""); }, [ownerId]);
  useEffect(() => {
    if (!ownerId) return;
    let saved: WhatsAppBatch | null = null;
    try { saved = readWhatsAppBatch(window.localStorage, ownerId); }
    catch { setStorageWarning("Penyimpanan browser tidak tersedia. Progres hanya berlaku selama halaman ini terbuka."); }
    setBatch(saved);
    setSelectedIds([]);
    setStep(saved ? "SEND" : "MESSAGE");
    const onStorage = (event: StorageEvent) => {
      if (event.key !== `${WHATSAPP_BATCH_STORAGE_PREFIX}${ownerId}`) return;
      let updated: WhatsAppBatch | null = null;
      try { updated = readWhatsAppBatch(window.localStorage, ownerId); } catch { /* Storage is optional. */ }
      setBatch(updated);
      setStep(updated ? "SEND" : "MESSAGE");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [ownerId]);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError("");
    ustadzApi.listAllUnmerged().then((items) => {
      if (active) setProfiles(items.filter((item) => item.profileStatus === "ACTIVE" && !item.deletedAt));
    }).catch((cause) => {
      if (active) setLoadError(cause instanceof Error ? cause.message : "Daftar asatidz belum dapat dimuat.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const profilesById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const visibleProfiles = useMemo(() => profiles.filter((profile) => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return !query || [profile.fullName, profile.primaryInstitution?.institutionName, profile.email, profile.whatsapp, profile.phone]
      .some((value) => String(value || "").toLocaleLowerCase("id-ID").includes(query));
  }), [profiles, search]);
  const selectableVisible = visibleProfiles.filter((profile) => contactNumber(profile));
  const previewProfile = selectedIds.length ? profilesById.get(selectedIds[0]) : profiles.find((profile) => contactNumber(profile));
  const previewMessage = renderWhatsAppBatchMessage(message, previewProfile?.fullName || "penerima", senderName || "Admin");
  const progress = batch ? whatsappBatchProgress(batch) : null;
  const currentProfile = progress?.nextId ? profilesById.get(progress.nextId) : null;
  const currentMessage = batch && currentProfile ? renderWhatsAppBatchMessage(batch.message, currentProfile.fullName, batch.senderName) : "";
  const currentUrl = batch && currentProfile ? whatsappBatchUrl(contactNumber(currentProfile), currentMessage) : null;
  const currentStatus = batch && progress?.nextId ? batch.statusById[progress.nextId] : null;

  const persist = (next: WhatsAppBatch | null) => {
    setBatch(next);
    if (!ownerId) return;
    try {
      if (next) window.localStorage.setItem(`${WHATSAPP_BATCH_STORAGE_PREFIX}${ownerId}`, JSON.stringify(next));
      else window.localStorage.removeItem(`${WHATSAPP_BATCH_STORAGE_PREFIX}${ownerId}`);
      setStorageWarning("");
    } catch { setStorageWarning("Penyimpanan browser tidak tersedia. Jangan tutup halaman sebelum sesi selesai."); }
  };
  const changeStatus = (recipientId: string, status: "OPENED" | "MARKED_SENT" | "SKIPPED" | "PENDING") => {
    if (!batch) return;
    try { persist(updateWhatsAppBatchStatus(batch, recipientId, status)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Status penerima belum dapat diubah."); }
  };
  const selectTemplate = (next: WhatsAppBatchTemplate) => {
    setTemplate(next);
    const chosen = whatsappBatchTemplates.find((item) => item.id === next);
    setTitle(chosen?.label || "Pesan asatidz");
    setMessage(whatsappBatchTemplateMessage(next));
    setError(""); setErrorField(null);
  };
  const goToRecipients = () => {
    const issue = validateWhatsAppBatchMessage(message);
    if (issue) { setError(issue); setErrorField("message"); document.getElementById("wa-batch-message")?.focus(); return; }
    if (title.trim().length < 3 || title.trim().length > 100) { setError("Nama sesi perlu 3–100 karakter."); setErrorField("title"); document.getElementById("wa-batch-title")?.focus(); return; }
    if (senderName.trim().length < 3 || senderName.trim().length > 80) { setError("Nama pengirim perlu 3–80 karakter."); setErrorField("sender"); document.getElementById("wa-batch-sender")?.focus(); return; }
    setError(""); setErrorField(null); setStep("RECIPIENTS");
  };
  const toggleRecipient = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id)
      : current.length < MAX_WHATSAPP_BATCH_RECIPIENTS ? [...current, id] : current);
    if (selectedIds.length >= MAX_WHATSAPP_BATCH_RECIPIENTS && !selectedIds.includes(id)) setError(`Maksimal ${MAX_WHATSAPP_BATCH_RECIPIENTS} asatidz per sesi.`);
    else setError("");
  };
  const selectVisible = () => {
    const ids = selectableVisible.map((profile) => profile.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    if (allSelected) { setSelectedIds((current) => current.filter((id) => !ids.includes(id))); setError(""); return; }
    const available = MAX_WHATSAPP_BATCH_RECIPIENTS - selectedIds.length;
    const additional = ids.filter((id) => !selectedIds.includes(id));
    if (additional.length > available) { setError(`Hanya ${available} tempat tersisa. Persempit pencarian atau batalkan sebagian pilihan.`); return; }
    setSelectedIds((current) => [...new Set([...current, ...ids])]);
    setError("");
  };
  const startBatch = () => {
    if (!ownerId) { setError("Sesi admin belum terbaca. Muat ulang halaman lalu coba lagi."); return; }
    const eligible = selectedIds.filter((id) => {
      const profile = profilesById.get(id);
      return profile && contactNumber(profile);
    });
    if (eligible.length !== selectedIds.length) { setError("Ada penerima tanpa nomor aktif. Perbarui pilihan penerima."); return; }
    try {
      const next = createWhatsAppBatch({ id: crypto.randomUUID(), ownerId, title: title.trim(), template,
        message: message.trim(), senderName: senderName.trim(), recipientIds: eligible });
      persist(next); setStep("SEND"); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sesi belum dapat dimulai."); }
  };
  const clearBatch = () => {
    if (progress?.remaining && !window.confirm("Hapus sesi ini? Seluruh penanda progres di browser ini akan hilang.")) return;
    persist(null); setSelectedIds([]); setStep("MESSAGE"); setError("");
  };

  return <AdminLayout><div className="ustadz-workspace wa-batch">
    <PageHeader title="Hubungi asatidz via WhatsApp" description="Satu pesan, penerima terpilih, lalu kirim pribadi satu per satu."
      breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Asatidz", href: "/admin/ustadz" }, { label: "WhatsApp bertahap" }]}
      actions={<Link to="/admin/ustadz" className="ustadz-button ustadz-button--secondary"><ArrowLeft aria-hidden="true" /> Direktori</Link>} />
    <UstadzWorkspaceNav />
    <nav className="wa-batch__steps" aria-label="Tahapan menghubungi asatidz">
      {(["MESSAGE", "RECIPIENTS", "SEND"] as const).map((item, index) => <span key={item} data-active={step === item} aria-current={step === item ? "step" : undefined}>{index + 1}. {item === "MESSAGE" ? "Pesan" : item === "RECIPIENTS" ? "Penerima" : "Kirim"}</span>)}
    </nav>
    {storageWarning && <p className="wa-batch__alert" role="alert">{storageWarning}</p>}
    {error && <p className="wa-batch__alert" role="alert">{error}</p>}
    {!identityLoading && !ownerId && <p className="wa-batch__alert" role="alert">Identitas admin belum tersedia. Masuk ulang sebelum membuat sesi.</p>}

    {step === "MESSAGE" && <div className="wa-batch__workspace">
      <section className="wa-batch__editor" aria-labelledby="wa-batch-message-title">
        <div className="wa-batch__section-head"><h2 id="wa-batch-message-title">Tentukan pesannya</h2><p>Pesan yang sama dipersonalisasi dengan nama tiap asatidz.</p></div>
        <div className="wa-batch__field"><label htmlFor="wa-batch-template">Template</label><select id="wa-batch-template" value={template} onChange={(event) => selectTemplate(event.target.value as WhatsAppBatchTemplate)}>{whatsappBatchTemplates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><p>{whatsappBatchTemplates.find((item) => item.id === template)?.description}</p></div>
        <div className="wa-batch__field"><label htmlFor="wa-batch-title">Nama sesi (catatan admin)</label><input id="wa-batch-title" value={title} onChange={(event) => { setTitle(event.target.value); if (errorField === "title") { setError(""); setErrorField(null); } }} maxLength={100} aria-required="true" aria-invalid={errorField === "title"} aria-describedby="wa-batch-title-hint" /><p id="wa-batch-title-hint">{errorField === "title" ? error : "Tidak ditampilkan kepada penerima."}</p></div>
        <div className="wa-batch__field"><label htmlFor="wa-batch-sender">Nama pengirim</label><input id="wa-batch-sender" value={senderName} onChange={(event) => { setSenderName(event.target.value); if (errorField === "sender") { setError(""); setErrorField(null); } }} maxLength={80} placeholder="Nama admin yang menghubungi" aria-required="true" aria-invalid={errorField === "sender"} aria-describedby="wa-batch-sender-hint" /><p id="wa-batch-sender-hint">{errorField === "sender" ? error : "Muncul pada isi pesan."}</p></div>
        <div className="wa-batch__field"><label htmlFor="wa-batch-message">Isi pesan WhatsApp</label><textarea id="wa-batch-message" rows={11} value={message} onChange={(event) => { setMessage(event.target.value); if (errorField === "message") { setError(""); setErrorField(null); } }} maxLength={1500} aria-required="true" aria-invalid={errorField === "message"} aria-describedby="wa-batch-message-hint" /><p id="wa-batch-message-hint">{errorField === "message" ? error : <>Gunakan {"{{nama}}"} dan {"{{pengirim}}"} untuk nama penerima dan pengirim. {message.length}/1.500 karakter.</>}</p></div>
        <div className="wa-batch__actions"><button type="button" className="wa-batch__primary" onClick={goToRecipients}>Pilih penerima <ArrowRight aria-hidden="true" /></button></div>
      </section>
      <aside className="wa-batch__preview" aria-labelledby="wa-batch-preview-title"><h2 id="wa-batch-preview-title">Pratinjau pesan</h2><p>{previewProfile ? `Untuk ${previewProfile.fullName}` : "Nama contoh akan mengikuti penerima yang dipilih."}</p><pre>{previewMessage}</pre><small>WhatsApp terbuka sebagai draf. Admin mengirim pesan secara manual.</small></aside>
    </div>}

    {step === "RECIPIENTS" && <section className="wa-batch__recipients" aria-labelledby="wa-batch-recipients-title">
      <div className="wa-batch__section-head"><h2 id="wa-batch-recipients-title">Pilih penerima</h2><p>{selectedIds.length} dipilih · maksimal {MAX_WHATSAPP_BATCH_RECIPIENTS} per sesi</p></div>
      <div className="wa-batch__recipient-tools"><label className="wa-batch__search" htmlFor="wa-batch-search"><Search aria-hidden="true" /><input id="wa-batch-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, lembaga, atau nomor" /></label><button type="button" onClick={selectVisible} disabled={loading || selectableVisible.length === 0}>{selectableVisible.length > 0 && selectableVisible.every((profile) => selectedIds.includes(profile.id)) ? "Batalkan hasil" : "Pilih hasil"}</button></div>
      {loading ? <p className="wa-batch__notice" role="status">Memuat daftar asatidz…</p> : loadError ? <div className="wa-batch__notice" role="alert"><p>{loadError}</p><button type="button" onClick={() => setReload((value) => value + 1)}>Coba muat lagi</button></div> : <>
        <p className="wa-batch__summary">{selectableVisible.length} memiliki nomor yang dapat dibuka · {visibleProfiles.length - selectableVisible.length} tanpa nomor valid pada hasil ini. Nomor telepon cadangan perlu dipastikan terdaftar di WhatsApp.</p>
        <div className="wa-batch__recipient-list">{visibleProfiles.length === 0 ? <p className="wa-batch__notice">Tidak ada asatidz yang cocok. Ubah kata pencarian.</p> : visibleProfiles.map((profile) => {
          const number = contactNumber(profile);
          return <label key={profile.id} className="wa-batch__recipient" data-disabled={!number}>
            <input type="checkbox" checked={selectedIds.includes(profile.id)} disabled={!number} onChange={() => toggleRecipient(profile.id)} />
            <span><strong>{profile.fullName}</strong><small>{profile.primaryInstitution?.institutionName || "Tanpa afiliasi utama"}</small></span>
            <span className="wa-batch__recipient-contact">{number ? `${contactSource(profile)} · +${number}` : "Nomor WA belum valid"}</span>
          </label>;
        })}</div>
      </>}
      <div className="wa-batch__actions"><button type="button" className="wa-batch__secondary" onClick={() => { setStep("MESSAGE"); setError(""); }}>Ubah pesan</button><button type="button" className="wa-batch__primary" disabled={!selectedIds.length || loading || !!loadError || !ownerId} onClick={startBatch}>Mulai {selectedIds.length} penerima <ArrowRight aria-hidden="true" /></button></div>
    </section>}

    {step === "SEND" && batch && progress && <div className="wa-batch__send" aria-labelledby="wa-batch-send-title">
      <div className="wa-batch__section-head"><div><h2 id="wa-batch-send-title">{batch.title}</h2><p>Progres sesi hanya tersimpan di browser ini untuk akun admin yang sedang masuk. Hindari komputer bersama.</p></div><button type="button" className="wa-batch__text-button" onClick={clearBatch}>Hapus sesi</button></div>
      <div className="wa-batch__progress"><label htmlFor="wa-batch-progress">{progress.markedSent + progress.skipped} dari {progress.total} ditangani</label><progress id="wa-batch-progress" value={progress.markedSent + progress.skipped} max={progress.total} /><p>{progress.markedSent} ditandai terkirim · {progress.skipped} dilewati · {progress.remaining} belum selesai</p></div>
      {progress.nextId ? <div className="wa-batch__current">
        <div className="wa-batch__current-head"><div><span>Berikutnya</span><h3>{currentProfile?.fullName || "Profil tidak tersedia"}</h3><p>{currentProfile && contactNumber(currentProfile) ? `+${contactNumber(currentProfile)}` : "Nomor tidak tersedia. Lewati atau perbarui profil."}</p></div><span>{progress.total - progress.remaining + 1} / {progress.total}</span></div>
        <pre>{currentMessage || "Pesan tidak dapat disiapkan karena profil penerima berubah."}</pre>
        <div className="wa-batch__send-actions">{currentUrl ? <a href={currentUrl} target="_blank" rel="noopener noreferrer" onClick={() => { if (progress.nextId) changeStatus(progress.nextId, "OPENED"); }} className="wa-batch__primary"><MessageCircle aria-hidden="true" /> Buka WhatsApp</a> : <span className="wa-batch__notice">Nomor belum dapat dibuka di WhatsApp.</span>}
          <button type="button" className="wa-batch__primary" disabled={currentStatus !== "OPENED"} onClick={() => progress.nextId && changeStatus(progress.nextId, "MARKED_SENT")}><Check aria-hidden="true" /> Sudah kirim & lanjut</button>
          <button type="button" className="wa-batch__secondary" onClick={() => progress.nextId && changeStatus(progress.nextId, "SKIPPED")}><SkipForward aria-hidden="true" /> Lewati</button></div>
        <p className="wa-batch__caution">Membuka WhatsApp hanya membuat draf. Tekan “Sudah kirim & lanjut” setelah benar-benar mengirim. Sistem tidak dapat memverifikasi pengiriman WhatsApp.</p>
      </div> : <div className="wa-batch__notice" role="status"><strong>Semua penerima sudah ditangani.</strong><p>Periksa yang dilewati pada daftar di bawah sebelum membuat sesi baru.</p></div>}
      <section className="wa-batch__history" aria-labelledby="wa-batch-history-title"><h3 id="wa-batch-history-title">Daftar penerima</h3><ol>{batch.recipientIds.map((id, index) => {
        const person = profilesById.get(id);
        const status = batch.statusById[id];
        return <li key={id}><span>{index + 1}. {person?.fullName || "Profil tidak tersedia"}</span><strong data-status={status}>{status === "MARKED_SENT" ? "Ditandai terkirim" : status === "SKIPPED" ? "Dilewati" : status === "OPENED" ? "Tautan dibuka" : "Menunggu"}</strong>{["MARKED_SENT", "SKIPPED"].includes(status) && <button type="button" onClick={() => changeStatus(id, "PENDING")} aria-label={`Kembalikan ${person?.fullName || "penerima"} ke antrean`}><RotateCcw aria-hidden="true" /> Ulangi</button>}</li>;
      })}</ol></section>
      {!progress.remaining && <div className="wa-batch__actions"><button type="button" className="wa-batch__primary" onClick={clearBatch}>Buat sesi baru <ArrowRight aria-hidden="true" /></button></div>}
    </div>}
  </div></AdminLayout>;
};
