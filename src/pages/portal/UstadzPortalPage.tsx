import React from "react";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { Calendar, QrCode, CheckCircle, Bell } from "lucide-react";

export const UstadzPortalPage: React.FC = () => {
  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold text-slate-900">Portal Daurah Ustadz</h2>
          <p className="text-xs text-slate-500 mt-1">
            Selamat datang di Sistem Informasi Daurah Asatidz YTS.
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              QR Code Kehadiran Anda
            </span>
            <h3 className="text-base font-bold text-emerald-950 mt-0.5">
              Daurah Asatidz YTS 2026
            </h3>
            <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
              Tunjukkan QR Code ini pada petugas registrasi saat memasuki lokasi kegiatan.
            </p>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
};
