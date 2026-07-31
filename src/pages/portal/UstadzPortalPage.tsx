import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  Home,
  Mail,
  Calendar,
  Clock,
  QrCode,
  Bell,
  User,
  CheckCircle2,
  MapPin,
  Save,
  ExternalLink,
  ShieldCheck,
  XCircle,
  FileText,
} from "lucide-react";

export const UstadzPortalPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  type PortalTab = "HOME" | "INVITATIONS" | "ACTIVITIES" | "SCHEDULE" | "QR" | "ANNOUNCEMENTS" | "PROFILE" | "ATTENDANCE";
  const activeTab: PortalTab = (
    {
      "/portal/invitations": "INVITATIONS",
      "/portal/activities": "ACTIVITIES",
      "/portal/schedule": "SCHEDULE",
      "/portal/qr": "QR",
      "/portal/announcements": "ANNOUNCEMENTS",
      "/portal/profile": "PROFILE",
      "/portal/attendance": "ATTENDANCE",
    } as Partial<Record<string, PortalTab>>
  )[location.pathname] || "HOME";

  // Profile Form State (Compliance Point 6 & 7)
  const [phone, setPhone] = useState("081299990000");
  const [specialization, setSpecialization] = useState("Fiqih Muamalah & Dakwah Asatidz");
  const [lastEducation, setLastEducation] = useState("S1 Syariah - Universitas Islam Madinah");
  const [currentActivity, setCurrentActivity] = useState("Pengajar Khusus Ma'had & Musyrif Daurah");
  const [address, setAddress] = useState("Jl. Sukajadi No. 45, Bandung, Jawa Barat");

  // Read-only fixed profile fields (Cannot be edited by Ustadz)
  const readOnlyFields = {
    fullName: "Ustadz Abdullah, Lc.",
    email: "abdullah@yts.or.id",
    primaryInstitution: "Ma'had Ilmu Sunnah Bandung",
    approvalStatus: "VERIFIED", // Strict read-only status
  };

  // RSVP state simulation
  const [invitationRsvp, setInvitationRsvp] = useState<"PENDING" | "ACCEPTED" | "DECLINED">("PENDING");

  const mockUstadzData = {
    participantCode: "PAR-BDG-001",
    event: {
      name: "Daurah Asatidz Nasional 2026 - Bandung",
      dates: "15 - 18 Agustus 2026",
      venueName: "Hotel Grand Asrilia Bandung",
      venueAddress: "Jl. Pelajar Pejuang 45 No. 123, Bandung",
      mapsUrl: "https://maps.google.com/?q=Grand+Asrilia+Bandung",
      status: "CONFIRMED",
    },
    sessions: [
      { id: "s1", title: "Sesi 1: Pembukaan & Sambutan Yayasan", time: "08:00 - 09:30", date: "15 Aug 2026" },
      { id: "s2", title: "Sesi 2: Pengantar Fiqih Daurah Modern", time: "10:00 - 12:00", date: "15 Aug 2026" },
    ],
    announcements: [
      {
        id: "a1",
        title: "Perubahan Ruang Sesi 2 Daurah Bandung",
        content: "Sesi 2 dipindahkan ke Hall Utama Lt. 2 Grand Asrilia.",
        date: "30 Juli 2026",
        isRead: false,
      },
    ],
    attendanceHistory: [
      { id: "att-1", sessionTitle: "Sesi 1: Pembukaan & Sambutan Yayasan", checkInTime: "15 Aug 2026 07:45:12", status: "PRESENT" },
    ],
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Profil Ustadz berhasil diperbarui! Field terbendung (Approval Status & Nama) tetap terkunci secara aman.");
  };

  const handleRsvp = (status: "ACCEPTED" | "DECLINED") => {
    setInvitationRsvp(status);
    alert(`Konfirmasi RSVP Anda (${status === "ACCEPTED" ? "Hadir" : "Batal/Tidak Hadir"}) berhasil disimpan.`);
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* 1. TAB: BERANDA */}
        {activeTab === "HOME" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white rounded-2xl p-6 shadow-lg space-y-3">
              <div className="flex items-center space-x-2">
                <span className="bg-emerald-700/80 text-emerald-100 text-xs font-mono font-bold px-2.5 py-1 rounded">
                  {readOnlyFields.fullName}
                </span>
                <span className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs px-2.5 py-1 rounded font-semibold flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  <span>{readOnlyFields.approvalStatus}</span>
                </span>
              </div>
              <h2 className="text-xl font-bold">{mockUstadzData.event.name}</h2>
              <p className="text-xs text-emerald-100/90">
                Lembaga Afiliasi Utama: <strong>{readOnlyFields.primaryInstitution}</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Status Keikutsertaan Event</span>
                </h3>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-slate-600">Kode Peserta Unik:</span>
                  <span className="font-mono font-bold text-xs text-emerald-800">{mockUstadzData.participantCode}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-xs text-slate-600">Status Konfirmasi:</span>
                  <StatusBadge label={mockUstadzData.event.status} variant="success" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <QrCode className="w-4 h-4 text-emerald-600" />
                    <span>QR Code Akses Cepat</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Gunakan Kode QR ini saat registrasi ulang di lokasi Daurah.</p>
                </div>
                <button
                  onClick={() => navigate("/portal/qr")}
                  className="w-full py-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg hover:bg-emerald-100 min-h-[44px]"
                >
                  Tampilkan QR Full Screen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. TAB: UNDANGAN SAYA */}
        {activeTab === "INVITATIONS" && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-3 flex items-center space-x-2">
              <Mail className="w-4 h-4 text-emerald-600" />
              <span>Daftar Undangan Daurah Saya</span>
            </h3>

            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold block">UNDANGAN INDIVIDUAL</span>
                  <h4 className="font-bold text-slate-900 text-sm">{mockUstadzData.event.name}</h4>
                  <p className="text-xs text-slate-500">Pelaksanaan: {mockUstadzData.event.dates}</p>
                </div>
                <StatusBadge label={invitationRsvp} variant={invitationRsvp === "ACCEPTED" ? "success" : "info"} />
              </div>

              {/* RSVP Action Buttons (Task 5) */}
              <div className="flex items-center space-x-3 pt-3 border-t">
                <button
                  onClick={() => handleRsvp("ACCEPTED")}
                  className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center space-x-1.5 transition min-h-[44px] ${
                    invitationRsvp === "ACCEPTED"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Konfirmasi Hadir</span>
                </button>

                <button
                  onClick={() => handleRsvp("DECLINED")}
                  className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center space-x-1.5 transition min-h-[44px] ${
                    invitationRsvp === "DECLINED"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-rose-50 text-rose-800 hover:bg-rose-100"
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  <span>Tidak Dapat Hadir</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. TAB: KEGIATAN SAYA */}
        {activeTab === "ACTIVITIES" && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-3 flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Detail Kegiatan & Lokasi Venue</span>
            </h3>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">{mockUstadzData.event.venueName}</span>
                  <p className="text-slate-500">{mockUstadzData.event.venueAddress}</p>
                </div>
              </div>

              {mockUstadzData.event.mapsUrl && (
                <a
                  href={mockUstadzData.event.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-emerald-700 font-bold hover:underline pt-2"
                >
                  <span>Petunjuk Arah Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* 4. TAB: JADWAL */}
        {activeTab === "SCHEDULE" && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-3 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Rundown Jadwal Sesi Daurah</span>
            </h3>

            <div className="space-y-2">
              {mockUstadzData.sessions.map((s) => (
                <div key={s.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{s.title}</span>
                    <span className="text-[11px] text-slate-500">{s.date}</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded font-mono font-bold text-[11px]">
                    {s.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. TAB: QR PESERTA */}
        {activeTab === "QR" && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center space-y-6 max-w-md mx-auto print:border-none print:shadow-none print:max-w-none">
            <div className="border-b pb-4">
              <span className="text-[10px] font-bold tracking-widest text-emerald-700 uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 inline-block mb-2">
                Kartu Peserta Resmi Daurah YTS
              </span>
              <h3 className="text-base font-extrabold text-slate-900">{mockUstadzData.event.name}</h3>
              <p className="text-xs text-slate-500 mt-1">{readOnlyFields.fullName} • {readOnlyFields.primaryInstitution}</p>
            </div>

            {/* Opaque QR Code Container (No PII) */}
            <div className="w-52 h-52 bg-slate-950 text-emerald-400 border-4 border-slate-900 rounded-2xl mx-auto flex flex-col items-center justify-center font-mono shadow-md p-4 space-y-2 relative">
              <QrCode className="w-24 h-24 text-emerald-400 animate-pulse" />
              <span className="text-[9px] text-slate-400 break-all px-2 font-mono">
                [Opaque Token: qr_tok_a7f9b8c...]
              </span>
            </div>

            {/* Fallback Code Container */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-medium block">Kode Fallback Presensi Manual</span>
              <p className="font-mono text-base font-black text-emerald-800 tracking-wider">
                {mockUstadzData.participantCode}
              </p>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Tunjukkan QR ini atau sebutkan Kode Fallback di atas kepada Petugas Presensi di lokasi daurah. Token ini terikat khusus untuk event ini.
            </p>

            {/* Print Action Button */}
            <button
              onClick={() => window.print()}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center space-x-2 transition-colors print:hidden"
            >
              <FileText className="w-4 h-4" />
              <span>Cetak Kartu Peserta (Print Card)</span>
            </button>
          </div>
        )}

        {/* 6. TAB: PENGUMUMAN */}
        {activeTab === "ANNOUNCEMENTS" && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-emerald-600" />
                <span>Pengumuman Resmi Panitia</span>
              </div>
              <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                Indikator Dibaca Aktif
              </span>
            </h3>

            <div className="space-y-3">
              {mockUstadzData.announcements.map((ann) => (
                <div key={ann.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-xs text-slate-900">{ann.title}</h4>
                        {ann.isRead ? (
                          <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                            Sudah Dibaca
                          </span>
                        ) : (
                          <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-bold">
                            Belum Dibaca
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block">{ann.date}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{ann.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. TAB: PROFIL (Task 6 & Task 7 Compliance Enforcement) */}
        {activeTab === "PROFILE" && (
          <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-3 flex items-center space-x-2">
              <User className="w-4 h-4 text-emerald-600" />
              <span>Profil Pengguna Ustadz</span>
            </h3>

            {/* Read-Only Status Notice (Compliance Point 7) */}
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-xs space-y-1 text-slate-700">
              <div className="flex justify-between items-center">
                <span>Status Verifikasi Administrasi (Read-Only):</span>
                <StatusBadge label={readOnlyFields.approvalStatus} variant="success" />
              </div>
              <p className="text-[11px] text-slate-500">
                Status verifikasi admin & nama resmi tidak dapat diperbarui secara mandiri demi keamanan data master.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap (Read-Only)</label>
                  <input
                    type="text"
                    disabled
                    value={readOnlyFields.fullName}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-100 font-bold text-slate-700 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lembaga Afiliasi Utama (Read-Only)</label>
                  <input
                    type="text"
                    disabled
                    value={readOnlyFields.primaryInstitution}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-100 font-bold text-slate-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Editable Fields (Task 6) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Whatsapp *</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bidang Keahlian / Spialisasi</label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pendidikan Terakhir</label>
                  <input
                    type="text"
                    value={lastEducation}
                    onChange={(e) => setLastEducation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Aktivitas Dakwah Saat Ini</label>
                  <input
                    type="text"
                    value={currentActivity}
                    onChange={(e) => setCurrentActivity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Domisili</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end border-t pt-4">
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow flex items-center space-x-1.5 min-h-[44px]"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan Profil</span>
              </button>
            </div>
          </form>
        )}

        {/* 8. TAB: RIWAYAT KEHADIRAN */}
        {activeTab === "ATTENDANCE" && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-3 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Riwayat Presensi Check-in Sesi Daurah</span>
            </h3>

            <div className="space-y-2">
              {mockUstadzData.attendanceHistory.map((att) => (
                <div key={att.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">{att.sessionTitle}</span>
                    <span className="text-[10px] text-slate-500">Waktu Check-in: {att.checkInTime}</span>
                  </div>
                  <StatusBadge label={att.status} variant="success" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
};
