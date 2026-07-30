import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { UserCheck, Plus, Search, Filter, Eye, Edit, GitMerge, Building2, Phone, Mail } from "lucide-react";

export const UstadzListPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const mockUstadz = [
    {
      id: "201",
      fullName: "Ustadz Dr. Muhammad Muslih, Lc., M.A.",
      normalizedName: "muhammad muslih",
      email: "m.muslih@yts.or.id",
      phone: "081233334444",
      cityName: "Kota Bandung",
      primaryInstitution: "Ma'had Ilmu Sunnah Bandung",
      profileStatus: "ACTIVE",
      hasDuplicateAlert: true,
    },
    {
      id: "202",
      fullName: "Ustadz Abu Ahmad Zakaria",
      normalizedName: "abu ahmad zakaria",
      email: "abuahmad@yts.or.id",
      phone: "081955556666",
      cityName: "Kota Cimahi",
      primaryInstitution: "Yayasan Dakwah Al-Hikmah Cimahi",
      profileStatus: "ACTIVE",
      hasDuplicateAlert: false,
    },
    {
      id: "203",
      fullName: "Ustadz Muslih, Lc.",
      normalizedName: "muslih",
      email: "muslih.bandung@gmail.com",
      phone: "081233334444", // Matching phone with 201!
      cityName: "Kota Bandung",
      primaryInstitution: "Rumah Qur'an As-Salam Garut",
      profileStatus: "ACTIVE",
      hasDuplicateAlert: true,
    },
  ];

  const filtered = mockUstadz.filter((item) => {
    const matchSearch =
      item.fullName.toLowerCase().includes(search.toLowerCase()) ||
      item.email.toLowerCase().includes(search.toLowerCase()) ||
      item.phone.includes(search);
    const matchStatus = statusFilter === "ALL" || item.profileStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <AdminLayout>
      <PageHeader
        title="Master Data Asatidz"
        description="Kelola basis data profil Ustadz, afiliasi lembaga partner, dan workflow penggabungan profil duplikat."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Master Asatidz" }]}
        actions={
          <div className="flex items-center space-x-2">
            <Link
              to="/admin/ustadz/merge"
              className="inline-flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs px-3.5 py-2 rounded-lg shadow-sm transition min-h-[44px]"
            >
              <GitMerge className="w-4 h-4" />
              <span>Merge Profil</span>
            </Link>
            <Link
              to="/admin/ustadz/create"
              className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg shadow-sm transition min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Ustadz</span>
            </Link>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama Ustadz, email, nomor telepon..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:inline" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
            <option value="MERGED">Merged (Digabung)</option>
          </select>
        </div>
      </div>

      {/* Desktop Table View (>= 768px) */}
      <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3">Nama Lengkap Ustadz</th>
              <th className="p-3">Afiliasi Utama</th>
              <th className="p-3">Kontak</th>
              <th className="p-3">Wilayah</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition">
                <td className="p-3">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-900">{item.fullName}</span>
                    {item.hasDuplicateAlert && (
                      <span
                        className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold"
                        title="Terdeteksi calon duplikat berdasarkan nomor telepon/nama"
                      >
                        Potensi Duplikat
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">Norm: {item.normalizedName}</div>
                </td>
                <td className="p-3">
                  <div className="flex items-center space-x-1 text-emerald-800 bg-emerald-50 px-2 py-1 rounded font-medium text-[11px] w-fit">
                    <Building2 className="w-3 h-3 text-emerald-600" />
                    <span>{item.primaryInstitution}</span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center space-x-1 text-slate-600">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{item.email}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-500 text-[10px] mt-0.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{item.phone}</span>
                  </div>
                </td>
                <td className="p-3 text-slate-600">{item.cityName}</td>
                <td className="p-3">
                  <StatusBadge
                    label={item.profileStatus === "ACTIVE" ? "Aktif" : item.profileStatus}
                    variant={item.profileStatus === "ACTIVE" ? "success" : "neutral"}
                  />
                </td>
                <td className="p-3 text-right space-x-1">
                  <Link
                    to={`/admin/ustadz/${item.id}`}
                    className="inline-flex items-center p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded"
                    title="Lihat Profil"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link
                    to={`/admin/ustadz/${item.id}/edit`}
                    className="inline-flex items-center p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded"
                    title="Edit Profil"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View (< 768px) */}
      <div className="md:hidden space-y-3">
        {filtered.map((item) => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{item.fullName}</h4>
                <div className="text-[10px] text-slate-400 font-mono">Norm: {item.normalizedName}</div>
              </div>
              <StatusBadge
                label={item.profileStatus === "ACTIVE" ? "Aktif" : item.profileStatus}
                variant={item.profileStatus === "ACTIVE" ? "success" : "neutral"}
              />
            </div>

            {item.hasDuplicateAlert && (
              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-800 font-semibold flex items-center justify-between">
                <span>⚠️ Potensi Duplikat Terdeteksi</span>
                <Link to="/admin/ustadz/merge" className="underline text-amber-900">
                  Merge
                </Link>
              </div>
            )}

            <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100">
              <div className="flex items-center space-x-1.5 text-emerald-800">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-semibold">{item.primaryInstitution}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{item.email}</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <Link
                to={`/admin/ustadz/${item.id}`}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg flex items-center space-x-1 min-h-[44px]"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Detail</span>
              </Link>
              <Link
                to={`/admin/ustadz/${item.id}/edit`}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg flex items-center space-x-1 min-h-[44px]"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          title="Data Ustadz Tidak Ditemukan"
          description="Tidak ada profil Ustadz yang cocok dengan pencarian Anda."
        />
      )}
    </AdminLayout>
  );
};
