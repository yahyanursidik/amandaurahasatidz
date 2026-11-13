/* Hallmark · component: shared WhatsApp wizard · genre: modern-minimal · theme: existing emerald-slate
 * pre-emit critique: P5 H5 E4 S5 R5 V4
 * states: default · hover · focus · active · disabled · loading · error · success
 */
/* Shared WhatsApp workflow: the directory and event workspaces supply independent recipient sources. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, MessageCircle, RotateCcw, Search, SkipForward } from "lucide-react";
import { normalizeWhatsAppNumber } from "@/lib/participantCommunication";
import { participantSourceLabel } from "@/lib/participantCatalog";
import { registrationStatusHref } from "@/lib/registrationStatusLink";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { ustadzApi } from "@/lib/ustadzApi";
import {
  eventWhatsAppDateRange, eventWhatsAppCanConfirm, eventWhatsAppStage, eventWhatsAppStatusFilters,
  eventWhatsAppStatusLabel, isRepeatedEventWhatsAppNumber, type EventWhatsAppContext, type EventWhatsAppFilters, type WhatsAppWizardRecipient,
} from "@/lib/eventParticipantWhatsApp";
import { listEventWhatsAppRecipients, resolveEventWhatsAppRecipients } from "@/lib/eventParticipantWhatsAppApi";
import {
  createWhatsAppBatch, eventWhatsAppBatchTemplates, MAX_WHATSAPP_BATCH_RECIPIENTS, readWhatsAppBatch,
  renderWhatsAppBatchMessage, updateWhatsAppBatchStatus, validateWhatsAppBatchMessage, whatsappBatchProgress,
  whatsappBatchTemplateMessage, whatsappBatchTemplates, whatsappBatchUrl, whatsappBatchStorageKey,
  type WhatsAppBatch, type WhatsAppBatchTemplate,
} from "@/lib/ustadzWhatsAppBatch";

type Step = "MESSAGE" | "RECIPIENTS" | "SEND";
type Props = {
  ownerId: string;
  sender: string;
  event?: EventWhatsAppContext;
  initialFilters?: EventWhatsAppFilters;
};

function registrationStatusLink(person?: WhatsAppWizardRecipient | null) {
  return typeof window === "undefined" ? null : registrationStatusHref(person?.registrationStatusUrl, window.location.origin);
}

export function WhatsAppBatchWizard({ ownerId, sender, event, initialFilters }: Props) {
  const eventId = event?.id;
  const [eventContext, setEventContext] = useState(event);
  const templates = eventId ? eventWhatsAppBatchTemplates : whatsappBatchTemplates;
  const initialTemplate = templates[0].id;
  const [step, setStep] = useState<Step>("MESSAGE");
  const [batch, setBatch] = useState<WhatsAppBatch | null>(null);
  const [template, setTemplate] = useState<WhatsAppBatchTemplate>(initialTemplate);
  const [title, setTitle] = useState(templates[0].label);
  const [senderName, setSenderName] = useState(sender);
  const [message, setMessage] = useState(() => whatsappBatchTemplateMessage(initialTemplate, Boolean(eventId)));
  const [selected, setSelected] = useState<WhatsAppWizardRecipient[]>([]);
  const [profiles, setProfiles] = useState<WhatsAppWizardRecipient[]>([]);
  const [verified, setVerified] = useState<{ key: string; recipients: WhatsAppWizardRecipient[]; error?: string }>({ key: "", recipients: [] });
  const history = useRef<{ batchId: string; recipients: WhatsAppWizardRecipient[] }>({ batchId: "", recipients: [] });
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<EventWhatsAppFilters>(initialFilters ?? { search: "", source: "ALL", status: "ALL" });
  const [reload, setReload] = useState(0);
  const [checking, setChecking] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loaded, setLoaded] = useState("");
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<"title" | "sender" | "message" | null>(null);
  const [storageWarning, setStorageWarning] = useState("");
  const startRequest = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const debouncedSearch = useDebouncedValue(filters.search.trim());
  const storageKey = whatsappBatchStorageKey(ownerId, eventId);
  const isConfirmation = template === "EVENT_CONFIRMATION";
  const activeStatus = isConfirmation ? "AWAITING_CONFIRMATION" : filters.status;
  const listKey = eventId ? JSON.stringify([eventId, page, debouncedSearch, activeStatus, filters.source, filters.institutionId, filters.invitationId, reload]) : String(reload);
  const listReady = loaded === listKey && (!eventId || filters.search.trim() === debouncedSearch);
  const progress = batch ? whatsappBatchProgress(batch) : null;
  const activeId = progress?.nextId || null;
  const batchIds = batch?.recipientIds;
  const checkKey = batch ? JSON.stringify([batch.id, activeId, reload]) : "";
  const needsLink = batch?.template === "EVENT_CONFIRMATION";

  useEffect(() => {
    const restore = () => {
      try {
        const saved = readWhatsAppBatch(window.localStorage, ownerId, eventId);
        setBatch(saved);
        if (saved) setStep("SEND");
        else setStep((old) => old === "SEND" ? "MESSAGE" : old);
      } catch { setStorageWarning("Progres hanya berlaku selama halaman ini terbuka."); }
    };
    const onStorage = (change: StorageEvent) => { if (change.key === storageKey) restore(); };
    restore();
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      startRequest.current?.abort();
    };
  }, [ownerId, eventId, storageKey]);

  useEffect(() => {
    if (moved.current) { heading.current?.focus(); moved.current = false; }
  }, [step]);

  useEffect(() => {
    // The event performs no contact queries while composing, and only one page is loaded.
    if (eventId ? step !== "RECIPIENTS" : loaded === listKey && !loadError) return;
    if (eventId && filters.search.trim() !== debouncedSearch) return;
    const controller = new AbortController();
    setLoadError("");
    const request = eventId
      ? listEventWhatsAppRecipients(eventId, { ...filters, search: debouncedSearch, status: activeStatus }, page, controller.signal)
      : ustadzApi.listAllUnmerged({ signal: controller.signal }).then((items) => ({
        recipients: items.filter((person) => person.profileStatus === "ACTIVE" && !person.deletedAt).map((person): WhatsAppWizardRecipient => {
          const preferred = normalizeWhatsAppNumber(person.whatsapp);
          const number = preferred || normalizeWhatsAppNumber(person.phone);
          return { id: person.id, fullName: person.fullName, institutionName: person.primaryInstitution?.institutionName || null,
            number, numberSource: preferred ? "WhatsApp" : number ? "Telepon cadangan" : null, email: person.email };
        }), hasNext: false,
      }));
    void request.then((result) => {
      if (!controller.signal.aborted) {
        setProfiles(result.recipients); setHasNext(result.hasNext); setLoaded(listKey);
      }
    }).catch((cause) => {
      if (!controller.signal.aborted) {
        setLoadError(cause instanceof Error ? cause.message : "Daftar penerima belum dapat dimuat.");
        setProfiles([]); setLoaded(listKey);
      }
    });
    return () => controller.abort();
  // listKey includes every server-side filter. Directory search is entirely local.
  }, [eventId, eventId ? step : "DIRECTORY", listKey, eventId ? filters.search : "", debouncedSearch && Boolean(eventId)]);

  useEffect(() => {
    if (step !== "SEND" || !eventId || !batchIds?.length) return;
    const controller = new AbortController();
    const prior = history.current.batchId === batch?.id ? history.current.recipients : null;
    if (!activeId && prior) {
      setVerified({ key: checkKey, recipients: prior });
      return;
    }
    // Read the whole bounded queue once to restore labels; check only the current contact thereafter.
    const ids = prior && activeId ? [activeId] : batchIds;
    void resolveEventWhatsAppRecipients(eventId, ids, needsLink, controller.signal, needsLink ? activeId || undefined : undefined)
      .then((result) => {
        if (controller.signal.aborted) return;
        setEventContext(result.event);
        const recipients = prior ? [...prior.filter((person) => !ids.includes(person.id)), ...result.recipients] : result.recipients;
        history.current = { batchId: batch!.id, recipients: recipients.map(({ registrationStatusUrl: _, ...person }) => person) };
        setVerified({ key: checkKey, recipients });
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setVerified({ key: checkKey, recipients: prior?.filter((person) => person.id !== activeId) ?? [],
          error: cause instanceof Error ? cause.message : "Kontak peserta belum dapat diperiksa." });
      });
    return () => controller.abort();
  }, [eventId, step, checkKey]);

  const visibleProfiles = useMemo(() => {
    if (eventId) return listReady && !loadError ? profiles : [];
    const query = filters.search.trim().toLocaleLowerCase("id-ID");
    return profiles.filter((person) => !query || [person.fullName, person.institutionName, person.email, person.number]
      .some((value) => String(value || "").toLocaleLowerCase("id-ID").includes(query)));
  }, [profiles, eventId, listReady, filters.search, loadError]);
  const profilesById = useMemo(() => new Map(profiles.map((person) => [person.id, person])), [profiles]);
  const selectedIds = selected.map((person) => person.id);
  const batchContacts = useMemo(() => new Map(verified.recipients.map((person) => [person.id, person])), [verified.recipients]);
  const latestVerified = !eventId || verified.key === checkKey;
  const activePerson = activeId && latestVerified ? (eventId ? batchContacts : profilesById).get(activeId) : null;
  const currentLoading = Boolean(activeId && (eventId ? !latestVerified : !listReady));
  const sendError = eventId ? latestVerified ? verified.error : undefined : loadError;
  const currentStatus = batch && activeId ? batch.statusById[activeId] : null;
  const canChoose = (person: WhatsAppWizardRecipient, choice = template) => Boolean(person.number &&
    (choice !== "EVENT_CONFIRMATION" || (person.numberSource === "WhatsApp" && eventContext &&
      eventWhatsAppStage(person, eventContext) === "AWAITING_CONFIRMATION")));
  const selectableVisible = visibleProfiles.filter((person) => canChoose(person));
  const previewProfile = selected[0] || visibleProfiles.find((person) => canChoose(person));
  const matchingNumber = eventId && activePerson && batch && isRepeatedEventWhatsAppNumber(activePerson, verified.recipients, batch.statusById);

  const eventVariables = (person: WhatsAppWizardRecipient | null | undefined, preview = false): Record<string, string> => {
    if (!eventContext) return {};
    const rundownPath = `/events/${encodeURIComponent(eventContext.slug)}#jadwal-kegiatan`;
    const hasPublicPage = eventContext.slug && ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED"].includes(eventContext.status);
    const rundown = hasPublicPage ? (typeof window === "undefined" ? rundownPath : new URL(rundownPath, window.location.origin).href) : "Lihat jadwal di Portal Asatidz.";
    return {
      event: eventContext.name, kode: person?.participantCode || "kode pendaftaran",
      tanggal: eventWhatsAppDateRange(eventContext), lokasi: eventContext.venueName || "menyusul",
      rundown, tautan_status: preview ? "[tautan pribadi peserta]" : registrationStatusLink(person) || "",
    };
  };
  const previewMessage = renderWhatsAppBatchMessage(message, previewProfile?.fullName || "penerima", senderName || "Admin", eventVariables(previewProfile, true));
  const currentUrl = batch && activePerson?.number && !sendError && !matchingNumber && (!needsLink || registrationStatusLink(activePerson))
    ? whatsappBatchUrl(activePerson.number, renderWhatsAppBatchMessage(batch.message, activePerson.fullName, batch.senderName, eventVariables(activePerson))) : null;
  const liveMessage = batch && activePerson
    ? renderWhatsAppBatchMessage(batch.message, activePerson.fullName, batch.senderName, eventVariables(activePerson, Boolean(needsLink))) : "";

  const persist = (next: WhatsAppBatch | null) => {
    setBatch(next);
    try {
      if (next) window.localStorage.setItem(storageKey, JSON.stringify(next));
      else window.localStorage.removeItem(storageKey);
      setStorageWarning("");
    } catch { setStorageWarning("Penyimpanan browser tidak tersedia. Jangan tutup halaman sebelum sesi selesai."); }
  };
  const changeStep = (next: Step) => { moved.current = true; setStep(next); setError(""); setErrorField(null); };
  const changeStatus = (id: string, status: "OPENED" | "MARKED_SENT" | "SKIPPED" | "PENDING") => {
    if (!batch) return;
    try { persist(updateWhatsAppBatchStatus(batch, id, status)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Status penerima belum dapat diubah."); }
  };
  const selectTemplate = (next: WhatsAppBatchTemplate) => {
    setTemplate(next);
    setTitle(templates.find((item) => item.id === next)?.label || "Pesan asatidz");
    setMessage(whatsappBatchTemplateMessage(next, Boolean(eventId)));
    if (next !== template && (next === "EVENT_CONFIRMATION" || template === "EVENT_CONFIRMATION")) { setSelected([]); setPage(1); }
    setError(""); setErrorField(null);
  };
  const goToRecipients = () => {
    const fields = [
      ["message", validateWhatsAppBatchMessage(message, { eventId, template })],
      ["title", title.trim().length < 3 || title.trim().length > 100 ? "Nama sesi perlu 3–100 karakter." : null],
      ["sender", senderName.trim().length < 3 || senderName.trim().length > 80 ? "Nama pengirim perlu 3–80 karakter." : null],
    ] as const;
    const issue = fields.find(([, text]) => text);
    if (issue) { setError(issue[1]!); setErrorField(issue[0]); document.getElementById(`wa-batch-${issue[0]}`)?.focus(); return; }
    changeStep("RECIPIENTS");
  };
  const changeFilters = (partial: Partial<EventWhatsAppFilters>) => {
    setFilters((old) => ({ ...old, ...partial })); setPage(1); setError("");
  };
  const addRecipients = (people: WhatsAppWizardRecipient[]) => {
    const numbers = new Set(eventId ? selected.map((person) => person.number) : []);
    const ids = new Set(selectedIds);
    const accepted: WhatsAppWizardRecipient[] = [];
    let duplicate = 0;
    let overflow = false;
    for (const person of people) {
      if (ids.has(person.id) || !canChoose(person)) continue;
      if (eventId && numbers.has(person.number)) { duplicate++; continue; }
      if (selected.length + accepted.length >= MAX_WHATSAPP_BATCH_RECIPIENTS) { overflow = true; break; }
      accepted.push(person); numbers.add(person.number);
    }
    setSelected([...selected, ...accepted]);
    setError(overflow ? "Batas 100 penerima tercapai. Selesaikan sesi ini sebelum membuat sesi berikutnya."
      : duplicate ? `${duplicate} pilihan memakai nomor yang sudah dipilih. Hubungi satu orang per nomor dalam satu sesi.` : "");
  };
  const toggleRecipient = (person: WhatsAppWizardRecipient) => {
    if (selectedIds.includes(person.id)) { setSelected((old) => old.filter((item) => item.id !== person.id)); setError(""); }
    else addRecipients([person]);
  };
  const selectVisible = () => {
    if (selectableVisible.every((person) => selectedIds.includes(person.id))) {
      const visibleIds = new Set(selectableVisible.map((person) => person.id));
      setSelected((old) => old.filter((person) => !visibleIds.has(person.id))); setError("");
    } else addRecipients(selectableVisible);
  };
  const startBatch = async () => {
    if (checking || startRequest.current) return;
    const controller = new AbortController();
    startRequest.current = controller; setChecking(true); setError("");
    try {
      let valid = selected;
      if (eventId) {
        const result = await resolveEventWhatsAppRecipients(eventId, selectedIds, isConfirmation, controller.signal);
        if (controller.signal.aborted) return;
        setEventContext(result.event);
        const numbers = new Set<string>();
        valid = result.recipients.filter((person) => {
          if (!person.number || numbers.has(person.number) || isConfirmation && !person.confirmationAvailable) return false;
          numbers.add(person.number);
          return true;
        });
        if (valid.length !== selected.length) {
          setSelected(valid);
          setError("Sebagian peserta tidak memenuhi syarat atau memakai nomor bersama. Periksa pilihan terbaru sebelum memulai.");
          return;
        }
      }
      const next = createWhatsAppBatch({ id: crypto.randomUUID(), ownerId, eventId, title: title.trim(), template,
        message: message.trim(), senderName: senderName.trim(), recipientIds: valid.map((person) => person.id) });
      history.current = { batchId: next.id, recipients: valid };
      persist(next); changeStep("SEND");
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Sesi belum dapat dimulai.");
    } finally {
      if (startRequest.current === controller) startRequest.current = null;
      if (!controller.signal.aborted) setChecking(false);
    }
  };

  const clearBatch = () => {
    if (progress?.remaining && !window.confirm("Hapus sesi ini? Penanda progres pada browser ini akan hilang.")) return;
    persist(null); history.current = { batchId: "", recipients: [] }; setVerified({ key: "", recipients: [] });
    setSelected([]); setLoadError(""); changeStep("MESSAGE");
  };

  return <div className="wa-batch">
    <nav className="wa-batch__steps" aria-label="Tahapan WhatsApp bertahap">
      {(["MESSAGE", "RECIPIENTS", "SEND"] as const).map((item, index) => <span key={item} data-active={step === item} aria-current={step === item ? "step" : undefined}>{index + 1}. {item === "MESSAGE" ? "Pesan" : item === "RECIPIENTS" ? "Penerima" : "Kirim"}</span>)}
    </nav>
    {storageWarning && <p className="wa-batch__alert" role="alert">{storageWarning}</p>}
    {error && <p className="wa-batch__alert" role="alert">{error}</p>}

    {step === "MESSAGE" && <div className="wa-batch__workspace">
      <section className="wa-batch__editor" aria-labelledby="wa-batch-message-title">
        <div className="wa-batch__section-head"><h2 ref={heading} tabIndex={-1} id="wa-batch-message-title">Tentukan pesannya</h2><p>Pesan dipersonalisasi untuk setiap penerima.</p></div>
        <div className="wa-batch__field"><label htmlFor="wa-batch-template">Template</label>
          <select id="wa-batch-template" value={template} onChange={(change) => selectTemplate(change.target.value as WhatsAppBatchTemplate)}>
            {templates.map((item) => <option key={item.id} value={item.id} disabled={item.id === "EVENT_CONFIRMATION" && Boolean(eventContext && !eventWhatsAppCanConfirm(eventContext))}>{item.label}</option>)}
          </select><p>{templates.find((item) => item.id === template)?.description}</p>
        </div>
        <div className="wa-batch__field"><label htmlFor="wa-batch-title">Nama sesi (catatan admin)</label><input id="wa-batch-title" value={title} onChange={(change) => { setTitle(change.target.value); if (errorField === "title") { setError(""); setErrorField(null); } }} maxLength={100} aria-required="true" aria-invalid={errorField === "title"} aria-describedby="wa-batch-title-hint" /><p id="wa-batch-title-hint">{errorField === "title" ? error : "Tidak ditampilkan kepada penerima."}</p></div>
        <div className="wa-batch__field"><label htmlFor="wa-batch-sender">Nama pengirim</label><input id="wa-batch-sender" value={senderName} onChange={(change) => { setSenderName(change.target.value); if (errorField === "sender") { setError(""); setErrorField(null); } }} maxLength={80} placeholder="Nama admin yang menghubungi" aria-required="true" aria-invalid={errorField === "sender"} aria-describedby="wa-batch-sender-hint" /><p id="wa-batch-sender-hint">{errorField === "sender" ? error : "Muncul pada isi pesan."}</p></div>
        <div className="wa-batch__field"><label htmlFor="wa-batch-message">Isi pesan WhatsApp</label><textarea id="wa-batch-message" rows={10} value={message} onChange={(change) => { setMessage(change.target.value); if (errorField === "message") { setError(""); setErrorField(null); } }} maxLength={1500} aria-required="true" aria-invalid={errorField === "message"} aria-describedby="wa-batch-message-hint" />
          <p id="wa-batch-message-hint">{errorField === "message" ? error : <>Variabel: {"{{nama}}, {{pengirim}}"}{eventId && ", {{event}}, {{kode}}, {{tanggal}}, {{lokasi}}, {{rundown}}"}{isConfirmation && ", {{tautan_status}}"}. {message.length}/1.500 karakter.</>}</p>
        </div>
        <div className="wa-batch__actions"><button type="button" className="wa-batch__primary" onClick={goToRecipients}>Pilih penerima <ArrowRight aria-hidden="true" /></button></div>
      </section>
      <aside className="wa-batch__preview" aria-labelledby="wa-batch-preview-title"><h2 id="wa-batch-preview-title">Pratinjau pesan</h2><p>{previewProfile ? `Untuk ${previewProfile.fullName}` : "Nama mengikuti peserta yang dipilih."}</p><pre>{previewMessage}</pre><small>WhatsApp membuka draf. Admin mengirim pesan secara manual.</small></aside>
    </div>}

    {step === "RECIPIENTS" && <section className="wa-batch__recipients" aria-labelledby="wa-batch-recipients-title">
      <div className="wa-batch__section-head"><h2 ref={heading} tabIndex={-1} id="wa-batch-recipients-title">Pilih penerima</h2><p role="status">{selected.length} dipilih · maksimal {MAX_WHATSAPP_BATCH_RECIPIENTS} per sesi</p></div>
      <div className="wa-batch__recipient-tools">
        <label className="wa-batch__search"><span className="sr-only">Cari penerima</span><Search aria-hidden="true" /><input id="wa-batch-search" value={filters.search} maxLength={100} disabled={checking} onChange={(change) => changeFilters({ search: change.target.value })} placeholder={eventId ? "Nama, kode, atau lembaga" : "Nama, lembaga, atau nomor"} /></label>
        <button type="button" onClick={selectVisible} disabled={checking || !listReady || selectableVisible.length === 0}>{selectableVisible.length > 0 && selectableVisible.every((person) => selectedIds.includes(person.id)) ? "Batalkan hasil" : eventId ? "Pilih halaman" : "Pilih hasil"}</button>
      </div>
      {eventId && <div className="wa-batch__filters">
        <label className="wa-batch__field">Jalur pendaftaran<select value={filters.source} disabled={checking} onChange={(change) => changeFilters({ source: change.target.value as EventWhatsAppFilters["source"] })}>
          <option value="ALL">Semua jalur</option><option value="REGULAR">Reguler</option><option value="INSTITUTION">Undangan lembaga</option><option value="INDIVIDUAL">Undangan perorangan</option>
        </select></label>
        <label className="wa-batch__field">Status peserta<select value={activeStatus} disabled={checking || isConfirmation} onChange={(change) => changeFilters({ status: change.target.value as EventWhatsAppFilters["status"] })}>
          {eventWhatsAppStatusFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        {(filters.institutionId || filters.invitationId) && <div className="wa-batch__notice wa-batch__scope"><span>{filters.invitationId ? "Undangan terpilih" : "Lembaga terpilih"}</span><button type="button" disabled={checking} onClick={() => changeFilters({ institutionId: undefined, invitationId: undefined })}>Lepas filter</button></div>}
      </div>}
      {isConfirmation && <p className="wa-batch__summary">Hanya peserta disetujui yang belum mengonfirmasi dan memiliki nomor WhatsApp pribadi yang dapat dipilih.</p>}
      {selected.length > 0 && <details className="wa-batch__selected">
        <summary>Lihat {selected.length} pilihan</summary>
        <ul>{selected.map((person) => <li key={person.id}><span>{person.fullName} {person.participantCode && `· ${person.participantCode}`}</span><button className="wa-batch__secondary" type="button" disabled={checking} onClick={() => toggleRecipient(person)} aria-label={`Hapus ${person.fullName} dari pilihan`}>Hapus</button></li>)}</ul>
        <button type="button" className="wa-batch__secondary" disabled={checking} onClick={() => { setSelected([]); setError(""); }}>Kosongkan pilihan</button>
      </details>}
      {!listReady ? <p className="wa-batch__notice" role="status">Memuat daftar penerima…</p> : loadError ? <div className="wa-batch__notice" role="alert"><p>{loadError}</p><button type="button" onClick={() => setReload((value) => value + 1)}>Coba muat lagi</button></div> : <>
        <p className="wa-batch__summary">{selectableVisible.length} dapat dipilih · {visibleProfiles.length - selectableVisible.length} tidak memenuhi syarat pada {eventId ? "halaman" : "hasil"} ini.</p>
        <div className="wa-batch__recipient-list">{visibleProfiles.length === 0 ? <p className="wa-batch__notice">{isConfirmation ? "Tidak ada peserta yang menunggu konfirmasi pada filter ini." : "Tidak ada penerima yang cocok. Ubah pencarian atau filter."}</p> : visibleProfiles.map((person) => {
          const selectable = canChoose(person);
          return <label key={person.id} className="wa-batch__recipient" data-disabled={!selectable}>
            <input type="checkbox" checked={selectedIds.includes(person.id)} disabled={!selectable || checking} onChange={() => toggleRecipient(person)} />
            <span><strong>{person.fullName}</strong><small>{[person.participantCode, person.institutionName, eventContext ? participantSourceLabel(person.registrationSource) : null].filter(Boolean).join(" · ") || "Tanpa afiliasi utama"}</small>
              {eventContext && <small>{eventWhatsAppStatusLabel(person, eventContext)}</small>}</span>
            <span className="wa-batch__recipient-contact">{person.number ? `${person.numberSource} · +${person.number}${!selectable ? " (tidak memenuhi syarat)" : ""}` : "Nomor WA belum valid"}</span>
          </label>;
        })}</div>
        {eventId && (page > 1 || hasNext) && <div className="wa-batch__paging"><button type="button" className="wa-batch__secondary" disabled={checking || page <= 1} onClick={() => setPage((old) => old - 1)}>Sebelumnya</button><span>Halaman {page}</span><button type="button" className="wa-batch__secondary" disabled={checking || !hasNext} onClick={() => setPage((old) => old + 1)}>Berikutnya</button></div>}
      </>}
      <div className="wa-batch__actions"><button type="button" className="wa-batch__secondary" disabled={checking} onClick={() => changeStep("MESSAGE")}>Ubah pesan</button><button type="button" className="wa-batch__primary" disabled={!selected.length || !listReady || !!loadError || checking} onClick={() => void startBatch()}>{checking ? "Memeriksa peserta…" : `Mulai ${selected.length} penerima`} <ArrowRight aria-hidden="true" /></button></div>
    </section>}

    {step === "SEND" && batch && progress && <div className="wa-batch__send" aria-labelledby="wa-batch-send-title">
      <div className="wa-batch__section-head"><div><h2 ref={heading} tabIndex={-1} id="wa-batch-send-title">{batch.title}</h2><p>Progres tersimpan di browser ini untuk akun yang sedang masuk{eventId ? " dan event ini" : ""}. Hindari komputer bersama.</p></div><button type="button" className="wa-batch__text-button" disabled={checking} onClick={clearBatch}>Hapus sesi</button></div>
      <div className="wa-batch__progress"><label htmlFor="wa-batch-progress">{progress.markedSent + progress.skipped} dari {progress.total} ditangani</label><progress id="wa-batch-progress" value={progress.markedSent + progress.skipped} max={progress.total} /><p role="status">{progress.markedSent} ditandai terkirim · {progress.skipped} dilewati · {progress.remaining} belum selesai</p></div>
      {activeId ? <div className="wa-batch__current">
        <div className="wa-batch__current-head"><div><span>Berikutnya</span><h3>{currentLoading ? "Memeriksa penerima…" : activePerson?.fullName || "Penerima tidak tersedia"}</h3><p>{activePerson?.number ? `+${activePerson.number} · ${activePerson.numberSource}` : "Nomor tidak tersedia."}</p></div><span>{progress.total - progress.remaining + 1} / {progress.total}</span></div>
        {sendError && !currentLoading && <div className="wa-batch__notice" role="alert"><p>{sendError}</p><button type="button" onClick={() => setReload((value) => value + 1)}>Periksa lagi</button></div>}
        {liveMessage && <pre>{liveMessage}</pre>}
        <div className="wa-batch__send-actions">
          {currentUrl ? <a href={currentUrl} target="_blank" rel="noopener noreferrer" onClick={() => changeStatus(activeId, "OPENED")} className={currentStatus === "OPENED" ? "wa-batch__secondary" : "wa-batch__primary"}><MessageCircle aria-hidden="true" /> Buka WhatsApp</a>
            : !currentLoading && !sendError && <span className="wa-batch__notice">{matchingNumber ? "Nomor ini sudah ditandai terkirim untuk peserta lain dalam sesi ini."
              : activePerson?.sharedNumber ? "Tautan pribadi tidak disiapkan karena nomor ini tercatat untuk beberapa peserta."
                : needsLink ? "Peserta tidak lagi memerlukan konfirmasi atau tautan tidak dapat dibagikan ke nomor ini." : "Nomor belum dapat dibuka di WhatsApp."}</span>}
          <button type="button" className={currentStatus === "OPENED" ? "wa-batch__primary" : "wa-batch__secondary"} disabled={currentStatus !== "OPENED" || currentLoading} onClick={() => changeStatus(activeId, "MARKED_SENT")}><Check aria-hidden="true" /> Sudah kirim & lanjut</button>
          <button type="button" className="wa-batch__secondary" disabled={currentLoading} onClick={() => changeStatus(activeId, "SKIPPED")}><SkipForward aria-hidden="true" /> Lewati</button>
        </div>
        <p className="wa-batch__caution">Tekan “Sudah kirim & lanjut” setelah mengirim di WhatsApp. Sistem tidak memverifikasi pengiriman.</p>
      </div> : <div className="wa-batch__notice" role="status"><strong>Semua penerima sudah ditangani.</strong><p>Periksa yang dilewati sebelum membuat sesi baru.</p></div>}
      <section className="wa-batch__history" aria-labelledby="wa-batch-history-title"><h3 id="wa-batch-history-title">Daftar penerima</h3><ol>{batch.recipientIds.map((id, index) => {
        const person = (eventId ? batchContacts : profilesById).get(id) || selected.find((item) => item.id === id);
        const status = batch.statusById[id];
        return <li key={id}><span>{index + 1}. {person?.fullName || "Penerima sesi"}</span><strong data-status={status}>{status === "MARKED_SENT" ? "Ditandai terkirim" : status === "SKIPPED" ? "Dilewati" : status === "OPENED" ? "Tautan dibuka" : "Menunggu"}</strong>{["MARKED_SENT", "SKIPPED"].includes(status) && <button type="button" disabled={checking} onClick={() => changeStatus(id, "PENDING")} aria-label={`Kembalikan ${person?.fullName || "penerima"} ke antrean`}><RotateCcw aria-hidden="true" /> Ulangi</button>}</li>;
      })}</ol></section>
      {!progress.remaining && <div className="wa-batch__actions"><button type="button" className="wa-batch__primary" onClick={clearBatch}>Buat sesi baru <ArrowRight aria-hidden="true" /></button></div>}
    </div>}
  </div>;
}
