/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 * Hallmark · macrostructure: Feature Stack · tone: utilitarian-professional · anchor hue: teal
 * Hallmark · responsive fallback: stacked controls followed by participant stream
 * privacy: contact data is shown only inside the protected committee portal
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useGetIdentity } from "@refinedev/core";
import {
  AlertCircle,
  ArrowDownAZ,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Contact,
  Download,
  FilterX,
  ListChecks,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import { CommitteeLayout } from "@/components/layouts/CommitteeLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge, type StatusVariant } from "@/components/common/StatusBadge";
import { ParticipantCommunicationPanel } from "@/components/communications/ParticipantCommunicationPanel";
import { ParticipantProfileDialog } from "@/components/participants/ParticipantProfileDialog";
import { ParticipantManagementDialog } from "@/components/participants/ParticipantManagementDialog";
import { ParticipantPortalAccessAction } from "@/components/participants/ParticipantPortalAccessAction";
import { eventApi, eventApiEnvelope } from "@/lib/eventApi";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { approvalSelectionCandidate, emptyParticipantSummary, participantSourceCategory, participantSourceLabel, type ParticipantSourceFilter, type ParticipantPageMeta, type ApprovalSelectionCandidate } from "@/lib/participantCatalog";
import { availableParticipantCommands, participantStaffPermissions } from "@/lib/participantManagement";
import type { AuthIdentity } from "@/lib/refine/authProvider";
import { canApproveParticipant, runParticipantBulkApproval, selectionAfterBulkApproval, type BulkApprovalResponse } from "@/lib/participantBulkApproval";
import { getMissingParticipantContactFields } from "@/lib/participantCommunication";
import { participantResolutionHint } from "@/lib/participantResolution";

type EventSummary = {
  id: string;
  name: string;
  code: string;
  status: string;
  startDate: string;
  endDate: string;
  venueName: string | null;
  venueAddress: string | null;
};

type CommitteeParticipant = {
  id: string;
  ustadzId: string;
  ustadzName: string;
  ustadzEmail: string | null;
  ustadzPhone: string | null;
  ustadzWhatsapp: string | null;
  ustadzAddress: string | null;
  participantCode: string;
  publicGroupId?: string | null;
  isDelegationLead?: boolean;
  institutionName: string | null;
  approvalStatus: string;
  confirmationStatus: string;
  confirmationStatusReason?: string | null;
  statusReason?: string | null;
  eventName?: string | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  eventVenueName?: string | null;
  eventVenueAddress?: string | null;
  registrationSource: string | null;
  registeredAt: string | null;
  portalUserId?: string | null;
  portalAccountStatus?: string | null;
  portalPasswordConfigured?: boolean | null;
};

type Decision = "approve" | "waitlist" | "decline" | "cancel";
type DecisionRequest = { participant: CommitteeParticipant; decision: Decision } | null;
type StatusFilter = "ALL" | "NEEDS_ACTION" | "AWAITING_CONFIRMATION" | "PENDING_REVIEW" | "APPROVED" | "WAITLISTED" | "DECLINED" | "CANCELLED";
type ContactFilter = "ALL" | "COMPLETE" | "INCOMPLETE" | "NO_WHATSAPP" | "NO_PORTAL";
type SortOption = "PRIORITY" | "NEWEST" | "OLDEST" | "NAME";

const previewEvent: EventSummary = {
  id: "committee-preview-event",
  name: "Contoh Daurah Asatidz",
  code: "DAURAH-2026",
  status: "ONGOING",
  startDate: "2026-08-15",
  endDate: "2026-08-18",
  venueName: "Masjid Al-Furqan",
  venueAddress: "Bandung, Jawa Barat",
};

const previewParticipants: CommitteeParticipant[] = [
  {
    id: "committee-preview-participant-1",
    ustadzId: "ustadz-preview-1",
    ustadzName: "Ustadz Abdullah, Lc.",
    ustadzEmail: "abdullah@example.org",
    ustadzPhone: "0812 9999 0000",
    ustadzWhatsapp: "0812 9999 0000",
    ustadzAddress: "Bandung, Jawa Barat",
    participantCode: "ADA-BDG001-01",
    institutionName: "Ma'had Ilmu Sunnah Bandung",
    approvalStatus: "APPROVED",
    confirmationStatus: "CONFIRMED",
    registrationSource: "INSTITUTION_DELEGATION",
    registeredAt: "2026-07-22T10:30:00+07:00",
    portalPasswordConfigured: true,
  },
  {
    id: "committee-preview-participant-2",
    ustadzId: "ustadz-preview-2",
    ustadzName: "Ustadz Hasan Basri",
    ustadzEmail: null,
    ustadzPhone: "0812 8888 1111",
    ustadzWhatsapp: "0812 8888 1111",
    ustadzAddress: null,
    participantCode: "ADA-BDG001-02",
    institutionName: "Ma'had Ilmu Sunnah Bandung",
    approvalStatus: "PENDING_REVIEW",
    confirmationStatus: "CONFIRMED",
    registrationSource: "INSTITUTION_DELEGATION",
    registeredAt: "2026-07-22T10:42:00+07:00",
    portalPasswordConfigured: false,
  },
];

const approvalLabels: Record<string, string> = {
  PENDING_REVIEW: "Menunggu tinjauan",
  APPROVED: "Disetujui",
  WAITLISTED: "Daftar tunggu",
  DECLINED: "Ditolak",
  CANCELLED: "Dibatalkan",
};

const decisionLabels: Record<Decision, { title: string; action: string; helper: string; nextStatus: string }> = {
  approve: { title: "Setujui peserta", action: "Setujui", helper: "Catatan bersifat opsional dan dapat dipakai untuk kebutuhan internal panitia.", nextStatus: "APPROVED" },
  waitlist: { title: "Masukkan daftar tunggu", action: "Simpan ke daftar tunggu", helper: "Tuliskan alasan agar keputusan dapat ditelusuri oleh panitia lain.", nextStatus: "WAITLISTED" },
  decline: { title: "Tolak pendaftaran", action: "Tolak pendaftaran", helper: "Berikan alasan yang jelas sebelum pendaftaran ditolak.", nextStatus: "DECLINED" },
  cancel: { title: "Batalkan kepesertaan", action: "Batalkan kepesertaan", helper: "Berikan alasan pembatalan untuk catatan operasional.", nextStatus: "CANCELLED" },
};

const approvalVariant = (status: string): StatusVariant => {
  if (status === "APPROVED") return "success";
  if (status === "DECLINED" || status === "CANCELLED") return "danger";
  if (status === "WAITLISTED" || status === "PENDING_REVIEW") return "warning";
  return "neutral";
};

const formatRegisteredAt = (value: string | null) => {
  if (!value) return "Waktu daftar belum tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
};

const escapeCsv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const ParticipantDecisionDialog: React.FC<{
  request: Exclude<DecisionRequest, null>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}> = ({ request, busy, onClose, onSubmit }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const settings = decisionLabels[request.decision];
  const reasonRequired = request.decision !== "approve";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[min(80dvh,40rem)] w-[min(92vw,32rem)] rounded-xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/55"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!reasonRequired || reason.trim().length >= 2) onSubmit(reason.trim());
        }}
        className="p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-teal-800">{request.participant.participantCode}</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">{settings.title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{request.participant.ustadzName}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Tutup dialog" className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="mt-5 block">
          <span className="text-sm font-bold text-slate-800">{reasonRequired ? "Alasan keputusan" : "Catatan panitia (opsional)"}</span>
          <textarea
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required={reasonRequired}
            minLength={reasonRequired ? 2 : undefined}
            aria-describedby="decision-helper"
            placeholder={reasonRequired ? "Contoh: kuota utama telah terpenuhi" : "Contoh: dokumen telah diperiksa"}
            className="mt-2 min-h-28 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-teal-700"
          />
        </label>
        <p id="decision-helper" className="mt-2 min-h-[1.5rem] text-sm leading-6 text-slate-600">{settings.helper}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-[44px] whitespace-nowrap rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50">Kembali</button>
          <button type="submit" disabled={busy || (reasonRequired && reason.trim().length < 2)} className={`min-h-[44px] whitespace-nowrap rounded-lg px-4 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${request.decision === "decline" || request.decision === "cancel" ? "bg-rose-700 hover:bg-rose-800 focus-visible:outline-rose-700" : "bg-teal-800 hover:bg-teal-900 focus-visible:outline-teal-700"}`}>
            {busy ? "Memproses…" : settings.action}
          </button>
        </div>
      </form>
    </dialog>
  );
};

export const CommitteeParticipantsPage: React.FC = () => {
  const [urlParams] = useSearchParams();
  const requestedEventId = urlParams.get("eventId") || "";
  const requestedStatus = urlParams.get("status") || "ALL";
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [participants, setParticipants] = useState<CommitteeParticipant[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    ["PENDING_REVIEW", "WAITLISTED", "AWAITING_CONFIRMATION", "NEEDS_ACTION"].includes(requestedStatus)
      ? requestedStatus as StatusFilter : "ALL");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("ALL");
  const [sourceFilter, setSourceFilter] = useState<ParticipantSourceFilter>("ALL");
  const [institutionFilter, setInstitutionFilter] = useState("ALL");
  const [sort, setSort] = useState<SortOption>("PRIORITY");
  const { data: identity, isLoading: identityLoading } = useGetIdentity<AuthIdentity>();
  const permissions = participantStaffPermissions(identity?.assignments, selectedEventId);
  const permissionsKey = permissions.slice().sort().join(",");
  const canRead = permissions.includes("participants.read");
  const canApprove = permissions.includes("participants.approve");
  const canExport = permissions.includes("participants.export");
  const debouncedSearch = useDebouncedValue(search.trim());
  const filterKey = JSON.stringify([selectedEventId, debouncedSearch, statusFilter, contactFilter, sourceFilter, institutionFilter, sort]);
  const [pagination, setPagination] = useState({ key: filterKey, page: 1 });
  const page = pagination.key === filterKey ? pagination.page : 1;
  const [pageMeta, setPageMeta] = useState<ParticipantPageMeta>({ page: 1, pageSize: 25, total: 0, pageCount: 1, filteredEligible: 0, summary: emptyParticipantSummary() });
  const [selectionRegistry, setSelectionRegistry] = useState<ApprovalSelectionCandidate[]>([]);
  const [loadedPendingScope, setLoadedPendingScope] = useState<{ key: string; ids: string[] } | null>(null);
  const readController = useRef<AbortController | null>(null);
  const currentFilterKey = useRef(filterKey);
  currentFilterKey.current = filterKey;
  const participantQuery = new URLSearchParams({ page: String(page), pageSize: "25", search: debouncedSearch,
    status: statusFilter, contact: contactFilter, source: sourceFilter, institution: institutionFilter, sort, includeInstitutions: "true" }).toString();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const [decisionRequest, setDecisionRequest] = useState<DecisionRequest>(null);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const mounted = useRef(true);
  const activeEvent = useRef(selectedEventId);
  const eventGeneration = useRef(0);
  const loadGeneration = useRef(0);
  const actionBusy = useRef(false);
  const auxiliaryGeneration = useRef(0);
  if (activeEvent.current !== selectedEventId) {
    activeEvent.current = selectedEventId;
    eventGeneration.current += 1;
  }

  const selectedEvent = events.find((item) => item.id === selectedEventId) || events[0];

  const loadEvents = async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const data = await eventApi<EventSummary[]>("/events/options", { signal });
      if (!mounted.current || signal?.aborted) return;
      const eventItems = Array.isArray(data) ? data : [];
      setEvents(eventItems);
      setSelectedEventId((current) => eventItems.some((item) => item.id === current) ? current
        : eventItems.some((item) => item.id === requestedEventId) ? requestedEventId : eventItems[0]?.id || "");
      setPreviewMode(false);
      if (eventItems.length === 0) setParticipants([]);
    } catch (loadError) {
      if (!mounted.current || signal?.aborted) return;
      if (import.meta.env.DEV) {
        setEvents([previewEvent]);
        setSelectedEventId(previewEvent.id);
        setParticipants(previewParticipants);
        setPreviewMode(true);
      } else {
        setError(loadError instanceof Error ? loadError.message : "Daftar event tidak dapat dimuat.");
      }
    } finally {
      if (mounted.current && !signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) void loadEvents(controller.signal); });
    return () => { mounted.current = false; eventGeneration.current += 1; auxiliaryGeneration.current += 1; controller.abort(); };
  }, []);

  const reloadParticipants = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const eventVersion = eventGeneration.current;
    const isCurrent = () => mounted.current && activeEvent.current === selectedEventId
      && eventGeneration.current === eventVersion && loadGeneration.current === generation;
    if (!selectedEventId || !isCurrent() || currentFilterKey.current !== filterKey || identityLoading || !identity) return false;
    if (!canRead) {
      setParticipants([]); setLoading(false);
      setError("Anda tidak memiliki izin membaca peserta pada event ini.");
      return false;
    }
    if (previewMode) { setRequiresRefresh(false); return true; }
    setLoading(true);
    setError("");
    readController.current?.abort();
    const controller = new AbortController(); readController.current = controller;
    try {
      const response = await eventApiEnvelope<CommitteeParticipant[], ParticipantPageMeta>(`/events/${selectedEventId}/participants?${participantQuery}`, { signal: controller.signal });
      if (!isCurrent() || controller.signal.aborted || currentFilterKey.current !== filterKey) return false;
      const list = Array.isArray(response.data) ? response.data : [];
      if (response.meta && page > response.meta.pageCount) { setPagination({ key: filterKey, page: response.meta.pageCount }); return false; }
      setParticipants(list);
      if (response.meta) setPageMeta(response.meta);
      const knownIneligible = new Set(list.filter((item) => !canApproveParticipant(item)).map((item) => item.id));
      setSelectedIds((current) => current.filter((id) => !knownIneligible.has(id)));
      setSelectionRegistry((current) => [...new Map([...current.filter((item) => selectedIdsRef.current.includes(item.id)), ...list.map(approvalSelectionCandidate)].map((item) => [item.id, item])).values()]);
      setRequiresRefresh(false);
      return true;
    } catch (loadError) {
      if (isCurrent() && !controller.signal.aborted) {
        setParticipants([]);
        setRequiresRefresh(true);
        setError(loadError instanceof Error ? loadError.message : "Data peserta tidak dapat dimuat.");
      }
      return false;
    } finally {
      if (isCurrent() && !controller.signal.aborted) setLoading(false);
    }
  }, [selectedEventId, previewMode, participantQuery, filterKey, page, permissionsKey, identityLoading, Boolean(identity)]);

  useEffect(() => {
    setSelectedIds([]);
    setSelectionRegistry([]);
    setLoadedPendingScope(null);
    setPageMeta({ page: 1, pageSize: 25, total: 0, pageCount: 1, filteredEligible: 0, summary: emptyParticipantSummary() });
    auxiliaryGeneration.current += 1;
    setDecisionRequest(null);
    setBusy("");
    actionBusy.current = false;
    setRequiresRefresh(false);
    if (!selectedEventId || previewMode) return;
    setParticipants([]);
  }, [previewMode, selectedEventId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void reloadParticipants(); });
    return () => { active = false; readController.current?.abort(); };
  }, [reloadParticipants]);

  const participantWithContact = (participant: CommitteeParticipant) => ({
    id: participant.id,
    name: participant.ustadzName,
    email: participant.ustadzEmail,
    phone: participant.ustadzPhone,
    whatsapp: participant.ustadzWhatsapp,
    address: participant.ustadzAddress,
    participantCode: participant.participantCode,
    institutionName: participant.institutionName,
    approvalStatus: participant.approvalStatus,
    confirmationStatus: participant.confirmationStatus,
  });

  const institutions = useMemo(() => previewMode ? Array.from(new Set(participants.map((item) => item.institutionName).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "id-ID")) : pageMeta.institutions || [], [participants, previewMode, pageMeta.institutions]);

  const filteredParticipants = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("id-ID");
    const priority: Record<string, number> = { PENDING_REVIEW: 0, WAITLISTED: 1, APPROVED: 2, DECLINED: 3, CANCELLED: 4 };
    if (!previewMode) return participants;
    return participants
      .filter((participant) => {
        const missing = getMissingParticipantContactFields(participantWithContact(participant));
        const hasWhatsapp = Boolean(participant.ustadzWhatsapp || participant.ustadzPhone);
        const statusMatch = statusFilter === "ALL" || (statusFilter === "NEEDS_ACTION" ? participant.approvalStatus === "PENDING_REVIEW" || missing.length > 0 || !participant.portalPasswordConfigured
          : statusFilter === "AWAITING_CONFIRMATION" ? participant.approvalStatus === "APPROVED" && participant.confirmationStatus === "INVITED" : participant.approvalStatus === statusFilter);
        const contactMatch = contactFilter === "ALL" || (contactFilter === "COMPLETE" && missing.length === 0) || (contactFilter === "INCOMPLETE" && missing.length > 0) || (contactFilter === "NO_WHATSAPP" && !hasWhatsapp) || (contactFilter === "NO_PORTAL" && !participant.portalPasswordConfigured);
        const institutionMatch = institutionFilter === "ALL" || (institutionFilter === "INDIVIDUAL" ? !participant.institutionName : participant.institutionName === institutionFilter);
        const searchMatch = !keyword || [participant.ustadzName, participant.participantCode, participant.institutionName, participant.ustadzWhatsapp, participant.ustadzPhone, participant.ustadzEmail].filter(Boolean).some((value) => String(value).toLocaleLowerCase("id-ID").includes(keyword));
        return statusMatch && contactMatch && (sourceFilter === "ALL" || participantSourceCategory(participant.registrationSource) === sourceFilter) && institutionMatch && searchMatch;
      })
      .sort((a, b) => {
        if (sort === "NAME") return a.ustadzName.localeCompare(b.ustadzName, "id-ID");
        const aTime = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
        const bTime = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
        if (sort === "NEWEST") return bTime - aTime;
        if (sort === "OLDEST") return aTime - bTime;
        return (priority[a.approvalStatus] ?? 9) - (priority[b.approvalStatus] ?? 9) || bTime - aTime;
      });
  }, [contactFilter, sourceFilter, institutionFilter, participants, search, sort, statusFilter, previewMode]);

  const pendingIds = filteredParticipants.filter((item) => item.approvalStatus === "PENDING_REVIEW" && canApproveParticipant(item)).map((item) => item.id);
  const pendingTotal = previewMode ? pendingIds.length : pageMeta.filteredPendingEligible || 0;
  // Counts alone cannot establish membership after changing filters. A complete
  // scope comes from an explicit read, or a single page containing every match.
  const pendingScopeIds = previewMode ? pendingIds : loadedPendingScope?.key === filterKey ? loadedPendingScope.ids
    : pendingIds.length === pendingTotal ? pendingIds : [];
  const allPendingSelected = pendingTotal > 0 && pendingScopeIds.length === pendingTotal && pendingScopeIds.every((id) => selectedIds.includes(id));
  const completeContacts = previewMode ? participants.filter((participant) => getMissingParticipantContactFields(participantWithContact(participant)).length === 0).length : pageMeta.summary.completeContacts || 0;
  const pendingCount = previewMode ? participants.filter((participant) => participant.approvalStatus === "PENDING_REVIEW").length : pageMeta.summary.pending;
  const portalReady = previewMode ? participants.filter((participant) => participant.portalPasswordConfigured).length : pageMeta.summary.portalReady || 0;
  const totalParticipants = previewMode ? participants.length : pageMeta.summary.total;
  const filteredTotal = previewMode ? filteredParticipants.length : pageMeta.total;

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setContactFilter("ALL");
    setSourceFilter("ALL");
    setInstitutionFilter("ALL");
    setSort("PRIORITY");
  };

  const updateLocalStatus = (ids: string[], status: string) => {
    setParticipants((current) => current.map((item) => ids.includes(item.id) ? { ...item, approvalStatus: status } : item));
    setSelectionRegistry((current) => current.map((item) => ids.includes(item.id) ? { ...item, approvalStatus: status } : item));
  };

  const submitDecision = async (reason: string) => {
    if (!decisionRequest || actionBusy.current || loading || requiresRefresh) return;
    const target = { ...decisionRequest.participant, name: decisionRequest.participant.ustadzName };
    if (decisionRequest.decision === "approve" ? !canApprove || !canApproveParticipant(target)
      : !availableParticipantCommands(target, permissions).includes(decisionRequest.decision)) return;
    const eventVersion = eventGeneration.current;
    const isCurrent = () => mounted.current && eventGeneration.current === eventVersion;
    actionBusy.current = true;
    const { participant, decision } = decisionRequest;
    const settings = decisionLabels[decision];
    setBusy(participant.id);
    setError("");
    setSuccess("");
    try {
      if (!previewMode) {
        await eventApi(`/events/${selectedEventId}/participants/${participant.id}/${decision}`, {
          method: "POST",
          body: JSON.stringify(decision === "approve" ? { notes: reason || undefined } : { reason }),
        });
      }
      if (!isCurrent()) return;
      if (decision === "cancel") {
        setParticipants((current) => current.map((item) => item.id === participant.id ? { ...item, confirmationStatus: "CANCELLED" } : item));
        setSelectionRegistry((current) => current.map((item) => item.id === participant.id ? { ...item, confirmationStatus: "CANCELLED" } : item));
      } else updateLocalStatus([participant.id], settings.nextStatus);
      setSelectedIds((current) => current.filter((id) => id !== participant.id));
      setSuccess(`${participant.ustadzName} berhasil diperbarui: ${approvalLabels[settings.nextStatus].toLocaleLowerCase("id-ID")}.`);
      setDecisionRequest(null);
      if (!previewMode) await reloadParticipants();
    } catch (actionError) {
      if (isCurrent()) {
        setRequiresRefresh(true);
        setError(actionError instanceof Error ? actionError.message : "Keputusan peserta gagal disimpan.");
      }
    } finally {
      if (isCurrent()) { actionBusy.current = false; setBusy(""); }
    }
  };

  const bulkApprove = async () => {
    const eligibleIds = selectedIds.filter((id) => (previewMode ? participants : selectionRegistry).some((item) => item.id === id && item.approvalStatus === "PENDING_REVIEW" && canApproveParticipant(item)));
    if (!canApprove || eligibleIds.length === 0 || actionBusy.current || loading || requiresRefresh) return;
    const eventVersion = eventGeneration.current;
    const isCurrent = () => mounted.current && eventGeneration.current === eventVersion;
    actionBusy.current = true;
    setBusy("bulk");
    setError("");
    setSuccess("");
    try {
      if (!previewMode) {
        const result = await runParticipantBulkApproval(eligibleIds, (participantIds) =>
          eventApi<BulkApprovalResponse>(`/events/${selectedEventId}/participants/bulk-approve`, {
            method: "POST", body: JSON.stringify({ participantIds }),
          }), () => undefined, isCurrent);
        if (!isCurrent()) return;
        const succeeded = result.filter((item) => item.status === "SUCCESS").map((item) => item.participantId);
        updateLocalStatus(succeeded, "APPROVED");
        setSelectedIds((current) => selectionAfterBulkApproval(current, eligibleIds, result));
        setSuccess(`${succeeded.length} peserta berhasil disetujui; ${result.length - succeeded.length} perlu diperiksa.`);
        const failures = result.filter((item) => item.status !== "SUCCESS");
        await reloadParticipants();
        if (isCurrent() && failures.length) setError(failures.map((item) => `${selectionRegistry.find((participant) => participant.id === item.participantId)?.ustadzName || item.participantId}: ${item.message}`).join("; "));
        return;
      }
      updateLocalStatus(eligibleIds, "APPROVED");
      setSelectedIds([]);
      setSuccess(`${eligibleIds.length} peserta berhasil disetujui.`);
    } catch (actionError) {
      if (isCurrent()) {
        setRequiresRefresh(true);
        setError(actionError instanceof Error ? actionError.message : "Persetujuan massal gagal diproses.");
      }
    } finally {
      if (isCurrent()) { actionBusy.current = false; setBusy(""); }
    }
  };

  const selectFilteredPending = async (checked: boolean) => {
    if (!canApprove || requiresRefresh) return;
    if (previewMode) { setSelectedIds((current) => checked ? [...new Set([...current, ...pendingIds])] : current.filter((id) => !pendingIds.includes(id))); return; }
    if (busy || loading || actionBusy.current) return;
    const key = filterKey;
    const operation = ++auxiliaryGeneration.current;
    const isCurrent = () => mounted.current && activeEvent.current === selectedEventId && auxiliaryGeneration.current === operation;
    actionBusy.current = true;
    setBusy("selection"); setError("");
    try {
      const people: ApprovalSelectionCandidate[] = [];
      for (let selectedPage = 1; ; selectedPage++) {
        if (currentFilterKey.current !== key || !isCurrent()) throw new Error("Filter berubah. Pilih ulang peserta.");
        const params = new URLSearchParams(participantQuery);
        params.set("page", String(selectedPage)); params.set("pageSize", "100"); params.set("projection", "selection");
        params.set("status", "PENDING_REVIEW"); params.set("eligible", "true"); params.delete("includeInstitutions");
        const response = await eventApiEnvelope<ApprovalSelectionCandidate[], ParticipantPageMeta>(`/events/${selectedEventId}/participants?${params}`);
        people.push(...response.data);
        if (selectedPage >= (response.meta?.pageCount || 1)) break;
      }
      if (currentFilterKey.current !== key || !isCurrent()) return;
      const ids = people.map((item) => item.id);
      setLoadedPendingScope({ key, ids });
      setSelectionRegistry((current) => [...new Map([...current, ...people].map((item) => [item.id, item])).values()]);
      setSelectedIds((current) => checked ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id)));
    } catch (cause) { if (isCurrent()) setError(cause instanceof Error ? cause.message : "Pilihan gagal dimuat."); }
    finally { if (isCurrent()) { actionBusy.current = false; setBusy(""); } }
  };

  const exportCsv = async () => {
    if (busy || loading || !canExport || actionBusy.current || requiresRefresh) return;
    const key = filterKey;
    const operation = ++auxiliaryGeneration.current;
    const isCurrent = () => mounted.current && activeEvent.current === selectedEventId && auxiliaryGeneration.current === operation;
    actionBusy.current = true;
    setBusy("export"); setError("");
    try {
    let records = filteredParticipants;
    if (!previewMode) {
      records = [];
      for (let exportPage = 1; ; exportPage++) {
        if (currentFilterKey.current !== key || !isCurrent()) throw new Error("Filter berubah. Ulangi ekspor dengan filter terbaru.");
        const params = new URLSearchParams(participantQuery); params.set("page", String(exportPage)); params.set("pageSize", "100"); params.delete("includeInstitutions");
        const response = await eventApiEnvelope<CommitteeParticipant[], ParticipantPageMeta>(`/events/${selectedEventId}/participants?${params}`);
        records.push(...response.data);
        if (exportPage >= (response.meta?.pageCount || 1)) break;
      }
      records = [...new Map(records.map((item) => [item.id, item])).values()];
      if (currentFilterKey.current !== key || !isCurrent()) throw new Error("Filter berubah. Ulangi ekspor dengan filter terbaru.");
    }
    const columns = ["Kode peserta", "Nama", "Lembaga", "WhatsApp", "Email", "Alamat", "Persetujuan", "Konfirmasi", "Waktu daftar"];
    const rows = records.map((item) => [item.participantCode, item.ustadzName, item.institutionName || "Individu", item.ustadzWhatsapp || item.ustadzPhone || "", item.ustadzEmail || "", item.ustadzAddress || "", approvalLabels[item.approvalStatus] || item.approvalStatus, item.confirmationStatus, formatRegisteredAt(item.registeredAt)]);
    const csv = `\uFEFF${[columns, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `peserta-${selectedEvent?.code || "event"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSuccess(`${rows.length} data peserta diekspor sesuai filter aktif.`);
    } catch (cause) { if (isCurrent()) setError(cause instanceof Error ? cause.message : "Ekspor gagal diproses."); }
    finally { if (isCurrent()) { actionBusy.current = false; setBusy(""); } }
  };

  return (
    <CommitteeLayout>
      <PageHeader title="Operasional peserta" description="Tinjau pendaftaran, selesaikan data yang tertunda, dan hubungi asatidz dari satu meja kerja." breadcrumbs={[{ label: "Panitia", href: "/committee" }, { label: "Peserta" }]} actions={<button type="button" onClick={() => void (selectedEventId ? reloadParticipants() : loadEvents())} disabled={loading || Boolean(busy)} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Muat ulang</button>} />

      {previewMode && <div className="mb-5 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Mode pratinjau.</strong> Keputusan, filter, ekspor, komunikasi, dan akses portal dapat dicoba tanpa mengubah database.</div>}
      {error && <div role="alert" className="mb-5 flex items-start gap-2 border-l-4 border-rose-600 bg-rose-50 p-4 text-sm leading-6 text-rose-950"><AlertCircle className="mt-1 h-4 w-4 shrink-0" /><span>{error}</span></div>}
      {success && <div role="status" className="mb-5 flex items-start gap-2 border-l-4 border-emerald-600 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0" /><span>{success}</span></div>}

      <section className="grid grid-cols-2 border-y border-slate-200 bg-white lg:grid-cols-4" aria-label="Ringkasan peserta">
        {[
          { label: "Total peserta", value: totalParticipants, icon: Users },
          { label: "Perlu ditinjau", value: pendingCount, icon: ClipboardCheck },
          { label: "Kontak lengkap", value: completeContacts, icon: Contact },
          { label: "Akses portal siap", value: portalReady, icon: ShieldCheck },
        ].map((metric) => <div key={metric.label} className="border-b border-r border-slate-200 p-4 lg:border-b-0"><metric.icon className="h-5 w-5 text-teal-800" /><p className="mt-3 text-2xl font-black tabular-nums text-slate-950">{loading ? "—" : metric.value}</p><p className="mt-1 text-sm font-semibold text-slate-600">{metric.label}</p></div>)}
      </section>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start" aria-label="Kontrol daftar peserta">
          <div className="border-t-4 border-teal-800 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-teal-800">Kontrol daftar</p><h2 className="mt-1 text-lg font-black text-slate-950">Temukan prioritas</h2></div><ArrowDownAZ className="h-5 w-5 text-slate-500" /></div>
            <div className="mt-5 space-y-4">
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-800">Event</span><select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-teal-700">{events.length === 0 && <option value="">Belum ada event</option>}{events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-800">Cari peserta</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nama, kode, lembaga" className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-teal-700" /></span></label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-800">Tahap keputusan</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-teal-700"><option value="ALL">Semua tahap</option><option value="NEEDS_ACTION">Perlu tindakan</option><option value="PENDING_REVIEW">Menunggu tinjauan</option><option value="WAITLISTED">Daftar tunggu</option><option value="AWAITING_CONFIRMATION">Menunggu konfirmasi hadir</option><option value="APPROVED">Disetujui</option><option value="DECLINED">Ditolak</option><option value="CANCELLED">Dibatalkan</option></select></label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-800">Kesiapan data</span><select value={contactFilter} onChange={(event) => setContactFilter(event.target.value as ContactFilter)} className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-teal-700"><option value="ALL">Semua data</option><option value="COMPLETE">Kontak lengkap</option><option value="INCOMPLETE">Kontak belum lengkap</option><option value="NO_WHATSAPP">Tanpa WhatsApp</option><option value="NO_PORTAL">Akses portal belum siap</option></select></label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-800">Jalur pendaftaran</span><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as ParticipantSourceFilter)} className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-teal-700"><option value="ALL">Semua jalur</option><option value="REGULAR">Pendaftaran reguler</option><option value="INSTITUTION">Undangan lembaga</option><option value="INDIVIDUAL">Undangan pribadi</option></select></label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-800">Lembaga</span><select value={institutionFilter} onChange={(event) => setInstitutionFilter(event.target.value)} className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-teal-700"><option value="ALL">Semua lembaga</option><option value="INDIVIDUAL">Peserta individu</option>{institutions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-800">Urutkan</span><select value={sort} onChange={(event) => setSort(event.target.value as SortOption)} className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-teal-700"><option value="PRIORITY">Prioritas tindakan</option><option value="NEWEST">Pendaftaran terbaru</option><option value="OLDEST">Pendaftaran terlama</option><option value="NAME">Nama A–Z</option></select></label>
            </div>
            <button type="button" onClick={resetFilters} className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"><FilterX className="h-4 w-4" />Reset filter</button>
          </div>
          <div className="mt-3 border-l-2 border-teal-700 px-4 py-2 text-sm leading-6 text-slate-600"><strong className="text-slate-900">{filteredTotal}</strong> dari {totalParticipants} peserta sesuai filter; halaman ini memuat {filteredParticipants.length} peserta.</div>
        </aside>

        <section className="min-w-0" aria-label="Daftar peserta">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-teal-800">Antrean peserta</p><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Tinjau lalu tindak lanjuti</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Peserta yang menunggu keputusan ditempatkan lebih dahulu. Pilih beberapa baris untuk persetujuan massal.</p></div>
            {canExport && <button type="button" onClick={() => void exportCsv()} disabled={loading || Boolean(busy) || requiresRefresh || filteredTotal === 0} className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" />{busy === "export" ? "Menyiapkan ekspor…" : "Ekspor CSV"}</button>}
          </div>

          {canApprove && (pendingTotal > 0 || selectedIds.length > 0) && <div className="mt-4 flex flex-col gap-3 border-l-4 border-teal-700 bg-teal-50 p-4 sm:flex-row sm:items-center sm:justify-between"><label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-bold text-teal-950"><input type="checkbox" disabled={Boolean(busy) || loading || requiresRefresh || pendingTotal === 0} checked={allPendingSelected} onChange={(event) => void selectFilteredPending(event.target.checked)} className="h-5 w-5 accent-teal-800" />Pilih semua yang menunggu sesuai filter ({pendingTotal})</label>{selectedIds.length > 0 && <button type="button" onClick={() => void bulkApprove()} disabled={Boolean(busy) || loading || requiresRefresh} className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-teal-800 px-4 text-sm font-bold text-white hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50"><ListChecks className="h-4 w-4" />{busy === "bulk" ? "Memproses…" : `Setujui ${selectedIds.length} peserta`}</button>}</div>}

          {loading ? <div className="mt-4 space-y-3" aria-label="Memuat peserta">{[1, 2, 3].map((item) => <div key={item} className="h-44 animate-pulse bg-slate-100" />)}</div> : filteredParticipants.length === 0 ? <div className="mt-4 border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><Users className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-3 text-lg font-black text-slate-950">Belum ada peserta yang cocok</h3><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-600">Ubah filter atau kata pencarian. Jika event baru dibuat, peserta akan muncul setelah formulir pendaftaran dikirim.</p><button type="button" onClick={resetFilters} className="mt-4 min-h-[44px] whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-100">Tampilkan semua</button></div> : <ul className="mt-4 divide-y divide-slate-200 border-y border-slate-200 bg-white">{filteredParticipants.map((participant) => {
            const contact = participantWithContact(participant);
            const missing = getMissingParticipantContactFields(contact);
            const canSelect = canApprove && participant.approvalStatus === "PENDING_REVIEW" && canApproveParticipant(participant);
            const commands = availableParticipantCommands({ ...participant, name: participant.ustadzName }, permissions);
            const resolution = participantResolutionHint({ approvalStatus: participant.approvalStatus,
              confirmationStatus: participant.confirmationStatus, contactComplete: missing.length === 0,
              portalPasswordConfigured: participant.portalPasswordConfigured });
            return <li key={participant.id} className={`min-w-0 py-5 ${selectedIds.includes(participant.id) ? "bg-teal-50/70" : ""}`}>
              <div className="grid min-w-0 gap-4 px-4 md:grid-cols-[2rem_minmax(0,1fr)]">
                <div>{canSelect ? <input type="checkbox" disabled={Boolean(busy) || loading || requiresRefresh} checked={selectedIds.includes(participant.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, participant.id] : current.filter((id) => id !== participant.id))} aria-label={`Pilih ${participant.ustadzName}`} className="mt-1 h-5 w-5 accent-teal-800" /> : <UserRoundCheck className="mt-1 h-5 w-5 text-slate-400" aria-hidden="true" />}</div>
                <div className="min-w-0">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0"><p className="font-mono text-sm font-bold text-teal-800">{participant.participantCode}</p><h3 className="mt-1 overflow-wrap-anywhere text-lg font-black text-slate-950">{participant.ustadzName}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{participant.institutionName || (participant.publicGroupId ? `Rombongan reguler ${participant.publicGroupId.slice(0, 8)}` : "Peserta individu")}</p><p className="text-sm font-bold text-teal-800">{participantSourceLabel(participant.registrationSource)}</p>{participant.publicGroupId && <p className="text-sm font-bold text-teal-800">{participant.isDelegationLead ? "Kepala rombongan" : "Anggota rombongan"}</p>}</div>
                    <div className="flex flex-wrap gap-2"><StatusBadge label={approvalLabels[participant.approvalStatus] || participant.approvalStatus.replaceAll("_", " ")} variant={approvalVariant(participant.approvalStatus)} /><StatusBadge label={missing.length === 0 ? "Kontak lengkap" : `${missing.length} data belum lengkap`} variant={missing.length === 0 ? "success" : "warning"} /><StatusBadge label={participant.portalPasswordConfigured ? "Portal siap" : "Portal belum siap"} variant={participant.portalPasswordConfigured ? "info" : "neutral"} /></div>
                  </div>
                  <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${resolution.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" : resolution.tone === "info" ? "border-sky-200 bg-sky-50 text-sky-950" : "border-slate-200 bg-slate-50 text-slate-700"}`}><strong>{resolution.title}.</strong> {resolution.detail}{participant.statusReason && ["WAITLISTED", "DECLINED", "REJECTED"].includes(participant.approvalStatus) && <span className="mt-1 block">Catatan: {participant.statusReason}</span>}</div>

                  <div className="mt-4 grid gap-2 border-y border-slate-100 py-4 sm:grid-cols-2 xl:grid-cols-4">
                    <p className="flex min-w-0 items-center gap-2 text-sm text-slate-700"><Smartphone className="h-4 w-4 shrink-0 text-teal-800" /><span className="truncate">{participant.ustadzWhatsapp || participant.ustadzPhone || "Belum diisi"}</span></p>
                    <p className="flex min-w-0 items-center gap-2 text-sm text-slate-700"><Mail className="h-4 w-4 shrink-0 text-teal-800" /><span className="truncate">{participant.ustadzEmail || "Belum diisi"}</span></p>
                    <p className="flex min-w-0 items-center gap-2 text-sm text-slate-700"><MapPin className="h-4 w-4 shrink-0 text-teal-800" /><span className="truncate">{participant.ustadzAddress || "Belum diisi"}</span></p>
                    <p className="flex min-w-0 items-center gap-2 text-sm text-slate-700"><CalendarClock className="h-4 w-4 shrink-0 text-teal-800" /><time dateTime={participant.registeredAt || undefined} className="truncate">{formatRegisteredAt(participant.registeredAt)}</time></p>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {canApprove && canApproveParticipant(participant) && <button type="button" onClick={() => setDecisionRequest({ participant, decision: "approve" })} disabled={Boolean(busy) || loading || requiresRefresh} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-teal-800 px-4 text-sm font-bold text-white hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50"><Check className="h-4 w-4" />Setujui</button>}
                      {participant.approvalStatus === "PENDING_REVIEW" && commands.includes("waitlist") && <button type="button" onClick={() => setDecisionRequest({ participant, decision: "waitlist" })} disabled={Boolean(busy) || loading || requiresRefresh} className="min-h-[44px] whitespace-nowrap rounded-lg border border-amber-400 bg-amber-50 px-4 text-sm font-bold text-amber-950 hover:bg-amber-100 disabled:opacity-50">Daftar tunggu</button>}
                      {participant.approvalStatus === "PENDING_REVIEW" && commands.includes("decline") && <button type="button" onClick={() => setDecisionRequest({ participant, decision: "decline" })} disabled={Boolean(busy) || loading || requiresRefresh} className="min-h-[44px] whitespace-nowrap rounded-lg border border-rose-300 bg-white px-4 text-sm font-bold text-rose-800 hover:bg-rose-50 disabled:opacity-50">Tolak</button>}
                      {commands.includes("cancel") && <button type="button" onClick={() => setDecisionRequest({ participant, decision: "cancel" })} disabled={Boolean(busy) || loading || requiresRefresh} className="min-h-[44px] whitespace-nowrap rounded-lg border border-rose-300 bg-white px-4 text-sm font-bold text-rose-800 hover:bg-rose-50 disabled:opacity-50">Batalkan</button>}
                      {commands.includes("replace") && <ParticipantManagementDialog eventId={selectedEventId}
                        participant={{ id: participant.id, name: participant.ustadzName, participantCode: participant.participantCode,
                          approvalStatus: participant.approvalStatus, confirmationStatus: participant.confirmationStatus }}
                        permissions={permissions} onlyActions={["replace"]} disabled={Boolean(busy) || loading || requiresRefresh}
                        demoMode={previewMode} onBusyChange={(working) => { if (mounted.current && activeEvent.current === selectedEventId) {
                          actionBusy.current = working; setBusy(working ? participant.id : ""); } }}
                        onCompleted={async () => { const refreshed = await reloadParticipants(); if (refreshed) setSuccess("Penggantian tersimpan. Peserta baru menunggu persetujuan; QR lama tidak berlaku."); return refreshed; }} />}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 xl:border-0 xl:pt-0">
                      <ParticipantProfileDialog participant={{ id: participant.id, ustadzId: participant.ustadzId, name: participant.ustadzName, participantCode: participant.participantCode, institutionName: participant.institutionName, email: participant.ustadzEmail, phone: participant.ustadzPhone, whatsapp: participant.ustadzWhatsapp, address: participant.ustadzAddress, approvalStatus: participant.approvalStatus, confirmationStatus: participant.confirmationStatus, confirmationStatusReason: participant.confirmationStatusReason, registrationSource: participant.registrationSource, registeredAt: participant.registeredAt, eventName: participant.eventName || selectedEvent?.name }} />
                      <ParticipantCommunicationPanel disabled={previewMode} participant={contact} senderRole="committee" initialTemplate={participantSourceCategory(participant.registrationSource) === "REGULAR" ? "REGULAR_REGISTRATION" : "EVENT_INVITATION"} event={{ name: participant.eventName || selectedEvent?.name, startDate: participant.eventStartDate || selectedEvent?.startDate, endDate: participant.eventEndDate || selectedEvent?.endDate, venueName: participant.eventVenueName || selectedEvent?.venueName, venueAddress: participant.eventVenueAddress || selectedEvent?.venueAddress }} />
                      {permissions.includes("participants.manage_portal_access") && <ParticipantPortalAccessAction eventId={selectedEventId} participant={{ id: participant.id, name: participant.ustadzName, email: participant.ustadzEmail, portalPasswordConfigured: participant.portalPasswordConfigured }} previewMode={previewMode} onCompleted={() => {
                        // Keep the row mounted: the one-time credential dialog must not disappear on refresh.
                        if (activeEvent.current !== selectedEventId || !mounted.current) return;
                        setParticipants((current) => current.map((item) => item.id === participant.id ? { ...item, portalPasswordConfigured: true, portalAccountStatus: "ACTIVE" } : item));
                        if (!participant.portalPasswordConfigured) setPageMeta((current) => ({ ...current, summary: { ...current.summary, portalReady: (current.summary.portalReady || 0) + 1 } }));
                      }} />}
                      <ChevronRight className="hidden h-4 w-4 text-slate-300 xl:block" />
                    </div>
                  </div>
                </div>
              </div>
            </li>;
          })}</ul>}
          {!previewMode && pageMeta.pageCount > 1 && <nav aria-label="Halaman peserta panitia" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><button type="button" disabled={loading || Boolean(busy) || page <= 1} onClick={() => setPagination({ key: filterKey, page: page - 1 })} className="min-h-11 rounded-lg border px-4 disabled:opacity-50">Sebelumnya</button><span>Halaman {page}/{pageMeta.pageCount}</span><button type="button" disabled={loading || Boolean(busy) || page >= pageMeta.pageCount} onClick={() => setPagination({ key: filterKey, page: page + 1 })} className="min-h-11 rounded-lg border px-4 disabled:opacity-50">Berikutnya</button></nav>}
        </section>
      </div>

      {decisionRequest && <ParticipantDecisionDialog request={decisionRequest} busy={busy === decisionRequest.participant.id} onClose={() => { if (!busy) setDecisionRequest(null); }} onSubmit={(reason) => void submitDecision(reason)} />}
    </CommitteeLayout>
  );
};
