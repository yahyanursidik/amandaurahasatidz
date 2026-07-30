import React from "react";
import { useParams } from "react-router-dom";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { QrCode, CheckCircle2, AlertCircle } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";

export const CheckInPublicPage: React.FC = () => {
  const { eventSlug } = useParams<{ eventSlug: string }>();

  return (
    <PublicLayout>
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
            <QrCode className="w-7 h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Check-in Kehadiran Daurah</h1>
          <p className="text-xs text-slate-500 mt-1">
            Event: <span className="font-semibold text-slate-800">{eventSlug || "dayts-2026"}</span>
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center space-y-4">
          <StatusBadge label="Jendela Check-in Terbuka" variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />} />
          <p className="text-xs text-slate-600">
            Silakan perlihatkan QR Code peserta Anda kepada petugas di pintu masuk lokasi kegiatan.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
};
