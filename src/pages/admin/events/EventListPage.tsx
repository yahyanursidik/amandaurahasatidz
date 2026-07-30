import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EventSwitcher } from "@/components/common/EventSwitcher";
import { Calendar, Plus, Search, MapPin, Clock, Eye, Edit, ExternalLink } from "lucide-react";

export const EventListPage: React.FC = () => {
  const [search, setSearch] = useState("");

  const mockEvents = [
    {
      id: "event-1",
      code: "DAURAH-2026-BDG",
      slug: "daurah-asatidz-nasional-2026-bandung",
      name: "Daurah Asatidz Nasional 2026 - Bandung",
      timezone: "Asia/Jakarta",
      startDate: "2026-08-15",
      endDate: "2026-08-18",
      venueName: "Hotel Grand Asrilia Bandung",
      venueAddress: "Jl. Pelajar Pejuang 45 No. 123, Bandung",
      mapsUrl: "https://maps.google.com/?q=Grand+Asrilia+Bandung",
      status: "ONGOING",
    },
    {
      id: "event-2",
      code: "DAURAH-2026-SUB",
      slug: "daurah-syariah-regional-2026-surabaya",
      name: "Daurah Syariah Regional 2026 - Surabaya",
      timezone: "Asia/Jakarta",
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      venueName: "Asrama Haji Sukolilo Surabaya",
      venueAddress: "Jl. Sukolilo No. 45, Surabaya",
      mapsUrl: "https://maps.google.com",
      status: "REGISTRATION_OPEN",
    },
  ];

  const filtered = mockEvents.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout>
      <PageHeader
        title="Kelola Event Daurah"
        description="Kelola jadwal kegiatan, builder hari & sesi, penugasan panitia, dan alur status event."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event Daurah" }]}
        actions={
          <div className="flex items-center space-x-3">
            <EventSwitcher />
            <Link
              to="/admin/events/create"
              className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg shadow-sm transition min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Event Baru</span>
            </Link>
          </div>
        }
      />

      {/* Search Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama event daurah..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* Event Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((item) => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] text-emerald-700 font-bold block">{item.code}</span>
                  <h3 className="font-bold text-slate-900 text-base">{item.name}</h3>
                </div>
                <StatusBadge label={item.status} variant={item.status === "ONGOING" ? "success" : "info"} />
              </div>

              <div className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    {item.startDate} s.d {item.endDate} ({item.timezone})
                  </span>
                </div>

                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">{item.venueName}</span>
                    <p className="text-[11px] text-slate-500">{item.venueAddress}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Link
                to={`/events/${item.slug}`}
                target="_blank"
                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center space-x-1"
              >
                <span>Halaman Publik</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>

              <div className="flex items-center space-x-2">
                <Link
                  to={`/admin/events/${item.id}`}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg flex items-center space-x-1 min-h-[44px]"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Detail & Sesi</span>
                </Link>
                <Link
                  to={`/admin/events/${item.id}/edit`}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg flex items-center space-x-1 min-h-[44px]"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};
