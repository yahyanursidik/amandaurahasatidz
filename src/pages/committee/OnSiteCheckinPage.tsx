import React, { useState } from "react";
import {
  QrCode,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  Building2,
  RefreshCw,
  XCircle,
  Sparkles,
} from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";

export const OnSiteCheckinPage: React.FC = () => {
  const [inputCode, setInputCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(true);

  const [activeSession] = useState({
    title: "Sesi 1: Pembukaan & Sambutan Yayasan",
    date: "15 Agustus 2026",
    checkinWindow: "07:00 - 09:00 WIB",
    isOpen: true,
  });

  const [lastCheckinResult, setLastCheckinResult] = useState<{
    status: "SUCCESS" | "DUPLICATE" | "FAILED" | null;
    message: string;
    participant?: {
      code: string;
      name: string;
      institution: string;
      checkinTime: string;
    };
  }>({
    status: "SUCCESS",
    message: "Presensi berhasil dicatat!",
    participant: {
      code: "PAR-2026-A8K9M2P4",
      name: "Ustadz Abdullah, Lc.",
      institution: "Ma'had Ilmu Sunnah Bandung",
      checkinTime: "15 Aug 2026 07:48:12 WIB",
    },
  });

  const [recentLogs] = useState([
    { id: "log-1", code: "PAR-2026-A8K9M2P4", name: "Ustadz Abdullah, Lc.", institution: "Ma'had Ilmu Sunnah Bandung", time: "07:48:12", status: "SUCCESS" },
    { id: "log-2", code: "PAR-2026-F4M9P2X1", name: "Ustadz Hamzah, M.Ag.", institution: "STDI Imam Syafi'i Jember", time: "07:45:09", status: "SUCCESS" },
    { id: "log-3", code: "PAR-2026-Z9K2L4P8", name: "Ustadz Ridwan", institution: "Pesantren Al-Irsyad SBY", time: "07:40:22", status: "DUPLICATE", reason: "Presensi ganda" },
  ]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    if (inputCode.includes("DUP")) {
      setLastCheckinResult({
        status: "DUPLICATE",
        message: `Presensi ganda ditolak: Peserta ${inputCode} sudah pernah melakukan check-in pada sesi ini.`,
      });
    } else {
      setLastCheckinResult({
        status: "SUCCESS",
        message: "Presensi berhasil dicatat secara manual!",
        participant: {
          code: inputCode.toUpperCase(),
          name: "Ustadz Ahmad Fauzi, M.H.",
          institution: "Pondok Sunnah Jakarta",
          checkinTime: new Date().toLocaleTimeString() + " WIB",
        },
      });
    }
    setInputCode("");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Header Banner & Active Session Indicator */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Mode On-Site Active</span>
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Presensi Kehadiran Daurah Asatidz</h1>
          <p className="text-xs text-slate-400">{activeSession.title} • {activeSession.date}</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5 flex items-center space-x-3">
          <Clock className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="text-slate-400 block text-[10px]">Jendela Check-in Sesi:</span>
            <span className="font-mono font-bold text-white">{activeSession.checkinWindow}</span>
          </div>
          <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30">
            DIBUKA
          </span>
        </div>
      </div>

      {/* 2. Main Grid: Scanner & Result */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: QR Scanner & Manual Input (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Browser QR Scanner Container */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span>Browser QR Scanner (Kamera On-Site)</span>
              </h3>
              <button
                onClick={() => setIsScanning(!isScanning)}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-medium flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isScanning ? "Jeda Kamera" : "Aktifkan Kamera"}</span>
              </button>
            </div>

            {/* Visualizer Target Box */}
            <div className="w-full h-64 bg-slate-950 rounded-xl relative overflow-hidden flex flex-col items-center justify-center border-2 border-slate-800 shadow-inner">
              {isScanning ? (
                <>
                  <div className="w-44 h-44 border-2 border-emerald-500/80 rounded-xl relative flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    <span className="w-full h-0.5 bg-emerald-400 absolute top-1/2 left-0 -translate-y-1/2 animate-pulse shadow-[0_0_8px_rgba(16,185,129,1)]" />
                    <Sparkles className="w-8 h-8 text-emerald-400/40" />
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400/90 mt-4 bg-slate-900/80 px-3 py-1 rounded-full border border-emerald-500/30">
                    Arahkan QR Code Peserta ke Target Kotak...
                  </span>
                </>
              ) : (
                <div className="text-center text-slate-400 space-y-2">
                  <XCircle className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs">Kamera Pemindai Sedang Dijeda</p>
                </div>
              )}
            </div>

            {/* Manual Fallback Input Code */}
            <form onSubmit={handleManualSubmit} className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 block">
                Input Kode Fallback (PAR-2026-XXXX) / Opaque Token
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="Contoh: PAR-2026-A8K9M2P4 atau qr_tok_..."
                  className="flex-1 border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors"
                >
                  Proses Check-in
                </button>
              </div>
            </form>

            {/* Search by Name / Institution */}
            <div className="space-y-2 pt-2 border-t">
              <label className="text-xs font-bold text-slate-700 block">Pencarian Nama Ustadz / Lembaga Afiliasi</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik Nama Ustadz atau Asal Lembaga..."
                  className="w-full pl-9 pr-3.5 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Scan Result Card & Recent Stream (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Result Card */}
          {lastCheckinResult.status && (
            <div
              className={`border rounded-2xl p-6 shadow-sm space-y-4 ${
                lastCheckinResult.status === "SUCCESS"
                  ? "bg-emerald-50/60 border-emerald-300"
                  : lastCheckinResult.status === "DUPLICATE"
                  ? "bg-amber-50/60 border-amber-300"
                  : "bg-rose-50/60 border-rose-300"
              }`}
            >
              <div className="flex items-center space-x-2">
                {lastCheckinResult.status === "SUCCESS" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <h3
                  className={`text-sm font-bold ${
                    lastCheckinResult.status === "SUCCESS"
                      ? "text-emerald-900"
                      : lastCheckinResult.status === "DUPLICATE"
                      ? "text-amber-900"
                      : "text-rose-900"
                  }`}
                >
                  {lastCheckinResult.message}
                </h3>
              </div>

              {lastCheckinResult.participant && (
                <div className="bg-white rounded-xl p-4 border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-mono font-bold text-emerald-800">{lastCheckinResult.participant.code}</span>
                    <StatusBadge label="TERKONFIRMASI" variant="success" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Nama Peserta</span>
                    <span className="font-bold text-slate-900 text-sm block">{lastCheckinResult.participant.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">Lembaga Afiliasi</span>
                    <span className="text-slate-700 block">{lastCheckinResult.participant.institution}</span>
                  </div>
                  <div className="pt-1 flex justify-between text-[11px] text-slate-500">
                    <span>Waktu Check-in:</span>
                    <span className="font-mono font-bold text-slate-900">{lastCheckinResult.participant.checkinTime}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stream Check-in Terbaru */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Riwayat Check-in Terbaru</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">{recentLogs.length} Aktivitas</span>
            </h3>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {recentLogs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 block">{log.name}</span>
                    <span className="text-[10px] text-slate-500 block">{log.institution} • {log.code}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-700 text-[11px] block">{log.time}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded inline-block mt-0.5 ${
                        log.status === "SUCCESS" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {log.status === "SUCCESS" ? "SUKSES" : "SCAN GANDA"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
