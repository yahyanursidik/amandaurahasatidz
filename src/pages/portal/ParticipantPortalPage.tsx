/* Hallmark · macrostructure: Map / Diagram · tone: utilitarian · anchor hue: emerald
 * genre: modern-minimal · theme: existing emerald-slate · nav: N3 · footer: Ft2
 * audience: peserta/asatidz · use: memastikan kesiapan hadir dan check-in individu
 * Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  MapPin,
  MessageCircle,
  QrCode,
  Save,
  ShieldCheck,
  Crown,
  UserRoundCog,
  X,
} from "lucide-react";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge, StatusVariant } from "@/components/common/StatusBadge";
import { eventApi } from "@/lib/eventApi";

type PortalTab =
  | "HOME"
  | "INVITATIONS"
  | "ACTIVITIES"
  | "SCHEDULE"
  | "QR"
  | "ANNOUNCEMENTS"
  | "PROFILE"
  | "ATTENDANCE";

type PortalSession = {
  id: string;
  dayNumber: number;
  dayDate: string;
  dayTitle?: string | null;
  title: string;
  sessionType: string;
  startAt: string;
  endAt: string;
  room?: string | null;
  attendanceRequired: boolean;
  checkinRequired: boolean;
};

type PortalAttendance = {
  id: string;
  attendanceStatus: string;
  checkinAt?: string | null;
  checkoutAt?: string | null;
  checkinMethod?: string | null;
  sessionTitle?: string | null;
  sessionStartAt?: string | null;
};

type PortalParticipation = {
  participantId: string;
  participantCode: string;
  registrationSource: string;
  invitationId?: string | null;
  isDelegationLead: boolean;
  confirmationStatus: string;
  approvalStatus: string;
  registeredAt: string;
  confirmedAt?: string | null;
  institutionName?: string | null;
  eventId: string;
  eventCode: string;
  eventSlug: string;
  eventName: string;
  eventSubtitle?: string | null;
  eventStatus: string;
  posterUrl?: string | null;
  posterAlt?: string | null;
  startDate: string;
  endDate: string;
  venueName?: string | null;
  venueAddress?: string | null;
  mapsUrl?: string | null;
  invitationResponseDeadline?: string | null;
  attendanceConfirmationDeadline?: string | null;
  sessions: PortalSession[];
  attendance: PortalAttendance[];
};

type DelegationMember = {
  participantId: string;
  participantCode: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  isDelegationLead: boolean;
  confirmationStatus: string;
  approvalStatus: string;
  registeredAt: string;
  hasCheckedIn: boolean;
  canReplace: boolean;
};

type PortalDelegation = {
  actorParticipantId: string;
  eventId: string;
  eventName: string;
  institutionId: string;
  institutionName?: string | null;
  quota: number;
  members: DelegationMember[];
};

type PortalOverview = {
  profile: {
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    address?: string | null;
    educationSummary?: string | null;
    expertiseSummary?: string | null;
    profileStatus: string;
    primaryInstitution?: {
      institutionName: string;
      institutionCode: string;
      position?: string | null;
    } | null;
  };
  participations: PortalParticipation[];
};

type PortalAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishedAt?: string | null;
  isRead: boolean;
};

type PortalQr = {
  participantId: string;
  eventId: string;
  eventName: string;
  participantCode: string;
  opaqueQrToken: string;
  status: string;
  ustadzName: string;
};

const DEFAULT_POSTER = "/images/event-poster-library-interior.png";

const previewOverview: PortalOverview = {
  profile: {
    id: "preview-ustadz",
    fullName: "Ustadz Abdullah, Lc.",
    email: "ustadz.demo@yts.or.id",
    phone: "0812 9999 0000",
    whatsapp: "0812 9999 0000",
    address: "Bandung, Jawa Barat",
    educationSummary: "S1 Syariah",
    expertiseSummary: "Fiqih muamalah dan pembinaan asatidz",
    profileStatus: "ACTIVE",
    primaryInstitution: {
      institutionName: "Ma'had Ilmu Sunnah Bandung",
      institutionCode: "MIS-BDG",
      position: "Pengajar",
    },
  },
  participations: [
    {
      participantId: "preview-participant",
      participantCode: "ADA-BDG-001",
      registrationSource: "INSTITUTION_DELEGATION",
      invitationId: "preview-invitation",
      isDelegationLead: true,
      confirmationStatus: "CONFIRMED",
      approvalStatus: "APPROVED",
      registeredAt: "2026-07-22T10:30:00+07:00",
      confirmedAt: "2026-07-23T09:15:00+07:00",
      institutionName: "Ma'had Ilmu Sunnah Bandung",
      eventId: "preview-event",
      eventCode: "ADA-2026-BDG",
      eventSlug: "daurah-asatidz-bandung-2026",
      eventName: "Daurah Asatidz Nasional 2026",
      eventSubtitle: "Penguatan amanah dakwah dan pengelolaan lembaga",
      eventStatus: "PUBLISHED",
      posterUrl: DEFAULT_POSTER,
      posterAlt: "Interior perpustakaan sebagai poster Daurah Asatidz",
      startDate: "2026-08-15",
      endDate: "2026-08-18",
      venueName: "Bandung",
      venueAddress: "Alamat lengkap akan diinformasikan panitia.",
      mapsUrl: null,
      invitationResponseDeadline: "2026-08-05T23:59:00+07:00",
      attendanceConfirmationDeadline: "2026-08-10T23:59:00+07:00",
      sessions: [
        {
          id: "preview-session-1",
          dayNumber: 1,
          dayDate: "2026-08-15",
          dayTitle: "Pembukaan",
          title: "Registrasi ulang dan pembukaan",
          sessionType: "OPENING",
          startAt: "2026-08-15T08:00:00+07:00",
          endAt: "2026-08-15T09:30:00+07:00",
          room: "Ruang utama",
          attendanceRequired: true,
          checkinRequired: true,
        },
        {
          id: "preview-session-2",
          dayNumber: 1,
          dayDate: "2026-08-15",
          dayTitle: "Materi",
          title: "Penguatan amanah dakwah",
          sessionType: "MATERIAL",
          startAt: "2026-08-15T10:00:00+07:00",
          endAt: "2026-08-15T12:00:00+07:00",
          room: "Ruang utama",
          attendanceRequired: true,
          checkinRequired: true,
        },
      ],
      attendance: [],
    },
  ],
};

const previewAnnouncements: PortalAnnouncement[] = [
  {
    id: "preview-announcement",
    title: "Persiapan sebelum berangkat",
    body: "Pastikan profil, nomor WhatsApp, dan kartu QR peserta sudah dapat dibuka sebelum tiba di lokasi.",
    publishedAt: "2026-07-30T10:00:00+07:00",
    isRead: false,
  },
];

const tabByPath: Record<string, PortalTab> = {
  "/portal": "HOME",
  "/portal/invitations": "INVITATIONS",
  "/portal/activities": "ACTIVITIES",
  "/portal/schedule": "SCHEDULE",
  "/portal/qr": "QR",
  "/portal/announcements": "ANNOUNCEMENTS",
  "/portal/profile": "PROFILE",
  "/portal/attendance": "ATTENDANCE",
};

const tabMeta: Record<PortalTab, { title: string; description: string }> = {
  HOME: {
    title: "Beranda peserta",
    description: "Lihat posisi Anda dalam alur persiapan dan tindakan yang perlu diselesaikan.",
  },
  INVITATIONS: {
    title: "Undangan saya",
    description: "Riwayat jalur pendaftaran, status konfirmasi, dan batas waktu setiap event.",
  },
  ACTIVITIES: {
    title: "Kegiatan saya",
    description: "Detail event, tempat pelaksanaan, dan identitas kepesertaan Anda.",
  },
  SCHEDULE: {
    title: "Jadwal daurah",
    description: "Susunan sesi, waktu, ruangan, dan kebutuhan presensi.",
  },
  QR: {
    title: "QR kehadiran individu",
    description: "Walaupun didaftarkan lembaga, check-in tetap dilakukan atas nama setiap peserta.",
  },
  ANNOUNCEMENTS: {
    title: "Pengumuman panitia",
    description: "Informasi operasional terbaru untuk peserta.",
  },
  PROFILE: {
    title: "Profil saya",
    description: "Perbarui kontak dan data pendukung tanpa mengubah identitas master.",
  },
  ATTENDANCE: {
    title: "Riwayat kehadiran",
    description: "Rekam check-in individu per sesi dan metode verifikasinya.",
  },
};

const formatDate = (value?: string | null, withTime = false) => {
  if (!value) return "Belum ditetapkan";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const statusVariant = (status: string): StatusVariant => {
  if (["APPROVED", "CONFIRMED", "ACTIVE", "PRESENT", "LATE"].includes(status)) return "success";
  if (["INVITED", "PENDING", "PENDING_REVIEW", "WAITLISTED"].includes(status)) return "warning";
  if (["CANCELLED", "DECLINED", "REPLACED"].includes(status)) return "danger";
  return "info";
};

const sourceLabel = (source: string) =>
  source === "INSTITUTION_DELEGATION"
    ? "Delegasi lembaga"
    : source === "INDIVIDUAL_INVITATION"
      ? "Undangan individual"
      : "Pendaftaran mandiri";

export const ParticipantPortalPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = tabByPath[location.pathname] || "HOME";
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [announcements, setAnnouncements] = useState<PortalAnnouncement[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [qr, setQr] = useState<PortalQr | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [copyDone, setCopyDone] = useState(false);
  const [profileState, setProfileState] = useState({
    phone: "",
    whatsapp: "",
    educationSummary: "",
    expertiseSummary: "",
    address: "",
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [delegation, setDelegation] = useState<PortalDelegation | null>(null);
  const [delegationLoading, setDelegationLoading] = useState(false);
  const [delegationError, setDelegationError] = useState("");
  const [replaceTarget, setReplaceTarget] = useState<DelegationMember | null>(null);
  const [replaceState, setReplaceState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [replacement, setReplacement] = useState({
    fullName: "",
    email: "",
    phone: "",
    whatsapp: "",
    address: "",
    reason: "",
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [overviewData, announcementData] = await Promise.all([
          eventApi<PortalOverview>("/portal/overview"),
          eventApi<PortalAnnouncement[]>("/portal/announcements").catch(() => []),
        ]);
        if (cancelled) return;
        setOverview(overviewData);
        setAnnouncements(announcementData);
        setSelectedParticipantId(overviewData.participations[0]?.participantId || "");
        setProfileState({
          phone: overviewData.profile.phone || "",
          whatsapp: overviewData.profile.whatsapp || overviewData.profile.phone || "",
          educationSummary: overviewData.profile.educationSummary || "",
          expertiseSummary: overviewData.profile.expertiseSummary || "",
          address: overviewData.profile.address || "",
        });
      } catch (loadError) {
        if (cancelled) return;
        setPreview(true);
        setOverview(previewOverview);
        setAnnouncements(previewAnnouncements);
        setSelectedParticipantId(previewOverview.participations[0].participantId);
        setProfileState({
          phone: previewOverview.profile.phone || "",
          whatsapp: previewOverview.profile.whatsapp || "",
          educationSummary: previewOverview.profile.educationSummary || "",
          expertiseSummary: previewOverview.profile.expertiseSummary || "",
          address: previewOverview.profile.address || "",
        });
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Data portal belum tersedia. Mode pratinjau diaktifkan.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedParticipation = useMemo(
    () =>
      overview?.participations.find(
        (participation) => participation.participantId === selectedParticipantId,
      ) ||
      overview?.participations[0] ||
      null,
    [overview, selectedParticipantId],
  );

  useEffect(() => {
    if (activeTab !== "QR" || !selectedParticipation) return;
    if (preview) {
      setQr({
        participantId: selectedParticipation.participantId,
        eventId: selectedParticipation.eventId,
        eventName: selectedParticipation.eventName,
        participantCode: selectedParticipation.participantCode,
        opaqueQrToken: `qr_tok_preview_${selectedParticipation.participantCode}`,
        status: selectedParticipation.confirmationStatus,
        ustadzName: overview?.profile.fullName || "Peserta",
      });
      return;
    }
    setQrLoading(true);
    void eventApi<PortalQr>(
      `/portal/qr?participantId=${encodeURIComponent(selectedParticipation.participantId)}`,
    )
      .then(setQr)
      .catch((qrError) =>
        setError(qrError instanceof Error ? qrError.message : "QR peserta gagal dimuat."),
      )
      .finally(() => setQrLoading(false));
  }, [activeTab, overview?.profile.fullName, preview, selectedParticipation]);

  const readiness = useMemo(() => {
    if (!overview || !selectedParticipation) return [];
    const hasContact = Boolean(overview.profile.whatsapp || overview.profile.phone);
    return [
      {
        label: "Terdaftar",
        detail: `${sourceLabel(selectedParticipation.registrationSource)} · ${formatDate(selectedParticipation.registeredAt, true)}`,
        complete: true,
        href: "/portal/invitations",
      },
      {
        label: "Disetujui",
        detail:
          selectedParticipation.approvalStatus === "APPROVED"
            ? "Data peserta telah disetujui."
            : "Menunggu pemeriksaan panitia.",
        complete: selectedParticipation.approvalStatus === "APPROVED",
        href: "/portal/invitations",
      },
      {
        label: "Kontak siap",
        detail: hasContact ? "Nomor WhatsApp tersedia." : "Lengkapi nomor WhatsApp.",
        complete: hasContact,
        href: "/portal/profile",
      },
      {
        label: "QR individu",
        detail: "Siapkan sebelum tiba di meja registrasi.",
        complete: ["CONFIRMED", "ACCEPTED"].includes(selectedParticipation.confirmationStatus),
        href: "/portal/qr",
      },
    ];
  }, [overview, selectedParticipation]);

  const completion = readiness.length
    ? Math.round((readiness.filter((item) => item.complete).length / readiness.length) * 100)
    : 0;

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (preview) {
      setSaveState("success");
      window.setTimeout(() => setSaveState("idle"), 2400);
      return;
    }
    setSaveState("saving");
    try {
      const updated = await eventApi<PortalOverview["profile"]>("/portal/profile", {
        method: "PATCH",
        body: JSON.stringify(profileState),
      });
      setOverview((current) => (current ? { ...current, profile: { ...current.profile, ...updated } } : current));
      setSaveState("success");
      window.setTimeout(() => setSaveState("idle"), 2400);
    } catch {
      setSaveState("error");
    }
  };

  const markRead = async (announcementId: string) => {
    setAnnouncements((current) =>
      current.map((item) => (item.id === announcementId ? { ...item, isRead: true } : item)),
    );
    if (!preview) {
      await eventApi(`/portal/announcements/${announcementId}/read`, { method: "POST" }).catch(
        () => undefined,
      );
    }
  };

  const loadDelegation = async (participantId: string) => {
    setSelectedParticipantId(participantId);
    setDelegationLoading(true);
    setDelegationError("");
    setReplaceTarget(null);
    try {
      if (preview) {
        setDelegation({
          actorParticipantId: participantId,
          eventId: "preview-event",
          eventName: "Daurah Asatidz Nasional 2026",
          institutionId: "preview-institution",
          institutionName: "Ma'had Ilmu Sunnah Bandung",
          quota: 3,
          members: [
            {
              participantId,
              participantCode: "ADA-BDG-001",
              fullName: overview?.profile.fullName || "Ustadz Abdullah, Lc.",
              email: overview?.profile.email,
              whatsapp: overview?.profile.whatsapp,
              isDelegationLead: true,
              confirmationStatus: "CONFIRMED",
              approvalStatus: "APPROVED",
              registeredAt: "2026-07-22T10:30:00+07:00",
              hasCheckedIn: false,
              canReplace: false,
            },
            {
              participantId: "preview-member-2",
              participantCode: "ADA-BDG-002",
              fullName: "Ustadz Hasan, S.Pd.I.",
              email: "hasan@example.or.id",
              whatsapp: "0812 1111 2222",
              isDelegationLead: false,
              confirmationStatus: "CONFIRMED",
              approvalStatus: "APPROVED",
              registeredAt: "2026-07-22T10:35:00+07:00",
              hasCheckedIn: false,
              canReplace: true,
            },
          ],
        });
        return;
      }
      const data = await eventApi<PortalDelegation>(`/portal/delegations/${participantId}`);
      setDelegation(data);
    } catch (delegationLoadError) {
      setDelegationError(
        delegationLoadError instanceof Error
          ? delegationLoadError.message
          : "Data delegasi gagal dimuat.",
      );
    } finally {
      setDelegationLoading(false);
    }
  };

  const beginReplacement = (member: DelegationMember) => {
    setReplaceTarget(member);
    setReplaceState("idle");
    setDelegationError("");
    setReplacement({ fullName: "", email: "", phone: "", whatsapp: "", address: "", reason: "" });
  };

  const submitReplacement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!delegation || !replaceTarget) return;
    setReplaceState("saving");
    setDelegationError("");
    try {
      if (preview) {
        setDelegation((current) => current ? {
          ...current,
          members: current.members.map((member) => member.participantId === replaceTarget.participantId
            ? {
                ...member,
                participantId: `preview-replacement-${Date.now()}`,
                participantCode: "ADA-RPL-LOCAL",
                fullName: replacement.fullName,
                email: replacement.email,
                phone: replacement.phone,
                whatsapp: replacement.whatsapp,
                address: replacement.address,
                approvalStatus: "PENDING_REVIEW",
              }
            : member),
        } : current);
      } else {
        await eventApi(`/portal/delegations/${delegation.actorParticipantId}/replace`, {
          method: "POST",
          body: JSON.stringify({
            targetParticipantId: replaceTarget.participantId,
            ...replacement,
          }),
        });
        await loadDelegation(delegation.actorParticipantId);
      }
      setReplaceState("success");
      setReplaceTarget(null);
    } catch (replacementError) {
      setReplaceState("error");
      setDelegationError(
        replacementError instanceof Error
          ? replacementError.message
          : "Perubahan delegasi gagal disimpan.",
      );
    }
  };

  const copyParticipantCode = async () => {
    if (!selectedParticipation) return;
    await navigator.clipboard.writeText(selectedParticipation.participantCode);
    setCopyDone(true);
    window.setTimeout(() => setCopyDone(false), 1800);
  };

  if (loading || !overview) {
    return (
      <PortalLayout>
        <div className="grid min-h-[55dvh] place-items-center" role="status">
          <div className="text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-emerald-700 motion-reduce:animate-none" />
            <p className="mt-3 text-sm font-bold text-slate-700">Menyiapkan portal peserta…</p>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <PageHeader
        title={tabMeta[activeTab].title}
        description={tabMeta[activeTab].description}
        actions={
          selectedParticipation ? (
            <StatusBadge
              label={selectedParticipation.confirmationStatus}
              variant={statusVariant(selectedParticipation.confirmationStatus)}
            />
          ) : undefined
        }
      />

      {preview && (
        <div className="mb-5 flex items-start gap-3 border-y border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-black">Mode pratinjau peserta aktif</p>
            <p className="mt-1 text-xs leading-5">
              {error} Navigasi, profil, pengumuman, dan QR dapat dicoba tanpa mengubah data produksi.
            </p>
          </div>
        </div>
      )}

      {selectedParticipation && (
        <section className="mb-6 grid overflow-hidden border border-slate-200 bg-white shadow-sm lg:grid-cols-[13rem_minmax(0,1fr)_17rem]">
          <img
            src={selectedParticipation.posterUrl || DEFAULT_POSTER}
            alt={selectedParticipation.posterAlt || `Poster ${selectedParticipation.eventName}`}
            width={520}
            height={680}
            className="h-44 w-full object-cover lg:h-full"
          />
          <div className="min-w-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-black text-emerald-800">
                {selectedParticipation.eventCode}
              </span>
              <StatusBadge
                label={sourceLabel(selectedParticipation.registrationSource)}
                variant="info"
              />
            </div>
            <h2 className="mt-3 min-w-0 text-xl font-black leading-tight text-slate-950 [overflow-wrap:anywhere] sm:text-2xl">
              {selectedParticipation.eventName}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {formatDate(selectedParticipation.startDate)} – {formatDate(selectedParticipation.endDate)}
              {selectedParticipation.venueName ? ` · ${selectedParticipation.venueName}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/portal/qr"
                className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-800 px-4 text-sm font-bold text-white transition hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:translate-y-px"
              >
                <QrCode className="h-4 w-4" />
                Buka QR individu
              </Link>
              {selectedParticipation.mapsUrl && (
                <a
                  href={selectedParticipation.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  <MapPin className="h-4 w-4" />
                  Buka lokasi
                </a>
              )}
            </div>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0">
            <label htmlFor="participant-event" className="text-xs font-bold text-slate-600">
              Event yang ditampilkan
            </label>
            <select
              id="participant-event"
              value={selectedParticipation.participantId}
              onChange={(event) => {
                setSelectedParticipantId(event.target.value);
                setQr(null);
              }}
              className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold outline outline-2 outline-transparent focus-visible:outline-emerald-700"
            >
              {overview.participations.map((participation) => (
                <option key={participation.participantId} value={participation.participantId}>
                  {participation.eventCode} · {participation.eventName}
                </option>
              ))}
            </select>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-500">Kode peserta</p>
              <p className="mt-1 break-all font-mono text-sm font-black text-emerald-900">
                {selectedParticipation.participantCode}
              </p>
            </div>
          </div>
        </section>
      )}

      {activeTab === "HOME" && selectedParticipation && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
          <section className="border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">Jalur kesiapan Anda</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Selesaikan setiap titik sebelum hari pelaksanaan.
                </p>
              </div>
              <span className="font-mono text-2xl font-black tabular-nums text-emerald-800">
                {completion}%
              </span>
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <div
                className="h-full origin-left rounded-full bg-emerald-700 transition-transform duration-300 motion-reduce:transition-none"
                style={{ transform: `scaleX(${completion / 100})` }}
              />
            </div>
            <ol className="mt-6 grid gap-3 md:grid-cols-2">
              {readiness.map((item, index) => (
                <li key={item.label}>
                  <Link
                    to={item.href}
                    className="group flex min-h-[112px] items-start gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-xs font-black ${
                        item.complete
                          ? "bg-emerald-800 text-white"
                          : "border border-slate-300 bg-white text-slate-500"
                      }`}
                    >
                      {item.complete ? <Check className="h-4 w-4" /> : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-black text-slate-950">{item.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-600">{item.detail}</span>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <aside className="space-y-4">
            <div className="border-t-4 border-emerald-800 bg-emerald-950 p-5 text-white">
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
              <h2 className="mt-4 text-lg font-black">Check-in tetap per individu</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-100">
                Pendaftaran melalui lembaga tidak menggabungkan presensi. QR Anda terikat pada
                identitas peserta dan event ini.
              </p>
              <Link
                to="/portal/qr"
                className="mt-5 inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap text-sm font-black text-emerald-200 underline decoration-emerald-500 underline-offset-4"
              >
                Siapkan kartu QR
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold text-slate-500">Batas konfirmasi hadir</p>
              <p className="mt-2 text-base font-black text-slate-950">
                {formatDate(selectedParticipation.attendanceConfirmationDeadline, true)}
              </p>
              <p className="mt-3 text-xs leading-5 text-slate-600">
                Jika data belum sesuai, hubungi panitia sebelum batas waktu.
              </p>
            </div>
          </aside>
        </div>
      )}

      {activeTab === "INVITATIONS" && (
        <section className="space-y-4">
          {overview.participations.map((participation) => (
            <article
              key={participation.participantId}
              className="grid border border-slate-200 bg-white lg:grid-cols-[minmax(0,1fr)_17rem]"
            >
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={sourceLabel(participation.registrationSource)}
                    variant="info"
                  />
                  <StatusBadge
                    label={participation.approvalStatus}
                    variant={statusVariant(participation.approvalStatus)}
                  />
                  <StatusBadge
                    label={participation.confirmationStatus}
                    variant={statusVariant(participation.confirmationStatus)}
                  />
                </div>
                <h2 className="mt-4 text-lg font-black text-slate-950">{participation.eventName}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Didaftarkan {formatDate(participation.registeredAt, true)}
                  {participation.institutionName ? ` oleh ${participation.institutionName}` : ""}.
                </p>
                <dl className="mt-5 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-bold text-slate-500">Batas respons undangan</dt>
                    <dd className="mt-1 text-sm font-black text-slate-900">
                      {formatDate(participation.invitationResponseDeadline, true)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-slate-500">Batas konfirmasi hadir</dt>
                    <dd className="mt-1 text-sm font-black text-slate-900">
                      {formatDate(participation.attendanceConfirmationDeadline, true)}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="flex flex-col justify-between border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0">
                <div>
                  <p className="text-xs font-bold text-slate-500">Kode peserta individu</p>
                  <p className="mt-2 font-mono text-base font-black text-emerald-900">
                    {participation.participantCode}
                  </p>
                </div>
                <div className="mt-5 grid gap-2">
                  {participation.isDelegationLead && participation.invitationId && (
                    <button
                      type="button"
                      onClick={() => void loadDelegation(participation.participantId)}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-800 px-4 text-sm font-bold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={delegationLoading}
                    >
                      {delegationLoading ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Crown className="h-4 w-4" />}
                      {delegationLoading ? "Memuat delegasi…" : "Kelola delegasi"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedParticipantId(participation.participantId);
                      navigate("/portal/qr");
                    }}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:translate-y-px"
                  >
                    <QrCode className="h-4 w-4" />
                    Buka QR
                  </button>
                </div>
              </div>
            </article>
          ))}

          {delegation && (
            <section className="portal-delegation" aria-labelledby="portal-delegation-title">
              <header className="portal-delegation__header">
                <div>
                  <span><Crown aria-hidden="true" /> Akses kepala rombongan</span>
                  <h2 id="portal-delegation-title">Delegasi {delegation.institutionName}</h2>
                  <p>{delegation.members.length} dari {delegation.quota} kuota · penggantian peserta masuk pemeriksaan panitia.</p>
                </div>
                <button type="button" onClick={() => { setDelegation(null); setReplaceTarget(null); }} aria-label="Tutup pengelolaan delegasi">
                  <X aria-hidden="true" />
                </button>
              </header>

              <div className="portal-delegation__workbench">
                <div className="portal-delegation__members">
                  {delegation.members.map((member) => (
                    <article key={member.participantId} className={replaceTarget?.participantId === member.participantId ? "is-selected" : ""}>
                      <div className="portal-delegation__member-main">
                        <span className="portal-delegation__avatar" aria-hidden="true">{member.fullName.slice(0, 1).toUpperCase()}</span>
                        <div>
                          <div className="portal-delegation__member-name">
                            <strong>{member.fullName}</strong>
                            {member.isDelegationLead && <span><Crown aria-hidden="true" /> Kepala rombongan</span>}
                          </div>
                          <p>{member.email || "Email belum tersedia"} · {member.whatsapp || member.phone || "Kontak belum tersedia"}</p>
                          <small>{member.participantCode}</small>
                        </div>
                      </div>
                      <div className="portal-delegation__member-actions">
                        <StatusBadge label={member.hasCheckedIn ? "Sudah check-in" : member.approvalStatus} variant={member.hasCheckedIn ? "success" : statusVariant(member.approvalStatus)} />
                        {!member.isDelegationLead && (
                          <button
                            type="button"
                            onClick={() => beginReplacement(member)}
                            disabled={!member.canReplace}
                            title={member.hasCheckedIn ? "Peserta yang sudah check-in hanya dapat diubah panitia." : undefined}
                          >
                            <UserRoundCog aria-hidden="true" />
                            {member.canReplace ? "Ganti peserta" : "Dikunci"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>

                <aside className="portal-delegation__editor">
                  {replaceTarget ? (
                    <form onSubmit={submitReplacement} aria-busy={replaceState === "saving"}>
                      <div className="portal-delegation__editor-heading">
                        <div>
                          <span>Mengganti</span>
                          <strong>{replaceTarget.fullName}</strong>
                        </div>
                        <button type="button" onClick={() => setReplaceTarget(null)} aria-label="Batalkan penggantian peserta"><X aria-hidden="true" /></button>
                      </div>
                      <label>
                        <span>Nama lengkap dan gelar *</span>
                        <input required minLength={3} maxLength={160} value={replacement.fullName} onChange={(event) => setReplacement((current) => ({ ...current, fullName: event.target.value }))} placeholder="Ustadz Ahmad, Lc." disabled={replaceState === "saving"} />
                      </label>
                      <label>
                        <span>Email akun peserta *</span>
                        <input required type="email" value={replacement.email} onChange={(event) => setReplacement((current) => ({ ...current, email: event.target.value }))} placeholder="ustadz@lembaga.or.id" disabled={replaceState === "saving"} />
                      </label>
                      <div className="portal-delegation__field-pair">
                        <label>
                          <span>Nomor WhatsApp *</span>
                          <input required type="tel" minLength={8} value={replacement.whatsapp} onChange={(event) => setReplacement((current) => ({ ...current, whatsapp: event.target.value }))} placeholder="081234567890" disabled={replaceState === "saving"} />
                        </label>
                        <label>
                          <span>Nomor telepon</span>
                          <input type="tel" value={replacement.phone} onChange={(event) => setReplacement((current) => ({ ...current, phone: event.target.value }))} placeholder="Opsional" disabled={replaceState === "saving"} />
                        </label>
                      </div>
                      <label>
                        <span>Alamat domisili</span>
                        <textarea rows={2} maxLength={500} value={replacement.address} onChange={(event) => setReplacement((current) => ({ ...current, address: event.target.value }))} disabled={replaceState === "saving"} />
                      </label>
                      <label>
                        <span>Alasan perubahan *</span>
                        <textarea required rows={3} minLength={5} maxLength={500} value={replacement.reason} onChange={(event) => setReplacement((current) => ({ ...current, reason: event.target.value }))} placeholder="Contoh: berhalangan hadir karena agenda lembaga." disabled={replaceState === "saving"} />
                      </label>
                      <p className="portal-delegation__notice">Peserta lama tidak dihapus. Riwayat penggantian tetap tercatat dan peserta baru menunggu review panitia.</p>
                      <button type="submit" className="portal-delegation__submit" disabled={replaceState === "saving"}>
                        {replaceState === "saving" ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save aria-hidden="true" />}
                        {replaceState === "saving" ? "Menyimpan perubahan…" : "Simpan peserta pengganti"}
                      </button>
                    </form>
                  ) : (
                    <div className="portal-delegation__empty">
                      <UserRoundCog aria-hidden="true" />
                      <strong>Pilih peserta yang berubah</strong>
                      <p>Data kepala rombongan dan peserta yang sudah check-in dikunci. Perubahan lain akan diajukan ke panitia.</p>
                    </div>
                  )}
                </aside>
              </div>
              {delegationError && <p role="alert" className="portal-delegation__error">{delegationError}</p>}
              {replaceState === "success" && <p role="status" className="portal-delegation__success">Data pengganti tersimpan dan menunggu review panitia.</p>}
            </section>
          )}

          {delegationError && !delegation && <p role="alert" className="portal-delegation__error">{delegationError}</p>}
        </section>
      )}

      {activeTab === "ACTIVITIES" && selectedParticipation && (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-black text-slate-950">Informasi pelaksanaan</h2>
            <dl className="mt-5 divide-y divide-slate-200">
              {[
                ["Tanggal", `${formatDate(selectedParticipation.startDate)} – ${formatDate(selectedParticipation.endDate)}`],
                ["Tempat", selectedParticipation.venueName || "Belum ditetapkan"],
                ["Alamat", selectedParticipation.venueAddress || "Belum ditetapkan"],
                ["Lembaga pendaftar", selectedParticipation.institutionName || "Undangan individual"],
                ["Kode peserta", selectedParticipation.participantCode],
              ].map(([label, value]) => (
                <div key={label} className="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <dt className="text-xs font-bold text-slate-500">{label}</dt>
                  <dd className="min-w-0 text-sm font-black text-slate-900 [overflow-wrap:anywhere]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <aside className="border-t-4 border-emerald-800 bg-slate-950 p-5 text-white">
            <MapPin className="h-6 w-6 text-emerald-300" />
            <h2 className="mt-4 text-lg font-black">Simpan lokasi</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Periksa rute dan waktu tempuh sebelum hari pelaksanaan.
            </p>
            {selectedParticipation.mapsUrl ? (
              <a
                href={selectedParticipation.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-500 px-4 text-sm font-black text-emerald-950"
              >
                Buka peta
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <p className="mt-5 border-t border-slate-700 pt-4 text-xs text-slate-400">
                Tautan peta belum diterbitkan panitia.
              </p>
            )}
          </aside>
        </section>
      )}

      {activeTab === "SCHEDULE" && selectedParticipation && (
        <section className="space-y-3">
          {selectedParticipation.sessions.length ? (
            selectedParticipation.sessions.map((session) => (
              <article
                key={session.id}
                className="grid items-start gap-4 border border-slate-200 bg-white p-4 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:p-5"
              >
                <div>
                  <p className="font-mono text-xs font-black text-emerald-800">
                    Hari {session.dayNumber}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(session.dayDate)}</p>
                </div>
                <div className="min-w-0">
                  <h2 className="font-black text-slate-950">{session.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {session.room || "Ruangan belum ditetapkan"} · {formatTime(session.startAt)}–
                    {formatTime(session.endAt)}
                  </p>
                </div>
                <StatusBadge
                  label={session.checkinRequired ? "Wajib check-in" : "Tanpa check-in"}
                  variant={session.checkinRequired ? "warning" : "neutral"}
                />
              </article>
            ))
          ) : (
            <div className="border border-dashed border-slate-300 bg-white p-10 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 font-bold text-slate-700">Jadwal belum diterbitkan panitia.</p>
            </div>
          )}
        </section>
      )}

      {activeTab === "QR" && selectedParticipation && (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="border border-slate-200 bg-white p-5 text-center sm:p-8 print:border-0">
            <StatusBadge
              label="Bukti pendaftaran dan QR kehadiran"
              variant="success"
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
            />
            <h2 className="mx-auto mt-4 max-w-2xl text-xl font-black text-slate-950">
              {selectedParticipation.eventName}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {overview.profile.fullName} ·{" "}
              {selectedParticipation.institutionName ||
                overview.profile.primaryInstitution?.institutionName ||
                "Peserta individual"}
            </p>
            <div className="mx-auto mt-7 grid min-h-[248px] w-full max-w-[248px] place-items-center rounded-2xl border-8 border-slate-950 bg-white p-4 shadow-lg">
              {qrLoading || !qr ? (
                <Loader2 className="h-8 w-8 animate-spin text-emerald-700 motion-reduce:animate-none" />
              ) : (
                <QRCodeSVG
                  value={qr.opaqueQrToken}
                  size={200}
                  level="H"
                  marginSize={1}
                  title={`QR check-in ${qr.ustadzName}`}
                />
              )}
            </div>
            <div className="mx-auto mt-6 max-w-md rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">Kode fallback manual</p>
              <p className="mt-2 font-mono text-lg font-black tracking-wider text-emerald-900">
                {selectedParticipation.participantCode}
              </p>
              <button
                type="button"
                onClick={copyParticipantCode}
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-black text-emerald-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                {copyDone ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copyDone ? "Kode tersalin" : "Salin kode"}
              </button>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="border-t-4 border-emerald-800 bg-emerald-950 p-5 text-white">
              <QrCode className="h-6 w-6 text-emerald-300" />
              <h2 className="mt-4 font-black">Cara menggunakan</h2>
              <ol className="mt-4 space-y-3 text-sm text-emerald-100">
                <li>1. Buka kartu ini sebelum tiba di meja registrasi.</li>
                <li>2. Naikkan kecerahan layar agar mudah dipindai.</li>
                <li>3. Jika gagal, sebutkan kode fallback kepada petugas.</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 print:hidden"
            >
              <FileText className="h-4 w-4" />
              Cetak bukti pendaftaran
            </button>
          </aside>
        </section>
      )}

      {activeTab === "ANNOUNCEMENTS" && (
        <section className="space-y-4">
          {announcements.length ? (
            announcements.map((announcement) => (
              <article
                key={announcement.id}
                className={`border bg-white p-5 sm:p-6 ${
                  announcement.isRead ? "border-slate-200" : "border-amber-300"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-emerald-700" />
                      <StatusBadge
                        label={announcement.isRead ? "Sudah dibaca" : "Baru"}
                        variant={announcement.isRead ? "neutral" : "warning"}
                      />
                    </div>
                    <h2 className="mt-3 text-lg font-black text-slate-950">{announcement.title}</h2>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDate(announcement.publishedAt, true)}
                    </p>
                  </div>
                  {!announcement.isRead && (
                    <button
                      type="button"
                      onClick={() => void markRead(announcement.id)}
                      className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 px-3 text-xs font-black text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Tandai dibaca
                    </button>
                  )}
                </div>
                <p className="mt-5 max-w-3xl whitespace-pre-line text-sm leading-7 text-slate-700">
                  {announcement.body}
                </p>
              </article>
            ))
          ) : (
            <div className="border border-dashed border-slate-300 bg-white p-10 text-center">
              <Bell className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 font-bold text-slate-700">Belum ada pengumuman untuk Anda.</p>
            </div>
          )}
        </section>
      )}

      {activeTab === "PROFILE" && (
        <form onSubmit={saveProfile} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="border border-slate-200 bg-white p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-600" htmlFor="portal-name">
                  Nama resmi
                </label>
                <input
                  id="portal-name"
                  value={overview.profile.fullName}
                  disabled
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-bold text-slate-700 opacity-70"
                />
                <p className="mt-1 min-h-[1lh] text-xs text-slate-500">Dikelola oleh admin.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600" htmlFor="portal-institution">
                  Lembaga utama
                </label>
                <input
                  id="portal-institution"
                  value={overview.profile.primaryInstitution?.institutionName || "Belum terhubung"}
                  disabled
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-bold text-slate-700 opacity-70"
                />
                <p className="mt-1 min-h-[1lh] text-xs text-slate-500">Dikelola oleh admin.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600" htmlFor="portal-phone">
                  Nomor telepon
                </label>
                <input
                  id="portal-phone"
                  value={profileState.phone}
                  onChange={(event) =>
                    setProfileState((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="Contoh: 0812 3456 7890"
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-emerald-700"
                />
                <p className="mt-1 min-h-[1lh] text-xs text-slate-500">Nomor yang dapat dihubungi.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600" htmlFor="portal-whatsapp">
                  Nomor WhatsApp
                </label>
                <input
                  id="portal-whatsapp"
                  value={profileState.whatsapp}
                  onChange={(event) =>
                    setProfileState((current) => ({ ...current, whatsapp: event.target.value }))
                  }
                  placeholder="Contoh: 62812 3456 7890"
                  className="mt-2 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 pr-8 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-emerald-700"
                />
                <p className="mt-1 min-h-[1lh] text-xs text-slate-500">Dipakai panitia untuk informasi operasional.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600" htmlFor="portal-education">
                  Ringkasan pendidikan
                </label>
                <textarea
                  id="portal-education"
                  rows={4}
                  value={profileState.educationSummary}
                  onChange={(event) =>
                    setProfileState((current) => ({
                      ...current,
                      educationSummary: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-emerald-700"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600" htmlFor="portal-expertise">
                  Keahlian dan aktivitas dakwah
                </label>
                <textarea
                  id="portal-expertise"
                  rows={4}
                  value={profileState.expertiseSummary}
                  onChange={(event) =>
                    setProfileState((current) => ({
                      ...current,
                      expertiseSummary: event.target.value,
                    }))
                  }
                  className="mt-2 min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-emerald-700"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-600" htmlFor="portal-address">
                  Alamat domisili
                </label>
                <textarea
                  id="portal-address"
                  rows={3}
                  value={profileState.address}
                  onChange={(event) =>
                    setProfileState((current) => ({ ...current, address: event.target.value }))
                  }
                  className="mt-2 min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm outline outline-2 outline-transparent hover:bg-slate-50 focus-visible:outline-emerald-700"
                />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <p
                className={`text-xs font-bold ${
                  saveState === "error"
                    ? "text-rose-700"
                    : saveState === "success"
                      ? "text-emerald-700"
                      : "text-slate-500"
                }`}
                aria-live="polite"
              >
                {saveState === "success"
                  ? "Perubahan profil tersimpan."
                  : saveState === "error"
                    ? "Profil gagal disimpan. Periksa koneksi dan coba lagi."
                    : "Nama dan status verifikasi hanya dapat diubah admin."}
              </p>
              <button
                type="submit"
                disabled={saveState === "saving"}
                className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-800 px-5 text-sm font-black text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveState === "saving" ? (
                  <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                ) : saveState === "success" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saveState === "saving"
                  ? "Menyimpan…"
                  : saveState === "success"
                    ? "Tersimpan"
                    : "Simpan profil"}
              </button>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="border-t-4 border-emerald-800 bg-slate-950 p-5 text-white">
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
              <h2 className="mt-4 font-black">Data yang dikunci</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Nama resmi, status profil, dan afiliasi utama dijaga sebagai data master agar tidak
                berubah tanpa verifikasi.
              </p>
            </div>
            {overview.profile.whatsapp && (
              <a
                href={`https://wa.me/${overview.profile.whatsapp.replace(/\D/g, "").replace(/^0/, "62")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <MessageCircle className="h-4 w-4" />
                Uji tautan WhatsApp
              </a>
            )}
          </aside>
        </form>
      )}

      {activeTab === "ATTENDANCE" && selectedParticipation && (
        <section className="space-y-3">
          {selectedParticipation.attendance.length ? (
            selectedParticipation.attendance.map((record) => (
              <article
                key={record.id}
                className="grid items-center gap-4 border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5"
              >
                <div>
                  <h2 className="font-black text-slate-950">
                    {record.sessionTitle || "Presensi event"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatDate(record.checkinAt, true)} · {record.checkinMethod || "Metode tidak dicatat"}
                  </p>
                </div>
                <StatusBadge
                  label={record.attendanceStatus}
                  variant={statusVariant(record.attendanceStatus)}
                />
              </article>
            ))
          ) : (
            <div className="border border-dashed border-slate-300 bg-white p-10 text-center">
              <Clock3 className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 font-bold text-slate-700">
                Belum ada riwayat check-in untuk event ini.
              </p>
              <Link
                to="/portal/qr"
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap text-sm font-black text-emerald-800 underline underline-offset-4"
              >
                Siapkan QR individu
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </section>
      )}
    </PortalLayout>
  );
};
