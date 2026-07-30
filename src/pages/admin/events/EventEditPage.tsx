import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Calendar, Save, AlertCircle } from "lucide-react";

export const EventEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Rincian Event ID ${id} berhasil diperbarui!`);
    navigate("/admin/events");
  };

  return (
    <AdminLayout>
      <PageHeader
        title="Edit Rincian Event Daurah"
        description="Perbarui tanggal, venue, atau kapasitas event."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Event Daurah", href: "/admin/events" },
          { label: `Edit Event #${id}` },
        ]}
      />

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 max-w-3xl">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong>Aturan Status:</strong> Pengubahan status event hanya dapat dilakukan via <em>Command Transition</em> resmi pada halaman Detail Event.
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Event Daurah *</label>
            <input
              type="text"
              defaultValue="Daurah Asatidz Nasional 2026 - Bandung"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status Event (Read-Only)</label>
              <input
                type="text"
                disabled
                value="ONGOING (Sedang Berlangsung)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-slate-100 font-bold text-emerald-800 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Timezone</label>
              <select defaultValue="Asia/Jakarta" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 border-t pt-4">
          <button
            type="button"
            onClick={() => navigate("/admin/events")}
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
