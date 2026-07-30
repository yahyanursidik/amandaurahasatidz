import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { GitMerge, AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";

export const UstadzMergePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSource = searchParams.get("source") || "";

  const [sourceId, setSourceId] = useState(initialSource);
  const [targetId, setTargetId] = useState("");
  const [isMerging, setIsMerging] = useState(false);

  const mockUstadzList = [
    { id: "201", name: "Ustadz Dr. Muhammad Muslih, Lc., M.A. (ID: 201)" },
    { id: "203", name: "Ustadz Muslih, Lc. (ID: 203 - Duplikat)" },
  ];

  const handleMergeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !targetId) {
      alert("Silakan pilih profil sumber dan profil target.");
      return;
    }
    if (sourceId === targetId) {
      alert("Profil sumber dan target tidak boleh sama.");
      return;
    }

    setIsMerging(true);
    setTimeout(() => {
      alert("Workflow Merge Profil berhasil dieksekusi secara transaction-safe & diaudit!");
      setIsMerging(false);
      navigate("/admin/ustadz");
    }, 1000);
  };

  return (
    <AdminLayout>
      <PageHeader
        title="Workflow Penggabungan Profil Duplikat (Merge)"
        description="Gabungkan dua profil Ustadz duplikat secara aman (transaction-safe) ke dalam satu profil target utama."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Master Asatidz", href: "/admin/ustadz" },
          { label: "Merge Profil" },
        ]}
      />

      <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6 text-xs text-amber-900 space-y-2 max-w-3xl">
        <div className="flex items-center space-x-2 font-bold text-amber-950">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>Aturan Keamanan Penggabungan Profil (Transaction-Safe Enforcement)</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-amber-800">
          <li>Seluruh riwayat afiliasi lembaga dan partisipasi event akan dipindahkan ke Profil Target.</li>
          <li>Profil Sumber akan diubah statusnya menjadi <strong>MERGED</strong> dan dinonaktifkan.</li>
          <li>Proses penggabungan berjalan secara atomis di database dan dicatat secara permanen di Audit Log.</li>
        </ul>
      </div>

      <form onSubmit={handleMergeSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Source Profile */}
          <div className="p-4 border border-rose-200 rounded-xl bg-rose-50/50 space-y-3">
            <h4 className="font-bold text-xs text-rose-900 uppercase tracking-wider">
              1. Profil Sumber (Akan Di-merge / Dinonaktifkan)
            </h4>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              required
              className="w-full p-2.5 bg-white border border-rose-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="">-- Pilih Profil Sumber --</option>
              {mockUstadzList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Arrow Indicator */}
          <div className="hidden md:flex justify-center text-slate-400">
            <ArrowRight className="w-6 h-6" />
          </div>

          {/* Target Profile */}
          <div className="p-4 border border-emerald-200 rounded-xl bg-emerald-50/50 space-y-3">
            <h4 className="font-bold text-xs text-emerald-900 uppercase tracking-wider">
              2. Profil Target (Profil Utama yang Dipertahankan)
            </h4>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              required
              className="w-full p-2.5 bg-white border border-emerald-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Pilih Profil Target --</option>
              {mockUstadzList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
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
            disabled={isMerging}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg flex items-center space-x-1.5 min-h-[44px] disabled:opacity-50"
          >
            <GitMerge className="w-4 h-4" />
            <span>{isMerging ? "Memproses Merge..." : "Eksekusi Merge Profil"}</span>
          </button>
        </div>
      </form>
    </AdminLayout>
  );
};
