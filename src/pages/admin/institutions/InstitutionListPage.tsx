import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Building2, Plus, Search, Filter, Eye, Edit, Trash2, MapPin, Mail, Phone } from "lucide-react";

export const InstitutionListPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [verificationFilter, setVerificationFilter] = useState("ALL");

  // Sample static data for foundation presentation
  const mockInstitutions = [
    {
      id: "101",
      code: "MISB-01",
      name: "Ma'had Ilmu Sunnah Bandung",
      institutionType: "Pesantren",
      cityCode: "3273", // Bandung
      provinceCode: "32", // Jawa Barat
      email: "kontak@mahadsunnah.or.id",
      phone: "081234567890",
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
    },
    {
      id: "102",
      code: "YDAH-02",
      name: "Yayasan Dakwah Al-Hikmah Cimahi",
      institutionType: "Yayasan",
      cityCode: "3277", // Cimahi
      provinceCode: "32", // Jawa Barat
      email: "info@alhikmah.or.id",
      phone: "081987654321",
      status: "ACTIVE",
      verificationStatus: "UNVERIFIED",
    },
    {
      id: "103",
      code: "RQAS-03",
      name: "Rumah Qur'an As-Salam Garut",
      institutionType: "Rumah Qur'an",
      cityCode: "3205", // Garut
      provinceCode: "32", // Jawa Barat
      email: "garut@assalam.or.id",
      phone: "085678901234",
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
    },
  ];

  const filtered = mockInstitutions.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      item.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || item.status === statusFilter;
    const matchVerif = verificationFilter === "ALL" || item.verificationStatus === verificationFilter;
    return matchSearch && matchStatus && matchVerif;
  });

  return (
    <AdminLayout>
      <PageHeader
        title="Master Data Lembaga"
        description="Kelola profil lembaga dakwah, pesantren, dan perwakilan organisasi partner YTS."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Master Lembaga" }]}
        actions={
          <Link
            to="/admin/institutions/create"
            className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg shadow-sm transition min-h-[44px] sm:min-h-[auto]"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Lembaga</span>
          </Link>
        }
      />

      {/* Filter Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama lembaga, kode, email..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        {/* Filters */}
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
          </select>

          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="ALL">Semua Verifikasi</option>
            <option value="VERIFIED">Terverifikasi</option>
            <option value="UNVERIFIED">Belum Verifikasi</option>
          </select>
        </div>
      </div>

      {/* Desktop Table View (>= 768px) */}
      <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3">Kode & Nama Lembaga</th>
              <th className="p-3">Jenis</th>
              <th className="p-3">Kontak & Email</th>
              <th className="p-3">Verifikasi</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition">
                <td className="p-3">
                  <div className="font-semibold text-slate-900">{item.name}</div>
                  <div className="text-[10px] text-emerald-700 font-mono font-medium">{item.code}</div>
                </td>
                <td className="p-3">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                    {item.institutionType}
                  </span>
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
                <td className="p-3">
                  <StatusBadge
                    label={item.verificationStatus === "VERIFIED" ? "Terverifikasi" : "Belum Verifikasi"}
                    variant={item.verificationStatus === "VERIFIED" ? "success" : "warning"}
                  />
                </td>
                <td className="p-3">
                  <StatusBadge
                    label={item.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                    variant={item.status === "ACTIVE" ? "success" : "neutral"}
                  />
                </td>
                <td className="p-3 text-right space-x-1">
                  <Link
                    to={`/admin/institutions/${item.id}`}
                    className="inline-flex items-center p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded"
                    title="Lihat Detail"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link
                    to={`/admin/institutions/${item.id}/edit`}
                    className="inline-flex items-center p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded"
                    title="Edit Data"
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
                <span className="text-[10px] text-emerald-700 font-mono font-bold block">{item.code}</span>
                <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
              </div>
              <StatusBadge
                label={item.verificationStatus === "VERIFIED" ? "Verified" : "Unverified"}
                variant={item.verificationStatus === "VERIFIED" ? "success" : "warning"}
              />
            </div>

            <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100">
              <div className="flex items-center space-x-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Jenis: {item.institutionType}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{item.email}</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <Link
                to={`/admin/institutions/${item.id}`}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg flex items-center space-x-1 min-h-[44px]"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Detail</span>
              </Link>
              <Link
                to={`/admin/institutions/${item.id}/edit`}
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
          title="Lembaga Tidak Ditemukan"
          description="Tidak ada data lembaga yang cocok dengan kata kunci atau filter pencarian Anda."
        />
      )}
    </AdminLayout>
  );
};
