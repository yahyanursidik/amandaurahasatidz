import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { UserCheck, Save } from "lucide-react";

export const UstadzEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Profil Ustadz ID ${id} berhasil diperbarui!`);
    navigate("/admin/ustadz");
  };

  return (
    <AdminLayout>
      <PageHeader
        title="Edit Profil Ustadz"
        description="Perbarui informasi identitas, nomor kontak, atau ringkasan pendidikan Ustadz."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Master Asatidz", href: "/admin/ustadz" },
          { label: `Edit Profil #${id}` },
        ]}
      />

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 max-w-3xl">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 border-b pb-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Pembaruan Data Ustadz #{id}</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap Ustadz *</label>
            <input
              type="text"
              defaultValue="Ustadz Dr. Muhammad Muslih, Lc., M.A."
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
            />
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
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </form>
    </AdminLayout>
  );
};
