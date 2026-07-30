import React from "react";
import { CommitteeLayout } from "@/components/layouts/CommitteeLayout";
import { QrCode, Search, CheckCircle2, Clock } from "lucide-react";

export const CommitteeDashboardPage: React.FC = () => {
  return (
    <CommitteeLayout>
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-900">Scanner & Check-in Peserta</h2>
          <p className="text-xs text-slate-500 mt-1">
            Pindai QR Code peserta atau masukkan kode registrasi unik untuk mencatat kehadiran.
          </p>
        </div>

        {/* Check-in Box Mock */}
        <div className="max-w-md mx-auto bg-slate-900 text-white rounded-2xl p-6 text-center shadow-lg border border-slate-800">
          <div className="w-16 h-16 bg-teal-500/20 text-teal-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-teal-500/30">
            <QrCode className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold mb-1">Kamera Scanner Siap</h3>
          <p className="text-xs text-slate-400 mb-4">
            Arahkan kamera ke QR Code peserta Daurah
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="Atau ketik Kode Peserta (misal: YTS-2026-001)..."
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>
      </div>
    </CommitteeLayout>
  );
};
