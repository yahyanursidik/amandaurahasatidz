import React, { useState, useEffect } from "react";
import { QrCode, RefreshCw, ShieldCheck, Clock, Sparkles } from "lucide-react";

export const CommitteeQrDisplayPage: React.FC = () => {
  const [countdown, setCountdown] = useState(30);
  const [rotationCount, setRotationCount] = useState(1);

  const mockSession = {
    eventName: "Daurah Asatidz Nasional 2026 - Bandung",
    title: "Sesi 2: Pengantar Fiqih Daurah Modern",
    date: "15 Agustus 2026",
    timeWindow: "10:00 - 12:00 WIB",
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setRotationCount((c) => c + 1);
          return 30; // Auto-rotate every 30 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleManualRotate = () => {
    setCountdown(30);
    setRotationCount((c) => c + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-8 select-none">
      {/* Header Banner */}
      <div className="text-center space-y-2 max-w-2xl">
        <span className="text-[11px] font-mono font-bold tracking-widest text-emerald-400 uppercase bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-full inline-block mb-1">
          Layar Presensi Lokasi Dinamis (Dynamic Location QR)
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          {mockSession.eventName}
        </h1>
        <p className="text-sm font-medium text-emerald-300">
          {mockSession.title} ({mockSession.timeWindow})
        </p>
      </div>

      {/* Dynamic QR Box with Countdown Timer Visualizer */}
      <div className="bg-slate-900 border-4 border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 max-w-md w-full relative overflow-hidden">
        {/* Top Rotator Status */}
        <div className="flex justify-between items-center text-xs font-mono border-b border-slate-800 pb-4">
          <span className="text-slate-400 flex items-center space-x-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Anti-Foto Statis (Rev #{rotationCount})</span>
          </span>
          <span className="text-emerald-400 font-bold bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-500/40">
            Rotasi: {countdown}s
          </span>
        </div>

        {/* QR Visualizer Container */}
        <div className="w-64 h-64 bg-white rounded-2xl mx-auto flex flex-col items-center justify-center p-4 relative shadow-inner">
          <QrCode className="w-52 h-52 text-slate-950" />
          <div className="absolute bottom-2 bg-slate-950/90 text-emerald-400 text-[9px] font-mono px-2 py-0.5 rounded border border-emerald-500/30">
            loc_qr_rot_{rotationCount}_tok
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / 30) * 100}%` }}
          />
        </div>

        <p className="text-xs text-slate-300 leading-relaxed font-medium">
          Pindai QR ini menggunakan fitur <span className="text-emerald-400 font-bold">Self Check-in</span> di Portal Ustadz pada ponsel Anda.
        </p>

        {/* Manual Refresh Button */}
        <button
          onClick={handleManualRotate}
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2.5 px-4 rounded-xl border border-slate-700 flex items-center justify-center space-x-2 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          <span>Putar Token QR Sekarang</span>
        </button>
      </div>

      {/* Footer Instructions */}
      <div className="text-center text-xs text-slate-400 space-y-1">
        <p className="font-mono text-emerald-400/90">Aman Daurah Asatidz • Panitia On-Site Display</p>
        <p className="text-[11px] text-slate-400">Token lokasi kedaluwarsa secara otomatis setiap 30 detik untuk menjamin kehadiran nyata di tempat acara.</p>
      </div>
    </div>
  );
};
