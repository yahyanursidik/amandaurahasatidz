import React from "react";
import { useParams, Link } from "react-router-dom";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { Calendar, MapPin, ExternalLink, Clock, Building2, CheckCircle2 } from "lucide-react";

export const EventPublicPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const eventData = {
    slug: slug || "daurah-asatidz-nasional-2026-bandung",
    code: "DAURAH-2026-BDG",
    name: "Daurah Asatidz Nasional 2026 - Bandung",
    subtitle: "Peningkatan Kapasitas & Penguatan Fiqih Dakwah Asatidz Indonesia",
    description: "Kegiatan tahunan penguatan kapasitas keilmuan, koordinasi dakwah, dan konsolidasi Asatidz perwakilan lembaga partner YTS.",
    timezone: "Asia/Jakarta (WIB)",
    startDate: "15 Agustus 2026",
    endDate: "18 Agustus 2026",
    venueName: "Hotel Grand Asrilia Bandung",
    venueAddress: "Jl. Pelajar Pejuang 45 No. 123, Lengkong, Kota Bandung, Jawa Barat",
    mapsUrl: "https://maps.google.com/?q=Grand+Asrilia+Bandung",
    status: "REGISTRATION_OPEN",
    scheduleDays: [
      {
        dayNumber: 1,
        title: "Hari Ke-1: Pembukaan & Landasan Fiqih",
        sessions: [
          { title: "Sesi 1: Pembukaan & Keynote Speech", speaker: "Ustadz Khusus YTS", time: "08:00 - 10:00" },
          { title: "Sesi 2: Pengantar Fiqih Daurah Modern", speaker: "Ustadz Dr. Muhammad Muslih, Lc., M.A.", time: "10:30 - 12:00" },
        ],
      },
      {
        dayNumber: 2,
        title: "Hari Ke-2: Workshop & Konsolidasi Lembaga",
        sessions: [
          { title: "Sesi 3: Workshop Manajemen Pesantren", speaker: "Tim Pakar YTS", time: "08:00 - 11:30" },
        ],
      },
    ],
  };

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Banner Card */}
        <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white rounded-2xl p-6 sm:p-8 shadow-lg space-y-4">
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-700/80 text-emerald-100 text-xs font-mono font-bold px-2.5 py-1 rounded">
              {eventData.code}
            </span>
            <span className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs px-2.5 py-1 rounded font-semibold">
              Pendaftaran Dibuka
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">{eventData.name}</h1>
          <p className="text-emerald-100/90 text-sm max-w-2xl">{eventData.subtitle}</p>

          <div className="pt-4 border-t border-emerald-700/50 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-emerald-100">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {eventData.startDate} s.d {eventData.endDate} ({eventData.timezone})
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{eventData.venueName}</span>
            </div>
          </div>
        </div>

        {/* Location & Maps Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b pb-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Lokasi Pelaksanaan & Peta</span>
          </h3>
          <p className="text-xs text-slate-700 font-semibold">{eventData.venueName}</p>
          <p className="text-xs text-slate-500">{eventData.venueAddress}</p>
          {eventData.mapsUrl && (
            <a
              href={eventData.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 text-xs text-emerald-700 font-bold hover:underline pt-1"
            >
              <span>Buka Petunjuk Arah di Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Schedule & Sessions Section */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b pb-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Jadwal & Rundown Acara</span>
          </h3>

          <div className="space-y-4">
            {eventData.scheduleDays.map((day) => (
              <div key={day.dayNumber} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-2">{day.title}</h4>
                <div className="space-y-2">
                  {day.sessions.map((sess, idx) => (
                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">{sess.title}</span>
                        <span className="text-[11px] text-slate-500 block">Pemateri: {sess.speaker}</span>
                      </div>
                      <span className="bg-emerald-50 text-emerald-800 px-2 py-1 rounded font-semibold text-[11px]">
                        {sess.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};
