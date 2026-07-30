import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { UserCheck, Building2, Mail, Phone, MapPin, History, GitMerge, Edit, Plus } from "lucide-react";

export const UstadzShowPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"PROFILE" | "AFFILIATIONS" | "EVENTS">("PROFILE");

  const ustadz = {
    id: id || "201",
    fullName: "Ustadz Dr. Muhammad Muslih, Lc., M.A.",
    normalizedName: "muhammad muslih",
    email: "m.muslih@yts.or.id",
    phone: "081233334444",
    profileStatus: "ACTIVE",
    cityName: "Kota Bandung",
    provinceName: "Jawa Barat",
    educationSummary: "S1 Universitas Islam Madinah, S2 & S3 Universitas Lipia Jakarta",
    expertiseSummary: "Fiqih Muamalah, Fiqih Ibadah, Hadits",
    affiliations: [
      {
        id: "aff-1",
        institutionName: "Ma'had Ilmu Sunnah Bandung",
        institutionCode: "MISB-01",
        position: "Pimpinan Pengasuh",
        isPrimary: true,
        startDate: "2020-01-01",
        endDate: null,
        status: "ACTIVE",
      },
      {
        id: "aff-2",
        institutionName: "Yayasan Dakwah Al-Hikmah Cimahi",
        institutionCode: "YDAH-02",
        position: "Penasihat Syariah",
        isPrimary: false,
        startDate: "2022-06-15",
        endDate: null,
        status: "ACTIVE",
      },
    ],
  };

  return (
    <AdminLayout>
      <PageHeader
        title={ustadz.fullName}
        description={`Profil Asatidz (Normalized: ${ustadz.normalizedName})`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Master Asatidz", href: "/admin/ustadz" },
          { label: `Ustadz #${ustadz.id}` },
        ]}
        actions={
          <div className="flex items-center space-x-2">
            <Link
              to={`/admin/ustadz/merge?source=${ustadz.id}`}
              className="inline-flex items-center space-x-1 bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition min-h-[44px]"
            >
              <GitMerge className="w-4 h-4" />
              <span>Merge Profil</span>
            </Link>
            <Link
              to={`/admin/ustadz/${ustadz.id}/edit`}
              className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition min-h-[44px]"
            >
              <Edit className="w-4 h-4" />
              <span>Edit Profil</span>
            </Link>
          </div>
        }
      />

      {/* Header Profile Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-full shrink-0">
            <UserCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{ustadz.fullName}</h2>
            <p className="text-xs text-slate-500 font-mono">Norm: {ustadz.normalizedName}</p>
            <div className="flex items-center space-x-3 text-xs text-slate-600 mt-2">
              <span className="flex items-center space-x-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{ustadz.email}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{ustadz.phone}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <StatusBadge label={ustadz.profileStatus} variant="success" />
        </div>
      </div>

      {/* Mobile-Friendly Tabs */}
      <div className="flex border-b border-slate-200 mb-6 space-x-4">
        <button
          onClick={() => setActiveTab("PROFILE")}
          className={`pb-3 text-xs font-semibold border-b-2 transition min-h-[44px] ${
            activeTab === "PROFILE"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Detail Profil & Pendidikan
        </button>
        <button
          onClick={() => setActiveTab("AFFILIATIONS")}
          className={`pb-3 text-xs font-semibold border-b-2 transition min-h-[44px] ${
            activeTab === "AFFILIATIONS"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Riwayat Afiliasi Lembaga ({ustadz.affiliations.length})
        </button>
        <button
          onClick={() => setActiveTab("EVENTS")}
          className={`pb-3 text-xs font-semibold border-b-2 transition min-h-[44px] ${
            activeTab === "EVENTS"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Riwayat Kehadiran Daurah
        </button>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === "PROFILE" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-2">
              Latar Belakang Pendidikan
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
              {ustadz.educationSummary}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-2">
              Bidang Keahlian & Kepakaran
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
              {ustadz.expertiseSummary}
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Affiliations History (Many-to-Many compliant) */}
      {activeTab === "AFFILIATIONS" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Riwayat Afiliasi Lembaga (Banyak Lembaga)
            </h3>
            <button className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg flex items-center space-x-1">
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Afiliasi</span>
            </button>
          </div>

          <div className="space-y-3">
            {ustadz.affiliations.map((aff) => (
              <div
                key={aff.id}
                className={`p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  aff.isPrimary ? "bg-emerald-50 border-emerald-300" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] text-emerald-700 font-bold">{aff.institutionCode}</span>
                    <h4 className="font-bold text-slate-900 text-sm">{aff.institutionName}</h4>
                    {aff.isPrimary && (
                      <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded font-bold">
                        Afiliasi Utama Aktif
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">Jabatan / Posisi: {aff.position}</p>
                </div>

                <div className="text-xs text-slate-500 shrink-0">
                  <span>Mulai: {aff.startDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Events History */}
      {activeTab === "EVENTS" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-2 flex items-center space-x-1">
            <History className="w-4 h-4 text-emerald-600" />
            <span>Riwayat Keikutsertaan Daurah</span>
          </h3>
          <p className="text-xs text-slate-600">
            Ustadz telah tercatat hadir pada 3 event Daurah Asatidz YTS nasional.
          </p>
        </div>
      )}
    </AdminLayout>
  );
};
