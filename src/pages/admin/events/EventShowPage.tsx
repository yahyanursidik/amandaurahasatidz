import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  Archive,
  UserCheck,
  Building2,
  ExternalLink,
  Edit,
} from "lucide-react";

export const EventShowPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"BUILDER" | "COMMITTEE" | "INFO">("BUILDER");
  const [status, setStatus] = useState("DRAFT");

  const eventData = {
    id: id || "event-1",
    code: "DAURAH-2026-BDG",
    slug: "daurah-asatidz-nasional-2026-bandung",
    name: "Daurah Asatidz Nasional 2026 - Bandung",
    timezone: "Asia/Jakarta",
    startDate: "2026-08-15",
    endDate: "2026-08-18",
    venueName: "Hotel Grand Asrilia Bandung",
    venueAddress: "Jl. Pelajar Pejuang 45 No. 123, Bandung",
    mapsUrl: "https://maps.google.com/?q=Grand+Asrilia+Bandung",
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2026-08-15",
        title: "Hari Ke-1: Pembukaan & Landasan Fiqih",
        sessions: [
          {
            id: "sess-1",
            title: "Sesi 1: Pembukaan & Sambutan Yayasan",
            sessionType: "OPENING",
            speaker: "Ustadz Abdullah, Lc.",
            startAt: "08:00",
            endAt: "09:30",
            checkinWindow: "07:30 - 08:15",
            sortOrder: 1,
          },
          {
            id: "sess-2",
            title: "Sesi 2: Pengantar Fiqih Daurah Modern",
            sessionType: "MATERIAL",
            speaker: "Ustadz Dr. Muhammad Muslih, Lc., M.A.",
            startAt: "10:00",
            endAt: "12:00",
            checkinWindow: "09:45 - 10:15",
            sortOrder: 2,
          },
        ],
      },
    ],
    committee: [
      { id: "comm-1", name: "Ahmad Fauzi", email: "fauzi@yts.or.id", role: "EVENT_ADMIN" },
      { id: "comm-2", name: "Budi Santoso", email: "budi@yts.or.id", role: "CHECKIN_OFFICER" },
    ],
  };

  const handleTransition = (action: string) => {
    if (action === "PUBLISH") setStatus("PUBLISHED");
    else if (action === "OPEN_REGISTRATION") setStatus("REGISTRATION_OPEN");
    else if (action === "START_EVENT") setStatus("ONGOING");
    else if (action === "COMPLETE_EVENT") setStatus("COMPLETED");
    else if (action === "ARCHIVE") setStatus("ARCHIVED");
    else if (action === "CANCEL") setStatus("CANCELLED");
    alert(`Command transition '${action}' berhasil dieksekusi! Status event sekarang: ${status}`);
  };

  return (
    <AdminLayout>
      <PageHeader
        title={eventData.name}
        description={`Detail Event Daurah (Kode: ${eventData.code})`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Event Daurah", href: "/admin/events" },
          { label: eventData.code },
        ]}
        actions={
          <Link
            to={`/admin/events/${eventData.id}/edit`}
            className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs px-3.5 py-2 rounded-lg transition min-h-[44px]"
          >
            <Edit className="w-4 h-4" />
            <span>Edit Rincian</span>
          </Link>
        }
      />

      {/* Header Banner & Command Transition Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs text-emerald-700 font-bold">{eventData.code}</span>
              <StatusBadge label={status} variant={status === "ONGOING" ? "success" : "info"} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">{eventData.name}</h2>
            <div className="flex items-center space-x-3 text-xs text-slate-600 mt-1">
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {eventData.startDate} s.d {eventData.endDate} ({eventData.timezone})
                </span>
              </span>
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{eventData.venueName}</span>
              </span>
            </div>
          </div>
        </div>

        {/* State Machine Transition Command Buttons */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
            Command Transition Resmi (State Machine)
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {status === "DRAFT" && (
              <button
                onClick={() => handleTransition("PUBLISH")}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 min-h-[44px]"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Publish Event</span>
              </button>
            )}

            {status === "PUBLISHED" && (
              <button
                onClick={() => handleTransition("OPEN_REGISTRATION")}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 min-h-[44px]"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Buka Pendaftaran</span>
              </button>
            )}

            {status === "REGISTRATION_OPEN" && (
              <button
                onClick={() => handleTransition("START_EVENT")}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 min-h-[44px]"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Mulai Event (ONGOING)</span>
              </button>
            )}

            {status === "ONGOING" && (
              <button
                onClick={() => handleTransition("COMPLETE_EVENT")}
                className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 min-h-[44px]"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Selesaikan Event</span>
              </button>
            )}

            {status === "COMPLETED" && (
              <button
                onClick={() => handleTransition("ARCHIVE")}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 min-h-[44px]"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Arsipkan Event</span>
              </button>
            )}

            {status !== "CANCELLED" && status !== "ARCHIVED" && (
              <button
                onClick={() => handleTransition("CANCEL")}
                className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-lg flex items-center space-x-1 min-h-[44px]"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Batalkan Event</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 space-x-4">
        <button
          onClick={() => setActiveTab("BUILDER")}
          className={`pb-3 text-xs font-semibold border-b-2 transition min-h-[44px] ${
            activeTab === "BUILDER"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Builder Hari & Sesi Materi
        </button>
        <button
          onClick={() => setActiveTab("COMMITTEE")}
          className={`pb-3 text-xs font-semibold border-b-2 transition min-h-[44px] ${
            activeTab === "COMMITTEE"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Penugasan Panitia ({eventData.committee.length})
        </button>
      </div>

      {/* Tab 1: Day & Session Builder */}
      {activeTab === "BUILDER" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Jadwal Hari & Sesi Daurah
            </h3>
            <button className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg flex items-center space-x-1">
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Hari</span>
            </button>
          </div>

          {eventData.days.map((day) => (
            <div key={day.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <span className="text-[10px] text-emerald-700 font-mono font-bold">Hari Ke-{day.dayNumber}</span>
                  <h4 className="font-bold text-slate-900 text-sm">{day.title}</h4>
                </div>
                <button className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded flex items-center space-x-1">
                  <Plus className="w-3 h-3" />
                  <span>Tambah Sesi</span>
                </button>
              </div>

              <div className="space-y-2">
                {day.sessions.map((sess) => (
                  <div key={sess.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="bg-slate-200 text-slate-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          Urutan #{sess.sortOrder}
                        </span>
                        <h5 className="font-bold text-slate-900 text-xs">{sess.title}</h5>
                      </div>
                      <p className="text-xs text-slate-600">Pemateri: {sess.speaker}</p>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Jam: {sess.startAt} - {sess.endAt}</span>
                        </span>
                        <span>Jendela Check-in: {sess.checkinWindow}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Committee Assignments */}
      {activeTab === "COMMITTEE" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Panitia Terdaftar pada Event Ini
            </h3>
            <button className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg flex items-center space-x-1">
              <Plus className="w-3.5 h-3.5" />
              <span>Tugaskan Panitia</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {eventData.committee.map((comm) => (
              <div key={comm.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50 space-y-1">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-900 text-xs">{comm.name}</h4>
                  <StatusBadge label={comm.role} variant="info" />
                </div>
                <p className="text-[11px] text-slate-500">{comm.email}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
