import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Building2, MapPin, Mail, Phone, UserCheck, ShieldCheck, History, Edit } from "lucide-react";

export const InstitutionShowPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<"INFO" | "REPRESENTATIVES" | "HISTORY">("INFO");

  const institution = {
    id: id || "101",
    code: "MISB-01",
    name: "Ma'had Ilmu Sunnah Bandung",
    legalName: "Yayasan Pendidikan Sunnah Bandung",
    institutionType: "Pesantren / Ma'had",
    status: "ACTIVE",
    verificationStatus: "VERIFIED",
    email: "kontak@mahadsunnah.or.id",
    phone: "081234567890",
    address: "Jl. Soekarno-Hatta No. 456, Buahbatu",
    provinceName: "Jawa Barat",
    cityName: "Kota Bandung",
    district: "Buahbatu",
    representatives: [
      {
        id: "rep-1",
        name: "Ustadz Abdullah, Lc.",
        position: "Pimpinan Ma'had",
        email: "abdullah@mahadsunnah.or.id",
        phone: "081299990000",
        isPrimary: true,
      },
      {
        id: "rep-2",
        name: "Hasan Basri",
        position: "Sekretaris Yayasan",
        email: "hasan@mahadsunnah.or.id",
        phone: "081288881111",
        isPrimary: false,
      },
    ],
  };

  return (
    <AdminLayout>
      <PageHeader
        title={institution.name}
        description={`Detail informasi profil lembaga partner (Kode: ${institution.code})`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Master Lembaga", href: "/admin/institutions" },
          { label: institution.code },
        ]}
        actions={
          <Link
            to={`/admin/institutions/${institution.id}/edit`}
            className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition min-h-[44px]"
          >
            <Edit className="w-4 h-4" />
            <span>Edit Lembaga</span>
          </Link>
        }
      />

      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs text-emerald-700 font-bold">{institution.code}</span>
              <StatusBadge
                label={institution.verificationStatus === "VERIFIED" ? "Terverifikasi" : "Belum Verifikasi"}
                variant={institution.verificationStatus === "VERIFIED" ? "success" : "warning"}
              />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{institution.name}</h2>
            <p className="text-xs text-slate-500">{institution.legalName}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <StatusBadge
            label={institution.status === "ACTIVE" ? "Status: Aktif" : "Status: Nonaktif"}
            variant={institution.status === "ACTIVE" ? "success" : "neutral"}
          />
        </div>
      </div>

      {/* Mobile-Friendly Tabs */}
      <div className="flex border-b border-slate-200 mb-6 space-x-4">
        <button
          onClick={() => setActiveTab("INFO")}
          className={`pb-3 text-xs font-semibold border-b-2 transition min-h-[44px] ${
            activeTab === "INFO"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Profil & Alamat
        </button>
        <button
          onClick={() => setActiveTab("REPRESENTATIVES")}
          className={`pb-3 text-xs font-semibold border-b-2 transition min-h-[44px] ${
            activeTab === "REPRESENTATIVES"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Perwakilan ({institution.representatives.length})
        </button>
        <button
          onClick={() => setActiveTab("HISTORY")}
          className={`pb-3 text-xs font-semibold border-b-2 transition min-h-[44px] ${
            activeTab === "HISTORY"
              ? "border-emerald-600 text-emerald-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Riwayat Daurah
        </button>
      </div>

      {/* Tab 1: Info & Region */}
      {activeTab === "INFO" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-2">
              Informasi Umum
            </h3>
            <div className="text-xs space-y-2 text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Jenis Lembaga:</span>
                <span className="font-semibold">{institution.institutionType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Email Resmi:</span>
                <span className="font-semibold">{institution.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Telepon / Whatsapp:</span>
                <span className="font-semibold">{institution.phone}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-2 flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Lokasi & Wilayah</span>
            </h3>
            <div className="text-xs space-y-2 text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Provinsi:</span>
                <span className="font-semibold">{institution.provinceName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Kota / Kabupaten:</span>
                <span className="font-semibold">{institution.cityName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Kecamatan:</span>
                <span className="font-semibold">{institution.district}</span>
              </div>
              <div className="pt-2">
                <span className="text-slate-500 block mb-1">Alamat Lengkap:</span>
                <p className="p-2 bg-slate-50 rounded text-slate-800 font-medium">{institution.address}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Representatives */}
      {activeTab === "REPRESENTATIVES" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Daftar Perwakilan Resmi
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {institution.representatives.map((rep) => (
              <div key={rep.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{rep.name}</h4>
                    <p className="text-xs text-slate-500">{rep.position}</p>
                  </div>
                  {rep.isPrimary && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                      Kontak Utama
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-200">
                  <div className="flex items-center space-x-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{rep.email}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{rep.phone}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: History */}
      {activeTab === "HISTORY" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-2 flex items-center space-x-1">
            <History className="w-4 h-4 text-emerald-600" />
            <span>Riwayat Keikutsertaan Daurah</span>
          </h3>
          <p className="text-xs text-slate-600">
            Lembaga ini telah diundang pada 2 kegiatan Aman Daurah Asatidz sebelumnya.
          </p>
        </div>
      )}
    </AdminLayout>
  );
};
