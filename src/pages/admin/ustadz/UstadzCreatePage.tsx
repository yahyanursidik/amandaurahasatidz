import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { UserCheck, Save, AlertTriangle } from "lucide-react";

export const UstadzCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([]);

  const handleNameChange = (nameVal: string) => {
    setFullName(nameVal);
    // Live Duplicate Check simulation
    if (nameVal.toLowerCase().includes("muslih")) {
      setDuplicateCandidates([
        {
          id: "201",
          fullName: "Ustadz Dr. Muhammad Muslih, Lc., M.A.",
          phone: "081233334444",
          institution: "Ma'had Ilmu Sunnah Bandung",
        },
      ]);
    } else {
      setDuplicateCandidates([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Profil Ustadz berhasil ditambahkan!");
    navigate("/admin/ustadz");
  };

  return (
    <AdminLayout>
      <PageHeader
        title="Tambah Profil Ustadz Baru"
        description="Daftarkan profil Ustadz baru ke dalam master data nasional YTS."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Master Asatidz", href: "/admin/ustadz" },
          { label: "Tambah Ustadz" },
        ]}
      />

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 max-w-3xl">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b pb-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Identitas Pribadi & Gelar</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap Ustadz *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              placeholder="Contoh: Ustadz Dr. Muhammad Muslih, Lc., M.A."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Sistem akan otomatis merapikan dan membuat string nama ternormalisasi tanpa gelar.
            </p>
          </div>

          {/* Live Duplicate Alert */}
          {duplicateCandidates.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Peringatan Calon Duplikat Terdeteksi ({duplicateCandidates.length})</span>
              </div>
              <p className="text-xs text-amber-800">
                Profil dengan nama/nomor telepon serupa ditemukan di database:
              </p>
              <div className="space-y-1 pt-1">
                {duplicateCandidates.map((c) => (
                  <div key={c.id} className="p-2 bg-white rounded border border-amber-200 text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-900">{c.fullName}</span>
                      <span className="block text-[10px] text-slate-500">Afiliasi: {c.institution} | Telp: {c.phone}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Resmi</label>
              <input
                type="email"
                placeholder="email@domain.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Telepon / Whatsapp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="081234567890"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 border-t pt-4">
          <button
            type="button"
            onClick={() => navigate("/admin/ustadz")}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[44px]"
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center space-x-1.5 min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Profil Ustadz</span>
          </button>
        </div>
      </form>
    </AdminLayout>
  );
};
