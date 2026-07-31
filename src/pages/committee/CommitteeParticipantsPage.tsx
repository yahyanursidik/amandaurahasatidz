/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4
 * Hallmark · component integration
 * genre: workbench · tone: utilitarian · audience: event committee
 * privacy: participant contact data is shown only inside the protected committee portal
 */
import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Contact, Mail, MapPin, RefreshCw, Search, Smartphone, Users } from "lucide-react";
import { CommitteeLayout } from "@/components/layouts/CommitteeLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ParticipantCommunicationPanel } from "@/components/communications/ParticipantCommunicationPanel";
import { eventApi } from "@/lib/eventApi";
import { getMissingParticipantContactFields } from "@/lib/participantCommunication";

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
  ustadzName: string;
  ustadzEmail: string | null;
  ustadzPhone: string | null;
  ustadzWhatsapp: string | null;
  ustadzAddress: string | null;
  participantCode: string;
  institutionName: string | null;
  approvalStatus: string;
  confirmationStatus: string;
  eventName?: string | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  eventVenueName?: string | null;
  eventVenueAddress?: string | null;
};

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
    ustadzName: "Ustadz Abdullah, Lc.",
    ustadzEmail: "abdullah@example.org",
    ustadzPhone: "0812 9999 0000",
    ustadzWhatsapp: "0812 9999 0000",
    ustadzAddress: "Bandung, Jawa Barat",
    participantCode: "YTS-BDG001-01",
    institutionName: "Ma’had Ilmu Sunnah Bandung",
    approvalStatus: "APPROVED",
    confirmationStatus: "CONFIRMED",
  },
  {
    id: "committee-preview-participant-2",
    ustadzName: "Ustadz Hasan Basri",
    ustadzEmail: null,
    ustadzPhone: "0812 8888 1111",
    ustadzWhatsapp: "0812 8888 1111",
    ustadzAddress: null,
    participantCode: "YTS-BDG001-02",
    institutionName: "Ma’had Ilmu Sunnah Bandung",
    approvalStatus: "PENDING_REVIEW",
    confirmationStatus: "CONFIRMED",
  },
];

export const CommitteeParticipantsPage: React.FC = () => {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [participants, setParticipants] = useState<CommitteeParticipant[]>([]);
  const [search, setSearch] = useState("");
  const [contactFilter, setContactFilter] = useState<"ALL" | "COMPLETE" | "INCOMPLETE">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  const selectedEvent = events.find((item) => item.id === selectedEventId) || events[0];

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await eventApi<EventSummary[]>("/events");
      const eventItems = Array.isArray(data) ? data : [];
      setEvents(eventItems);
      setSelectedEventId((current) => current || eventItems[0]?.id || "");
      setPreviewMode(false);
      if (eventItems.length === 0) setParticipants([]);
    } catch (loadError) {
      if (import.meta.env.DEV) {
        setEvents([previewEvent]);
        setSelectedEventId(previewEvent.id);
        setParticipants(previewParticipants);
        setPreviewMode(true);
      } else {
        setError(loadError instanceof Error ? loadError.message : "Daftar event tidak dapat dimuat.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  useEffect(() => {
    if (!selectedEventId || previewMode) return;
    const loadParticipants = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await eventApi<CommitteeParticipant[]>(`/events/${selectedEventId}/participants`);
        setParticipants(Array.isArray(data) ? data : []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Data peserta tidak dapat dimuat.");
        setParticipants([]);
      } finally {
        setLoading(false);
      }
    };
    void loadParticipants();
  }, [previewMode, selectedEventId]);

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

  const filteredParticipants = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("id-ID");
    return participants.filter((participant) => {
      const missing = getMissingParticipantContactFields(participantWithContact(participant));
      const contactMatch =
        contactFilter === "ALL" ||
        (contactFilter === "COMPLETE" && missing.length === 0) ||
        (contactFilter === "INCOMPLETE" && missing.length > 0);
      const searchMatch =
        !keyword ||
        [
          participant.ustadzName,
          participant.participantCode,
          participant.institutionName,
          participant.ustadzWhatsapp,
          participant.ustadzPhone,
          participant.ustadzEmail,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase("id-ID").includes(keyword));
      return contactMatch && searchMatch;
    });
  }, [contactFilter, participants, search]);

  const completeContacts = participants.filter(
    (participant) => getMissingParticipantContactFields(participantWithContact(participant)).length === 0,
  ).length;
  const whatsappReady = participants.filter((participant) => participant.ustadzWhatsapp || participant.ustadzPhone).length;

  return (
    <CommitteeLayout>
      <PageHeader
        title="Data & komunikasi peserta"
        description="Cari peserta event, periksa kelengkapan kontak, lalu hubungi setiap asatidz melalui pesan yang sudah disiapkan."
        breadcrumbs={[{ label: "Panitia", href: "/committee" }, { label: "Peserta" }]}
        actions={
          <button
            type="button"
            onClick={() => void loadEvents()}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Muat ulang
          </button>
        }
      />

      {previewMode && (
        <div className="mb-5 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Mode pratinjau aktif karena API event belum tersedia. Fitur template pesan dan tautan WhatsApp tetap dapat dicoba.
        </div>
      )}
      {error && (
        <div role="alert" className="mb-5 flex items-start gap-2 border-l-4 border-rose-600 bg-rose-50 p-4 text-sm leading-6 text-rose-950">
          <AlertCircle className="mt-1 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Ringkasan data kontak peserta">
        {[
          { label: "Peserta event", value: participants.length, icon: Users },
          { label: "WhatsApp siap", value: whatsappReady, icon: Smartphone },
          { label: "Kontak lengkap", value: completeContacts, icon: CheckCircle2 },
        ].map((metric) => (
          <div key={metric.label} className="border-t-2 border-teal-700 bg-slate-50 p-4">
            <metric.icon className="h-5 w-5 text-teal-800" />
            <p className="mt-3 text-2xl font-black tabular-nums text-slate-950">{loading ? "—" : metric.value}</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">{metric.label}</p>
          </div>
        ))}
      </section>

      <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)_13rem]">
        <label>
          <span className="mb-2 block text-sm font-bold text-slate-800">Event aktif</span>
          <select
            value={selectedEventId}
            onChange={(eventTarget) => setSelectedEventId(eventTarget.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline outline-2 outline-transparent focus-visible:outline-teal-700"
          >
            {events.length === 0 && <option value="">Belum ada event</option>}
            {events.map((eventItem) => (
              <option key={eventItem.id} value={eventItem.id}>{eventItem.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-2 block text-sm font-bold text-slate-800">Cari peserta</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(eventTarget) => setSearch(eventTarget.target.value)}
              placeholder="Nama, kode peserta, lembaga, atau kontak"
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline outline-2 outline-transparent focus-visible:outline-teal-700"
            />
          </span>
        </label>
        <label>
          <span className="mb-2 block text-sm font-bold text-slate-800">Kelengkapan kontak</span>
          <select
            value={contactFilter}
            onChange={(eventTarget) => setContactFilter(eventTarget.target.value as typeof contactFilter)}
            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline outline-2 outline-transparent focus-visible:outline-teal-700"
          >
            <option value="ALL">Semua peserta</option>
            <option value="COMPLETE">Data lengkap</option>
            <option value="INCOMPLETE">Perlu dilengkapi</option>
          </select>
        </label>
      </div>

      <div className="mb-5 flex items-start gap-3 border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950">
        <Contact className="mt-1 h-4 w-4 shrink-0" />
        <p>
          Kontak peserta dipakai untuk operasional event. Panitia dapat melihat data peserta event yang dipilih; pesan selalu
          ditinjau sebelum WhatsApp atau email dibuka.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3" aria-label="Memuat peserta">
          {[1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : filteredParticipants.length === 0 ? (
        <div className="border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 text-base font-black text-slate-950">Peserta tidak ditemukan</h2>
          <p className="mt-1 text-sm text-slate-600">Ubah kata pencarian atau filter kelengkapan kontak.</p>
        </div>
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {filteredParticipants.map((participant) => {
            const contact = participantWithContact(participant);
            const missing = getMissingParticipantContactFields(contact);
            return (
              <li key={participant.id} className="min-w-0 border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-bold text-teal-800">{participant.participantCode}</p>
                    <h2 className="mt-1 truncate text-lg font-black text-slate-950">{participant.ustadzName}</h2>
                    <p className="mt-1 truncate text-sm text-slate-600">{participant.institutionName || "Peserta individu"}</p>
                  </div>
                  <ParticipantCommunicationPanel
                    participant={contact}
                    senderRole="committee"
                    event={{
                      name: participant.eventName || selectedEvent?.name,
                      startDate: participant.eventStartDate || selectedEvent?.startDate,
                      endDate: participant.eventEndDate || selectedEvent?.endDate,
                      venueName: participant.eventVenueName || selectedEvent?.venueName,
                      venueAddress: participant.eventVenueAddress || selectedEvent?.venueAddress,
                    }}
                  />
                </div>
                <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-3">
                  <p className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                    <Smartphone className="h-4 w-4 shrink-0 text-teal-800" />
                    <span className="truncate">{participant.ustadzWhatsapp || participant.ustadzPhone || "Belum diisi"}</span>
                  </p>
                  <p className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                    <Mail className="h-4 w-4 shrink-0 text-teal-800" />
                    <span className="truncate">{participant.ustadzEmail || "Belum diisi"}</span>
                  </p>
                  <p className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                    <MapPin className="h-4 w-4 shrink-0 text-teal-800" />
                    <span className="truncate">{participant.ustadzAddress || "Belum diisi"}</span>
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={participant.approvalStatus.replaceAll("_", " ")}
                    variant={participant.approvalStatus === "APPROVED" ? "success" : "warning"}
                  />
                  <StatusBadge
                    label={missing.length === 0 ? "Kontak lengkap" : `${missing.length} data belum lengkap`}
                    variant={missing.length === 0 ? "success" : "warning"}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CommitteeLayout>
  );
};
