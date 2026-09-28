/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V4
 * Hallmark · genre: editorial · tone: utilitarian · macrostructure: Workbench
 * audience: event administrators · use: manage institution invitations and individual attendance readiness
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  Download,
  FileSpreadsheet,
  Link2,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ENV } from "@/config/env";
import { EventWorkspaceNav } from "@/components/admin/events/EventWorkspaceNav";
import { ParticipantCommunicationPanel } from "@/components/communications/ParticipantCommunicationPanel";
import { ParticipantProfileDialog } from "@/components/participants/ParticipantProfileDialog";
import { InvitationShareActions } from "@/components/invitations/InvitationShareActions";
import { ParticipantPortalAccessAction } from "@/components/participants/ParticipantPortalAccessAction";
import { buildInstitutionInvitationPath } from "@/lib/invitationUrl";
import { parseParticipantCsv } from "@/lib/participantImportCsv";

type Invitation = {
  id: string;
  institutionId: string | null;
  institutionName: string | null;
  invitationNumber: string;
  quota: number | null;
  status: string;
  sentAt: string | null;
  respondedAt: string | null;
  responseDeadline: string | null;
};

type Participant = {
  id: string;
  ustadzId: string;
  invitationId: string | null;
  publicGroupId?: string | null;
  ustadzName: string;
  ustadzEmail: string | null;
  ustadzPhone: string | null;
  ustadzWhatsapp: string | null;
  ustadzAddress: string | null;
  ustadzCityCode?: string | null;
  ustadzProvinceCode?: string | null;
  eventName?: string | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  eventVenueName?: string | null;
  eventVenueAddress?: string | null;
  participantCode: string;
  eventParticipationCount?: number;
  isDelegationLead: boolean;
  confirmationStatus: string;
  approvalStatus: string;
  statusReason?: string | null;
  institutionName: string | null;
  registrationSource: string | null;
  registeredAt: string | null;
  portalUserId?: string | null;
  portalAccountStatus?: string | null;
  portalPasswordConfigured?: boolean | null;
};

type Institution = {
  id: string;
  name: string;
  code: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
};

type ParticipantImportRow = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  institutionCode?: string | null;
  institutionName?: string | null;
  participantCode?: string | null;
  isDelegationLead?: boolean;
  approvalStatus?: string;
  notes?: string | null;
};

type ParticipantImportPreview = {
  totalRows: number;
  validCount: number;
  alreadyImportedCount: number;
  invalidCount: number;
  duplicateCount: number;
  missingInstitutionCount: number;
  errorReport: { line: number; field: string; error: string }[];
  duplicateReport: { line: number; key: string; reason: string }[];
  previewData: Array<ParticipantImportRow & {
    line: number;
    resolvedInstitutionName: string | null;
    finalParticipantCode: string;
    matchedUstadzId?: string | null;
    previousApprovedEvents?: number;
  }>;
};
type EventDeadline = {
  name?: string;
  slug?: string;
  startDate?: string | null;
  endDate?: string | null;
  venueName?: string | null;
  invitationResponseDeadline: string | null;
  attendanceConfirmationDeadline: string | null;
  attendanceConfirmationRequired: boolean;
  lateConfirmationPolicy: string;
};

const isUuid = (value?: string) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

const demoInvitations: Invitation[] = [
  {
    id: "inv-demo-1",
    institutionId: "inst-demo-1",
    institutionName: "Ma'had Ilmu Sunnah Bandung",
    invitationNumber: "INV/2026/BDG/001",
    quota: 3,
    status: "ACCEPTED",
    sentAt: "2026-07-20T08:00:00Z",
    respondedAt: "2026-07-22T10:30:00Z",
    responseDeadline: "2026-08-05T16:59:00Z",
  },
  {
    id: "inv-demo-2",
    institutionId: "inst-demo-2",
    institutionName: "Pesantren Al-Hikmah Garut",
    invitationNumber: "INV/2026/BDG/002",
    quota: 2,
    status: "SENT",
    sentAt: "2026-07-24T08:00:00Z",
    respondedAt: null,
    responseDeadline: "2026-08-05T16:59:00Z",
  },
];

const demoParticipants: Participant[] = [
  {
    id: "part-demo-1",
    ustadzId: "ustadz-preview-1",
    invitationId: "inv-demo-1",
    ustadzName: "Ustadz Abdullah, Lc.",
    ustadzEmail: "abdullah@example.org",
    ustadzPhone: "0812 9999 0000",
    ustadzWhatsapp: "0812 9999 0000",
    ustadzAddress: "Bandung, Jawa Barat",
    eventName: "Contoh Daurah Asatidz",
    eventStartDate: "2026-08-15",
    eventEndDate: "2026-08-18",
    eventVenueName: "Masjid Al-Furqan",
    eventVenueAddress: "Bandung, Jawa Barat",
    participantCode: "YTS-BDG001-01",
    isDelegationLead: true,
    confirmationStatus: "CONFIRMED",
    approvalStatus: "APPROVED",
    institutionName: "Ma'had Ilmu Sunnah Bandung",
    registrationSource: "INSTITUTION_INVITATION",
    registeredAt: "2026-07-22T10:30:00+07:00",
  },
  {
    id: "part-demo-2",
    ustadzId: "ustadz-preview-2",
    invitationId: "inv-demo-1",
    ustadzName: "Ustadz Hasan Basri",
    ustadzEmail: null,
    ustadzPhone: "0812 8888 1111",
    ustadzWhatsapp: "0812 8888 1111",
    ustadzAddress: null,
    eventName: "Contoh Daurah Asatidz",
    eventStartDate: "2026-08-15",
    eventEndDate: "2026-08-18",
    eventVenueName: "Masjid Al-Furqan",
    eventVenueAddress: "Bandung, Jawa Barat",
    participantCode: "YTS-BDG001-02",
    isDelegationLead: false,
    confirmationStatus: "CONFIRMED",
    approvalStatus: "PENDING_REVIEW",
    institutionName: "Ma'had Ilmu Sunnah Bandung",
    registrationSource: "INSTITUTION_INVITATION",
    registeredAt: "2026-07-22T10:42:00+07:00",
  },
];

const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const token = localStorage.getItem("yts_auth_token") || "";
  const response = await fetch(`${ENV.API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(token ? { Authorization: token } : {}),
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Permintaan gagal diproses.");
  return result.data as T;
};

const formatRegisteredAt = (value: string | null) => {
  if (!value) return { date: "Belum tersedia", time: "—" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "Belum tersedia", time: "—" };
  return {
    date: new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(date),
    time: new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
      timeZoneName: "short",
    }).format(date),
  };
};

const participantTemplateHeaders = [
  "fullName",
  "email",
  "whatsapp",
  "phone",
  "institutionCode",
  "institutionName",
  "isDelegationLead",
  "approvalStatus",
  "participantCode",
  "address",
  "notes",
];

const participantTemplateRows = [
  [
    "Ustadz Ahmad Abdullah",
    "ahmad.abdullah@example.org",
    "081234567890",
    "081234567890",
    "INST-BDG-001",
    "",
    "TRUE",
    "PENDING_REVIEW",
    "",
    "Bandung",
    "Kepala rombongan lembaga",
  ],
  [
    "Ustadz Hasan Basri",
    "hasan.basri@example.org",
    "081298765432",
    "081298765432",
    "",
    "",
    "FALSE",
    "APPROVED",
    "",
    "Garut",
    "Peserta individu",
  ],
];

const escapeCsvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

export const EventRegistrationsPage: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const participantView = searchParams.get("view") === "participants";
  const demoMode = import.meta.env.DEV && !isUuid(id);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [participantPage, setParticipantPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [participantBusy, setParticipantBusy] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [participantImportRows, setParticipantImportRows] = useState<ParticipantImportRow[]>([]);
  const [participantImportPreview, setParticipantImportPreview] = useState<ParticipantImportPreview | null>(null);
  const [participantImportFileName, setParticipantImportFileName] = useState("");
  const [participantImportMessage, setParticipantImportMessage] = useState("");
  const [participantImportFailures, setParticipantImportFailures] = useState<{ line: number; participantCode: string; error: string }[]>([]);
  const [participantImportBusy, setParticipantImportBusy] = useState<"preview" | "commit" | "">("");
  const [participantImportProgress, setParticipantImportProgress] = useState<{ processed: number; total: number } | null>(null);
  const [copied, setCopied] = useState("");
  const [createdLink, setCreatedLink] = useState("");
  const [createdAccessCode, setCreatedAccessCode] = useState("");
  const [createdInvitation, setCreatedInvitation] = useState<Invitation | null>(null);
  const [invitationLinks, setInvitationLinks] = useState<Record<string, string>>({});
  const [invitationAccessCodes, setInvitationAccessCodes] = useState<Record<string, string>>({});
  const [linkBusy, setLinkBusy] = useState("");
  const [eventDeadline, setEventDeadline] = useState<EventDeadline | null>(null);
  const [form, setForm] = useState({
    institutionId: "",
    invitationNumber: "",
    quota: 2,
    responseDeadline: "",
  });

  const loadData = async () => {
    setLoading(true);
    setError("");
    if (demoMode) {
      setInvitations(demoInvitations);
      setParticipants(demoParticipants);
      setInstitutions([
        { id: "inst-demo-1", code: "MISB-01", name: "Ma'had Ilmu Sunnah Bandung", email: "kontak@mahadsunnahbdg.or.id", whatsapp: "081200001111" },
        { id: "inst-demo-2", code: "PAHG-02", name: "Pesantren Al-Hikmah Garut", email: "sekretariat@alhikmah.or.id", whatsapp: "081200002222" },
      ]);
      setEventDeadline({
        name: "Contoh Daurah Asatidz",
        invitationResponseDeadline: "2026-08-05T16:59:59Z",
        attendanceConfirmationDeadline: null,
        attendanceConfirmationRequired: true,
        lateConfirmationPolicy: "BLOCK",
      });
      setLoading(false);
      return;
    }
    try {
      const [invitationData, participantData, institutionData, deadlineData] = await Promise.all([
        api<Invitation[]>(`/events/${id}/invitations`),
        api<Participant[]>(`/events/${id}/participants`),
        api<Institution[] | { data: Institution[] }>("/institutions?pageSize=100"),
        api<EventDeadline>(`/events/${id}`),
      ]);
      setInvitations(invitationData || []);
      setParticipants(participantData || []);
      setInstitutions(Array.isArray(institutionData) ? institutionData : institutionData.data || []);
      setEventDeadline(deadlineData);
      setForm((current) => ({
        ...current,
        responseDeadline: current.responseDeadline || (deadlineData.invitationResponseDeadline ? deadlineData.invitationResponseDeadline.slice(0, 10) : ""),
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Data registrasi gagal dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id]);

  const filtered = useMemo(
    () =>
      invitations.filter((invitation) => {
        const matchesSearch = `${invitation.institutionName} ${invitation.invitationNumber}`
          .toLowerCase()
          .includes(search.toLowerCase());
        return matchesSearch && (statusFilter === "ALL" || invitation.status === statusFilter);
      }),
    [invitations, search, statusFilter]
  );
  const filteredParticipants = useMemo(
    () =>
      participants.filter((participant) => {
        const matchesSearch = `${participant.ustadzName} ${participant.participantCode} ${participant.institutionName || ""}`
          .toLowerCase()
          .includes(search.toLowerCase());
        return matchesSearch && (statusFilter === "ALL" || participant.approvalStatus === statusFilter);
      }),
    [participants, search, statusFilter]
  );
  const participantPageCount = Math.max(1, Math.ceil(filteredParticipants.length / 25));
  const visibleParticipantPage = Math.min(participantPage, participantPageCount);
  const pagedParticipants = filteredParticipants.slice((visibleParticipantPage - 1) * 25, visibleParticipantPage * 25);

  useEffect(() => { setParticipantPage(1); }, [id, search, statusFilter]);

  const acceptedCount = invitations.filter((item) => item.status === "ACCEPTED").length;
  const awaitingCount = invitations.filter((item) => ["DRAFT", "SENT", "OPENED"].includes(item.status)).length;
  const approvedCount = participants.filter((item) => item.approvalStatus === "APPROVED").length;
  const toAbsoluteInvitationUrl = (publicUrl: string) => new URL(publicUrl, window.location.origin).toString();
  const institutionForInvitation = (invitation: Invitation) =>
    institutions.find((institution) => institution.id === invitation.institutionId);
  const shareContextFor = (invitation: Invitation, invitationUrl: string) => ({
    institutionName: invitation.institutionName || institutionForInvitation(invitation)?.name || "Lembaga penerima",
    eventName: eventDeadline?.name || "Daurah Asatidz",
    invitationNumber: invitation.invitationNumber,
    invitationUrl,
    accessCode: invitationAccessCodes[invitation.id] || (createdInvitation?.id === invitation.id ? createdAccessCode : ""),
    responseDeadline: invitation.responseDeadline || eventDeadline?.invitationResponseDeadline,
  });

  const createInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (demoMode) {
        const rawToken = "inv_inst_demo_tautan_khusus_lembaga";
        const institutionName = institutions.find((institution) => institution.id === form.institutionId)?.name || "Lembaga penerima";
        setCreatedLink(`${window.location.origin}${buildInstitutionInvitationPath(institutionName, rawToken)}`);
        setCreatedAccessCode("AMAN-2026");
        setCreatedInvitation({
          id: "inv-demo-created",
          institutionId: form.institutionId,
          institutionName: institutions.find((institution) => institution.id === form.institutionId)?.name || "Lembaga penerima",
          invitationNumber: form.invitationNumber.trim(),
          quota: form.quota,
          status: "DRAFT",
          sentAt: null,
          respondedAt: null,
          responseDeadline: form.responseDeadline ? `${form.responseDeadline}T23:59:59+07:00` : null,
        });
      } else {
        const created = await api<{ invitation: Invitation; publicUrl: string; accessCode: string }>(`/events/${id}/invitations`, {
          method: "POST",
          body: JSON.stringify({
            ...form,
            invitationNumber: form.invitationNumber.trim(),
            responseDeadline: form.responseDeadline ? `${form.responseDeadline}T23:59:59+07:00` : null,
            invitationType: "INSTITUTION",
          }),
        });
        const absoluteUrl = toAbsoluteInvitationUrl(created.publicUrl);
        setCreatedLink(absoluteUrl);
        setCreatedAccessCode(created.accessCode);
        setCreatedInvitation(created.invitation);
        setInvitationLinks((current) => ({ ...current, [created.invitation.id]: absoluteUrl }));
        setInvitationAccessCodes((current) => ({ ...current, [created.invitation.id]: created.accessCode }));
        await loadData();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Undangan gagal dibuat.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1800);
  };

  const updateInvitation = async (invitation: Invitation, action: "send" | "revoke") => {
    if (demoMode) {
      setInvitations((current) =>
        current.map((item) =>
          item.id === invitation.id ? { ...item, status: action === "send" ? "SENT" : "REVOKED" } : item
        )
      );
      return;
    }
    try {
      await api(`/events/${id}/invitations/${invitation.id}/${action}`, { method: "POST" });
      await loadData();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Status undangan gagal diperbarui.");
    }
  };

  const regenerateInvitationLink = async (invitation: Invitation) => {
    setLinkBusy(invitation.id);
    setError("");
    try {
      const regenerated = demoMode
        ? { publicUrl: buildInstitutionInvitationPath(invitation.institutionName || "Lembaga penerima", `inv_inst_demo_${invitation.id}`), accessCode: "AMAN-2026" }
        : await api<{ publicUrl: string; accessCode: string }>(
            `/events/${id}/invitations/${invitation.id}/regenerate-link`,
            { method: "POST" },
          );
      const absoluteUrl = toAbsoluteInvitationUrl(regenerated.publicUrl);
      setInvitationLinks((current) => ({ ...current, [invitation.id]: absoluteUrl }));
      setInvitationAccessCodes((current) => ({ ...current, [invitation.id]: regenerated.accessCode }));
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Tautan undangan gagal dibuat ulang.");
    } finally {
      setLinkBusy("");
    }
  };

  const revealInvitationAccessCode = async (invitation: Invitation) => {
    setLinkBusy(`code-${invitation.id}`);
    setError("");
    try {
      const result = demoMode
        ? { accessCode: "AMAN-2026" }
        : await api<{ accessCode: string }>(`/events/${id}/invitations/${invitation.id}/access-code`);
      setInvitationAccessCodes((current) => ({ ...current, [invitation.id]: result.accessCode }));
    } catch (codeError) {
      setError(codeError instanceof Error ? codeError.message : "Kode unik lembaga tidak dapat ditampilkan.");
    } finally {
      setLinkBusy("");
    }
  };

  const approveParticipants = async (participantIds: string[]) => {
    if (participantIds.length === 0) return;
    setParticipantBusy(participantIds.length > 1 ? "bulk" : participantIds[0]);
    setError("");
    if (demoMode) {
      setParticipants((current) =>
        current.map((participant) =>
          participantIds.includes(participant.id) ? { ...participant, approvalStatus: "APPROVED" } : participant
        )
      );
      setSelectedParticipants([]);
      setParticipantBusy("");
      return;
    }
    try {
      if (participantIds.length === 1) {
        await api(`/events/${id}/participants/${participantIds[0]}/approve`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      } else {
        await api(`/events/${id}/participants/bulk-approve`, {
          method: "POST",
          body: JSON.stringify({ participantIds }),
        });
      }
      setSelectedParticipants([]);
      await loadData();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Persetujuan peserta gagal diproses.");
    } finally {
      setParticipantBusy("");
    }
  };

  const downloadParticipantTemplate = () => {
    const csv = [
      participantTemplateHeaders.map(escapeCsvCell).join(","),
      ...participantTemplateRows.map((row) => row.map(escapeCsvCell).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `template-peserta-${eventDeadline?.name || id || "event"}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .concat(".csv");
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleParticipantImportFile = async (file: File | null) => {
    setParticipantImportProgress(null);
    setParticipantImportMessage("");
    setParticipantImportFailures([]);
    setParticipantImportPreview(null);
    setParticipantImportRows([]);
    if (!file) return;
    setParticipantImportFileName(file.name);
    let rows: ParticipantImportRow[];
    try {
      if (file.size > 1024 * 1024) throw new Error("File CSV maksimal 1 MB.");
      rows = parseParticipantCsv(await file.text());
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "File CSV tidak dapat dibaca.");
      return;
    }
    setParticipantImportRows(rows);
    if (rows.length === 0) {
      setError("File CSV belum berisi data peserta. Pastikan baris pertama adalah header template.");
      return;
    }
    if (demoMode) {
      setParticipantImportPreview({
        totalRows: rows.length,
        validCount: rows.length,
        alreadyImportedCount: 0,
        invalidCount: 0,
        duplicateCount: 0,
        missingInstitutionCount: 0,
        errorReport: [],
        duplicateReport: [],
        previewData: rows.map((row, index) => ({
          ...row,
          line: index + 2,
          resolvedInstitutionName: row.institutionName || (row.institutionCode ? "Lembaga contoh" : null),
          finalParticipantCode: row.participantCode || `ADA-DEMO-${String(index + 1).padStart(3, "0")}`,
        })),
      });
      setParticipantImportMessage("Preview demo siap. Impor tidak akan mengubah database karena event ini masih mode pratinjau.");
      return;
    }
    setParticipantImportBusy("preview");
    setError("");
    try {
      const preview = await api<ParticipantImportPreview>(`/events/${id}/participants/import/preview`, {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      setParticipantImportPreview(preview);
      setParticipantImportMessage(`${preview.validCount} baris siap diimpor${preview.alreadyImportedCount ? `, ${preview.alreadyImportedCount} sudah pernah diimpor` : ""}.`);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Preview import peserta gagal diproses.");
    } finally {
      setParticipantImportBusy("");
    }
  };

  const commitParticipantImport = async () => {
    if (!participantImportPreview || participantImportRows.length === 0) return;
    if (participantImportPreview.invalidCount > 0 || participantImportPreview.duplicateCount > 0) {
      setError("Perbaiki baris invalid atau duplikat sebelum impor final.");
      return;
    }
    if (demoMode) {
      const imported = participantImportPreview.previewData.map((row, index): Participant => ({
        id: `part-upload-demo-${index}`,
        ustadzId: `ustadz-upload-demo-${index}`,
        invitationId: null,
        ustadzName: row.fullName,
        ustadzEmail: row.email || null,
        ustadzPhone: row.phone || null,
        ustadzWhatsapp: row.whatsapp || row.phone || null,
        ustadzAddress: row.address || null,
        eventName: eventDeadline?.name || "Contoh Daurah Asatidz",
        eventStartDate: eventDeadline?.startDate || null,
        eventEndDate: eventDeadline?.endDate || null,
        eventVenueName: eventDeadline?.venueName || null,
        eventVenueAddress: null,
        participantCode: row.finalParticipantCode,
        isDelegationLead: Boolean(row.isDelegationLead),
        confirmationStatus: "CONFIRMED",
        approvalStatus: row.approvalStatus || "PENDING_REVIEW",
        institutionName: row.resolvedInstitutionName,
        registrationSource: "DIRECT_ADMIN_UPLOAD",
        registeredAt: new Date().toISOString(),
      }));
      setParticipants((current) => [...imported, ...current]);
      setParticipantImportMessage(`${imported.length} peserta demo ditambahkan ke tampilan pratinjau.`);
      setParticipantImportPreview(null);
      setParticipantImportRows([]);
      return;
    }
    setParticipantImportBusy("commit");
    setError("");
    const rowsToSave = participantImportPreview.previewData.map((row) => ({
      ...participantImportRows[row.line - 2], participantCode: row.finalParticipantCode,
      sourceLine: row.line,
    }));
    const total = participantImportRows.length;
    let processed = participantImportPreview.alreadyImportedCount;
    let importedCount = 0;
    let reusedCount = 0;
    const failures: typeof participantImportFailures = [];
    setParticipantImportProgress({ processed, total });
    try {
      for (let offset = 0; offset < rowsToSave.length; offset += 20) {
        const batch = rowsToSave.slice(offset, offset + 20);
        const result = await api<{ status: "SUCCESS" | "PARTIAL"; importedCount: number; skippedCount: number; reusedProfileCount: number; failureReport: { line: number; participantCode: string; error: string }[] }>(`/events/${id}/participants/import/commit`, {
          method: "POST", body: JSON.stringify({ rows: batch.map(({ sourceLine: _line, ...row }) => row), approved: true }),
        });
        importedCount += result.importedCount;
        reusedCount += result.reusedProfileCount || 0;
        failures.push(...(result.failureReport || []).map((failure) => ({ ...failure,
          line: batch[failure.line - 2]?.sourceLine || failure.line })));
        processed += batch.length;
        setParticipantImportProgress({ processed, total });
        setParticipantImportMessage(`${processed}/${total} baris diproses (${Math.round(processed / total * 100)}%). ${importedCount} peserta tersimpan.`);
      }
      setParticipantImportFailures(failures);
      setParticipantImportMessage(`${importedCount} peserta berhasil diimpor; ${reusedCount} profil asatidz lama tertaut ke event ini${participantImportPreview.alreadyImportedCount ? `, ${participantImportPreview.alreadyImportedCount} sudah ada` : ""}${failures.length ? `, ${failures.length} gagal` : ""}.`);
      if (!failures.length) {
        setParticipantImportPreview(null);
        setParticipantImportRows([]);
      }
      await loadData();
    } catch (commitError) {
      await loadData();
      setError(`${commitError instanceof Error ? commitError.message : "Impor peserta terhenti."} ${importedCount} peserta sudah tersimpan; ulangi impor file yang sama untuk melewati yang sudah ada.`);
    } finally {
      setParticipantImportBusy("");
    }
  };

  if (participantView) {
    return (
      <AdminLayout>
        <PageHeader
          title="Peserta event"
          description="Tinjau kesiapan setiap individu, termasuk asatidz yang didaftarkan melalui lembaga."
          breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event", href: "/admin/events" }, { label: "Peserta" }]}
        />
        <EventWorkspaceNav eventId={id} />
        {demoMode && (
          <div className="mb-5 border-t-2 border-amber-500 bg-amber-50 p-3 text-xs text-amber-950">
            Mode pratinjau aktif. Tindakan persetujuan tidak mengubah database.
          </div>
        )}
        {error && <div role="alert" className="mb-5 border-t-2 border-rose-500 bg-rose-50 p-3 text-xs text-rose-900">{error}</div>}
        <section className="grid grid-cols-2 border-y border-slate-200 bg-white sm:grid-cols-4">
          {[
            ["Total peserta", participants.length],
            ["Disetujui", approvedCount],
            ["Menunggu tinjauan", participants.filter((item) => item.approvalStatus === "PENDING_REVIEW").length],
            ["Delegasi lembaga", participants.filter((item) => item.institutionName).length],
          ].map(([label, value]) => (
            <div key={String(label)} className="border-b border-r border-slate-200 p-4">
              <p className="text-2xl font-black tabular-nums text-slate-950">{loading ? "—" : value}</p>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
            </div>
          ))}
        </section>
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
                <h2 className="text-sm font-black text-slate-950">Upload peserta event</h2>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Gunakan CSV untuk menambahkan peserta massal. Kolom lembaga boleh memakai kode lembaga yang sudah ada; kosongkan bila peserta individu.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadParticipantTemplate}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <Download className="h-4 w-4" />
                Unduh template
              </button>
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white hover:bg-emerald-800 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-700">
                {participantImportBusy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Pilih CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(event) => {
                    void handleParticipantImportFile(event.target.files?.[0] || null);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {(participantImportMessage || participantImportFileName) && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
              <span className="font-bold">{participantImportFileName || "Template peserta"}</span>
              {participantImportMessage ? <span className="ml-2">{participantImportMessage}</span> : null}
            </div>
          )}

          {participantImportProgress && <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3" role="status" aria-live="polite"><div className="flex items-center justify-between text-xs font-bold text-emerald-900"><span>Progres impor peserta</span><span>{Math.round(participantImportProgress.processed / Math.max(1, participantImportProgress.total) * 100)}% · {participantImportProgress.processed}/{participantImportProgress.total}</span></div><progress className="mt-2 h-3 w-full accent-emerald-700" max={participantImportProgress.total} value={participantImportProgress.processed} /></div>}

          {participantImportFailures.length > 0 && (
            <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">
              <p className="font-black">{participantImportFailures.length} baris gagal. Perbaiki datanya atau tekan Impor peserta untuk mencoba ulang file yang sama.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {participantImportFailures.slice(0, 20).map((failure) => <li key={`${failure.line}-${failure.participantCode}`}>Baris {failure.line} ({failure.participantCode}): {failure.error}</li>)}
              </ul>
            </div>
          )}

          {participantImportPreview && (
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="min-w-0 overflow-x-auto rounded-lg border border-slate-200">
                <div className="grid min-w-[54rem] grid-cols-[4rem_minmax(12rem,1fr)_minmax(12rem,1fr)_10rem_10rem] gap-3 bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  <span>Baris</span>
                  <span>Nama</span>
                  <span>Lembaga</span>
                  <span>Kode</span>
                  <span>Status</span>
                </div>
                <div className="max-h-64 min-w-[54rem] divide-y divide-slate-100 overflow-y-auto bg-white">
                  {participantImportPreview.previewData.slice(0, 25).map((row) => (
                    <div key={`${row.line}-${row.finalParticipantCode}`} className="grid grid-cols-[4rem_minmax(12rem,1fr)_minmax(12rem,1fr)_10rem_10rem] gap-3 px-3 py-3 text-sm">
                      <span className="font-mono text-slate-500">{row.line}</span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-950">{row.fullName}</p>
                         <p className="truncate text-xs text-slate-500">{row.email || row.whatsapp || row.phone || "Kontak belum diisi"}</p>
                         {row.matchedUstadzId && <p className="text-xs font-bold text-emerald-800">Profil sudah ada · {row.previousApprovedEvents || 0} event sebelumnya disetujui{row.approvalStatus === "APPROVED" ? " · jika impor berhasil akan bertambah 1" : ""}</p>}
                      </div>
                      <span className="truncate text-slate-600">{row.resolvedInstitutionName || row.institutionName || "Individu"}</span>
                      <span className="truncate font-mono text-xs font-bold text-emerald-800">{row.finalParticipantCode}</span>
                      <StatusBadge label={(row.approvalStatus || "PENDING_REVIEW").replaceAll("_", " ")} variant={row.approvalStatus === "APPROVED" ? "success" : "warning"} />
                    </div>
                  ))}
                </div>
              </div>
              <aside className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  {[
                    ["Baris", participantImportPreview.totalRows],
                    ["Siap", participantImportPreview.validCount],
                    ["Sudah ada", participantImportPreview.alreadyImportedCount],
                    ["Invalid", participantImportPreview.invalidCount],
                    ["Duplikat", participantImportPreview.duplicateCount],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg bg-white p-3">
                      <p className="text-lg font-black tabular-nums text-slate-950">{value}</p>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
                {(participantImportPreview.errorReport.length > 0 || participantImportPreview.duplicateReport.length > 0) && (
                  <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                    <div className="mb-2 flex items-center gap-2 font-bold">
                      <AlertTriangle className="h-4 w-4" />
                      Perlu diperbaiki
                    </div>
                    {[...participantImportPreview.errorReport, ...participantImportPreview.duplicateReport.map((item) => ({ line: item.line, field: item.key, error: item.reason }))].slice(0, 8).map((item) => (
                      <p key={`${item.line}-${item.field}-${item.error}`} className="mt-1">
                        Baris {item.line}: {item.error}
                      </p>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void commitParticipantImport()}
                  disabled={participantImportBusy === "commit" || participantImportPreview.validCount === 0 || participantImportPreview.invalidCount > 0 || participantImportPreview.duplicateCount > 0}
                  className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {participantImportBusy === "commit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Impor peserta
                </button>
              </aside>
            </div>
          )}
        </section>
        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
          <label className="relative block"><span className="sr-only">Cari peserta</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, kode peserta, atau lembaga" className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-xs" /></label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold"><option value="ALL">Semua status</option><option value="PENDING_REVIEW">Menunggu tinjauan</option><option value="APPROVED">Disetujui</option><option value="WAITLISTED">Daftar tunggu</option><option value="DECLINED">Ditolak</option></select>
        </div>
        {selectedParticipants.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t-2 border-emerald-700 bg-emerald-50 p-3">
            <p className="text-xs font-bold text-emerald-950">{selectedParticipants.length} peserta dipilih</p>
            <button type="button" onClick={() => void approveParticipants(selectedParticipants)} disabled={Boolean(participantBusy)} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-800 px-4 text-xs font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" /> Setujui terpilih</button>
          </div>
        )}
        <div className="mt-4 overflow-x-auto border border-slate-200 bg-white">
          <div className="hidden min-w-[82rem] grid-cols-[2rem_9rem_minmax(12rem,1fr)_minmax(10rem,1fr)_10rem_9rem_9rem_18rem] gap-3 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-600 lg:grid">
            <span className="sr-only">Pilih</span><span>Kode</span><span>Asatidz</span><span>Lembaga</span><span>Waktu daftar</span><span>Konfirmasi</span><span>Persetujuan</span><span>Aksi</span>
          </div>
          {loading ? <div className="h-64 animate-pulse bg-slate-100" /> : filteredParticipants.length ? (
            <ul className="divide-y divide-slate-100">
               {pagedParticipants.map((participant) => {
                const registrationTime = formatRegisteredAt(participant.registeredAt);
                return (
                <li key={participant.id} className="grid gap-3 px-4 py-4 text-sm lg:min-w-[82rem] lg:grid-cols-[2rem_9rem_minmax(12rem,1fr)_minmax(10rem,1fr)_10rem_9rem_9rem_18rem] lg:items-center lg:gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Pilih ${participant.ustadzName}`}
                    checked={selectedParticipants.includes(participant.id)}
                    onChange={(event) => setSelectedParticipants((current) => event.target.checked ? [...current, participant.id] : current.filter((item) => item !== participant.id))}
                    disabled={participant.approvalStatus === "APPROVED"}
                    className="h-4 w-4 accent-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span className="font-mono font-bold text-emerald-800">{participant.participantCode}</span>
                   <div className="min-w-0"><p className="truncate font-black text-slate-900">{participant.ustadzName}</p><p className="mt-1 truncate text-sm text-slate-600">{participant.ustadzWhatsapp || participant.ustadzPhone || participant.ustadzEmail || "Kontak belum diisi"}</p>{(participant.eventParticipationCount || 0) > 1 && <Link to={`/admin/ustadz/${participant.ustadzId}`} className="mt-1 inline-block text-xs font-bold text-emerald-800 underline">Terdaftar di {participant.eventParticipationCount} event · lihat riwayat</Link>}{participant.publicGroupId && <p className="mt-1 text-xs font-bold text-emerald-800">{participant.isDelegationLead ? "Kepala rombongan reguler" : "Anggota rombongan reguler"}</p>}</div>
                  <span className="truncate text-slate-500">{participant.institutionName || (participant.publicGroupId ? `Rombongan ${participant.publicGroupId.slice(0, 8)}` : "Individu")}</span>
                  <div className="flex items-start gap-2 text-slate-700">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <div>
                      <time dateTime={participant.registeredAt || undefined} className="block whitespace-nowrap font-bold">{registrationTime.date}</time>
                      <span className="mt-0.5 block whitespace-nowrap text-xs text-slate-500">{registrationTime.time}</span>
                    </div>
                  </div>
                  <StatusBadge label={participant.confirmationStatus.replaceAll("_", " ")} variant={participant.confirmationStatus === "CONFIRMED" ? "success" : "neutral"} />
                   <div><StatusBadge label={participant.approvalStatus.replaceAll("_", " ")} variant={participant.approvalStatus === "APPROVED" ? "success" : participant.approvalStatus === "PENDING_REVIEW" ? "warning" : "neutral"} />{["REJECTED", "DECLINED", "WAITLISTED", "PENDING_REVIEW"].includes(participant.approvalStatus) && <p className="mt-1 text-xs text-amber-900">{participant.statusReason ? `Alasan: ${participant.statusReason}` : "Alasan belum dicatat"}</p>}</div>
                  <div className="flex flex-wrap gap-2">
                    <ParticipantProfileDialog
                      participant={{
                        id: participant.id,
                        ustadzId: participant.ustadzId,
                        name: participant.ustadzName,
                        participantCode: participant.participantCode,
                        institutionName: participant.institutionName,
                        email: participant.ustadzEmail,
                        phone: participant.ustadzPhone,
                        whatsapp: participant.ustadzWhatsapp,
                        address: participant.ustadzAddress,
                        approvalStatus: participant.approvalStatus,
                        confirmationStatus: participant.confirmationStatus,
                        registrationSource: participant.registrationSource,
                        registeredAt: participant.registeredAt,
                        eventName: participant.eventName,
                      }}
                      masterProfileHref={`/admin/ustadz/${participant.ustadzId}`}
                    />
                    <ParticipantCommunicationPanel
                      disabled={demoMode}
                      participant={{
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
                      }}
                      senderRole="admin"
                      initialTemplate={participant.invitationId ? "EVENT_INVITATION" : "REGULAR_REGISTRATION"}
                      event={{
                        name: participant.eventName,
                        startDate: participant.eventStartDate,
                        endDate: participant.eventEndDate,
                        venueName: participant.eventVenueName,
                        venueAddress: participant.eventVenueAddress,
                        publicUrl: eventDeadline?.slug ? `${window.location.origin}/events/${encodeURIComponent(eventDeadline.slug)}` : undefined,
                      }}
                    />
                    <ParticipantPortalAccessAction
                      eventId={id}
                      participant={{
                        id: participant.id,
                        name: participant.ustadzName,
                        email: participant.ustadzEmail,
                        portalPasswordConfigured: participant.portalPasswordConfigured,
                      }}
                      previewMode={demoMode}
                      onCompleted={() => setParticipants((current) => current.map((item) => item.id === participant.id ? { ...item, portalPasswordConfigured: true, portalAccountStatus: "ACTIVE" } : item))}
                    />
                    {participant.approvalStatus === "PENDING_REVIEW" && (
                      <button
                        type="button"
                        onClick={() => void approveParticipants([participant.id])}
                        disabled={Boolean(participantBusy)}
                        className="min-h-[44px] whitespace-nowrap rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Setujui
                      </button>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
           ) : <div className="p-10 text-center text-xs text-slate-500">Tidak ada peserta yang cocok.</div>}
         </div>
         {filteredParticipants.length > 0 && <nav aria-label="Halaman peserta event" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm"><span>Menampilkan {(visibleParticipantPage - 1) * 25 + 1}–{Math.min(visibleParticipantPage * 25, filteredParticipants.length)} dari {filteredParticipants.length} peserta</span><div className="flex items-center gap-2"><button type="button" disabled={visibleParticipantPage <= 1} onClick={() => setParticipantPage(visibleParticipantPage - 1)} className="min-h-11 rounded-lg border border-slate-300 px-3 disabled:opacity-50">Sebelumnya</button><span>Halaman {visibleParticipantPage}/{participantPageCount}</span><button type="button" disabled={visibleParticipantPage >= participantPageCount} onClick={() => setParticipantPage(visibleParticipantPage + 1)} className="min-h-11 rounded-lg border border-slate-300 px-3 disabled:opacity-50">Berikutnya</button></div></nav>}
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <PageHeader
        title="Undangan & pendaftar"
        description="Pantau konfirmasi lembaga, delegasi asatidz, persetujuan peserta, dan kesiapan check-in individual."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Event", href: "/admin/events" },
          { label: "Registrasi" },
        ]}
        actions={
          <Link
            to={`/admin/events/${id}`}
            className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Detail event
          </Link>
        }
      />
      <EventWorkspaceNav eventId={id} />

      {eventDeadline && (
        <div className="mb-5 grid gap-3 border-y border-slate-200 bg-white p-4 text-sm sm:grid-cols-2">
          <div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Batas respons undangan</p><p className="mt-1 font-black text-slate-950">{eventDeadline.invitationResponseDeadline ? new Date(eventDeadline.invitationResponseDeadline).toLocaleString("id-ID") : "Tidak dibatasi"}</p></div>
          <div><p className="text-xs font-black uppercase tracking-wide text-slate-500">Konfirmasi kehadiran</p><p className="mt-1 font-black text-slate-950">{eventDeadline.attendanceConfirmationDeadline ? new Date(eventDeadline.attendanceConfirmationDeadline).toLocaleString("id-ID") : "Tidak dibatasi"} · {eventDeadline.lateConfirmationPolicy}</p></div>
        </div>
      )}

      {demoMode && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Mode pratinjau aktif karena event contoh belum memakai UUID database. Seluruh interaksi tetap dapat dicoba tanpa
            mengubah data produksi.
          </p>
        </div>
      )}

      <section aria-label="Ringkasan registrasi" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Lembaga diundang", value: invitations.length, icon: Building2 },
          { label: "Sudah konfirmasi", value: acceptedCount, icon: CheckCircle2 },
          { label: "Menunggu respons", value: awaitingCount, icon: Clock3 },
          { label: "Peserta disetujui", value: approvedCount, icon: UserCheck },
        ].map((metric) => (
          <div key={metric.label} className="border-t-2 border-emerald-700 bg-white px-4 py-4 shadow-sm">
            <metric.icon className="mb-3 h-4 w-4 text-emerald-700" />
            <p className="text-2xl font-black tabular-nums text-slate-950">{loading ? "—" : metric.value}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">{metric.label}</p>
          </div>
        ))}
      </section>

      {error && (
        <div role="alert" className="mt-5 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <label htmlFor="registration-search" className="sr-only">Cari lembaga atau nomor undangan</label>
              <input
                id="registration-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari lembaga atau nomor undangan"
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-xs outline-transparent hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700"
              />
            </div>
            <label className="sr-only" htmlFor="registration-status">Filter status</label>
            <select
              id="registration-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700"
            >
              <option value="ALL">Semua status</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Terkirim</option>
              <option value="OPENED">Dibuka</option>
              <option value="ACCEPTED">Dikonfirmasi</option>
              <option value="DECLINED">Ditolak</option>
            </select>
          </div>

          {loading ? (
            <div className="space-y-3" aria-label="Memuat daftar undangan">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-32 animate-pulse rounded-xl bg-slate-200" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <Mail className="mx-auto h-8 w-8 text-slate-400" />
              <h2 className="mt-3 text-sm font-bold text-slate-900">Belum ada undangan yang cocok</h2>
              <p className="mt-1 text-xs text-slate-500">Ubah filter atau buat tautan undangan lembaga baru.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((invitation) => {
                const delegates = participants.filter((participant) => participant.invitationId === invitation.id);
                const recipientInstitution = institutionForInvitation(invitation);
                return (
                  <article key={invitation.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-emerald-800">
                            {invitation.invitationNumber}
                          </span>
                          <StatusBadge
                            label={invitation.status}
                            variant={invitation.status === "ACCEPTED" ? "success" : invitation.status === "DECLINED" ? "danger" : "info"}
                          />
                          {invitation.responseDeadline && new Date(invitation.responseDeadline) < new Date() && (
                            <StatusBadge label="Tenggat lewat" variant="danger" />
                          )}
                        </div>
                        <h2 className="mt-1 overflow-wrap-anywhere text-sm font-black text-slate-950">
                          {invitation.institutionName || "Undangan individu"}
                        </h2>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {delegates.length} dari {invitation.quota || 1} delegasi terdaftar
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!["REVOKED", "DECLINED"].includes(invitation.status) && (
                          <button
                            type="button"
                            onClick={() => void revealInvitationAccessCode(invitation)}
                            disabled={linkBusy === `code-${invitation.id}`}
                            className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {linkBusy === `code-${invitation.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                            Lihat kode
                          </button>
                        )}
                        {!["REVOKED", "DECLINED"].includes(invitation.status) && (
                          <button
                            type="button"
                            onClick={() => void regenerateInvitationLink(invitation)}
                            disabled={linkBusy === invitation.id}
                            className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-bold text-emerald-900 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {linkBusy === invitation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                            Buat ulang tautan
                          </button>
                        )}
                        {invitation.status === "DRAFT" && (
                          <button
                            onClick={() => void updateInvitation(invitation, "send")}
                            className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Tandai terkirim
                          </button>
                        )}
                        {!["REVOKED", "DECLINED"].includes(invitation.status) && (
                          <button
                            onClick={() => void updateInvitation(invitation, "revoke")}
                            className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
                          >
                            Cabut
                          </button>
                        )}
                      </div>
                    </div>

                    {invitationLinks[invitation.id] && (
                      <div className="border-t border-emerald-200 bg-emerald-50 px-4 py-3">
                        <p className="text-sm font-bold text-emerald-950">Tautan formulir khusus lembaga</p>
                        <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                          <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-sm leading-6 text-emerald-950">
                            {invitationLinks[invitation.id]}
                          </code>
                          <button
                            type="button"
                            onClick={() => void copyText(invitationLinks[invitation.id], `link-${invitation.id}`)}
                            className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-800 px-4 text-sm font-bold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                          >
                            {copied === `link-${invitation.id}` ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                            {copied === `link-${invitation.id}` ? "Tersalin" : "Salin tautan"}
                          </button>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-emerald-900">
                          Tautan sebelumnya otomatis dinonaktifkan. Bagikan URL ini kepada lembaga terkait.
                        </p>
                        {invitationAccessCodes[invitation.id] && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-white p-3">
                            <div>
                              <p className="text-xs font-bold text-emerald-800">Kode unik lembaga</p>
                              <p className="mt-1 font-mono text-xl font-black tracking-[0.16em] text-emerald-950">{invitationAccessCodes[invitation.id]}</p>
                            </div>
                            <button type="button" onClick={() => void copyText(invitationAccessCodes[invitation.id], `code-${invitation.id}`)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-emerald-300 px-3 text-sm font-bold text-emerald-900">
                              {copied === `code-${invitation.id}` ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                              {copied === `code-${invitation.id}` ? "Tersalin" : "Salin kode"}
                            </button>
                          </div>
                        )}
                        <InvitationShareActions
                          context={shareContextFor(invitation, invitationLinks[invitation.id])}
                          recipientWhatsapp={recipientInstitution?.whatsapp || recipientInstitution?.phone}
                          recipientEmail={recipientInstitution?.email}
                        />
                      </div>
                    )}

                    {!invitationLinks[invitation.id] && invitationAccessCodes[invitation.id] && (
                      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-bold text-slate-600">Kode unik lembaga</p>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                          <code className="font-mono text-lg font-black tracking-[0.14em] text-slate-950">{invitationAccessCodes[invitation.id]}</code>
                          <p className="text-xs text-slate-600">Buat ulang tautan untuk memperoleh URL yang dapat dibagikan bersama kode ini.</p>
                        </div>
                      </div>
                    )}

                    {delegates.length > 0 && (
                      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          {delegates.map((delegate) => (
                            <div key={delegate.id} className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="truncate text-xs font-bold text-slate-900">{delegate.ustadzName}</p>
                                  {delegate.isDelegationLead && (
                                    <span className="whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-900">
                                      PIC
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 truncate font-mono text-[10px] text-slate-500">{delegate.participantCode}</p>
                              </div>
                              <StatusBadge
                                label={delegate.approvalStatus === "APPROVED" ? "Siap check-in" : "Perlu review"}
                                variant={delegate.approvalStatus === "APPROVED" ? "success" : "warning"}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </main>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Plus className="h-4 w-4 text-emerald-700" />
            <h2 className="text-sm font-black text-slate-950">Buat undangan lembaga</h2>
          </div>
          <form onSubmit={createInvitation} className="mt-4 space-y-3">
            <div>
              <label htmlFor="institution" className="mb-1.5 block text-[11px] font-bold text-slate-700">Lembaga</label>
              <select
                id="institution"
                required
                value={form.institutionId}
                onChange={(event) => setForm({ ...form, institutionId: event.target.value })}
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700"
              >
                <option value="">Pilih lembaga</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>{institution.code} · {institution.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="invitation-number" className="mb-1.5 block text-[11px] font-bold text-slate-700">Nomor undangan</label>
              <input
                id="invitation-number"
                required
                value={form.invitationNumber}
                onChange={(event) => setForm({ ...form, invitationNumber: event.target.value })}
                placeholder="INV/2026/BDG/003"
                className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-xs outline-transparent hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="quota" className="mb-1.5 block text-[11px] font-bold text-slate-700">Kuota</label>
                <input
                  id="quota"
                  type="number"
                  min={1}
                  required
                  value={form.quota}
                  onChange={(event) => setForm({ ...form, quota: Number(event.target.value) })}
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700"
                />
              </div>
              <div>
                <label htmlFor="deadline" className="mb-1.5 block text-[11px] font-bold text-slate-700">Batas respons</label>
                <input
                  id="deadline"
                  type="date"
                  value={form.responseDeadline}
                  onChange={(event) => setForm({ ...form, responseDeadline: event.target.value })}
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-2 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-4 text-xs font-black text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {submitting ? "Membuat tautan…" : "Buat tautan khusus"}
            </button>
          </form>

          {createdLink && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-2 text-[11px] font-black text-emerald-900">
                <CheckCircle2 className="h-4 w-4" />
                Tautan siap dibagikan
              </div>
              <p className="mt-2 break-all font-mono text-[10px] leading-relaxed text-emerald-950">{createdLink}</p>
              {createdAccessCode && (
                <div className="mt-3 rounded-lg border border-emerald-300 bg-white p-3 text-center">
                  <p className="text-xs font-bold text-emerald-800">Kode unik lembaga</p>
                  <p className="mt-1 font-mono text-xl font-black tracking-[0.16em] text-emerald-950">{createdAccessCode}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => void copyText(createdLink, "new-link")}
                className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-emerald-300 bg-white px-3 text-xs font-bold text-emerald-900 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                {copied === "new-link" ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                {copied === "new-link" ? "Tersalin" : "Salin tautan"}
              </button>
              {createdInvitation ? (
                <InvitationShareActions
                  context={shareContextFor(createdInvitation, createdLink)}
                  recipientWhatsapp={institutionForInvitation(createdInvitation)?.whatsapp || institutionForInvitation(createdInvitation)?.phone}
                  recipientEmail={institutionForInvitation(createdInvitation)?.email}
                />
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </AdminLayout>
  );
};
