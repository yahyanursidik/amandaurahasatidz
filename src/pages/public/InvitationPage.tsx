import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { Calendar, UserCheck, ShieldCheck, Save, Send, CheckCircle2, Plus, Trash2, Search, UserPlus, Building2, MapPin } from "lucide-react";
import { ENV } from "@/config/env";
import { DEFAULT_EVENT_POSTER, posterObjectPosition } from "@/lib/eventPoster";

export const InvitationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const invitationType = location.pathname.includes("/individual/") ? "individual" : "institution";

  // Verification step
  const [emailVerified, setEmailVerified] = useState(false);
  const [repEmail, setRepEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");

  // Response & Delegates state
  const [responseStatus, setResponseStatus] = useState<"ACCEPTED" | "DECLINED">("ACCEPTED");
  const [notes, setNotes] = useState("");
  const [delegates, setDelegates] = useState<
    {
      fullName: string;
      phone: string;
      whatsapp: string;
      email: string;
      address: string;
      isLead: boolean;
      existingProfileId?: string;
    }[]
  >([
    {
      fullName: "Ustadz Abdullah, Lc.",
      phone: "081299990000",
      whatsapp: "081299990000",
      email: "abdullah@example.org",
      address: "Bandung, Jawa Barat",
      isLead: true,
    },
  ]);
  const [isSubmittedFinal, setIsSubmittedFinal] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  // Search existing modal state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [mockData, setMockData] = useState({
    invitationNumber: "INV/2026/BDG/001",
    quota: 3,
    eventName: "Daurah Asatidz Nasional 2026 - Bandung",
    eventDates: "15 - 18 Agustus 2026",
    institutionName: "Ma'had Ilmu Sunnah Bandung",
    institutionCode: "MISB-01",
    representativeEmail: "kontak@mahadsunnah.or.id",
    responseDeadline: "2026-08-05T16:59:00Z",
    eventSubtitle: "Penguatan ilmu dan silaturahmi antar lembaga",
    venueName: "Aula Markaz",
    venueAddress: "Bandung, Jawa Barat",
    posterUrl: DEFAULT_EVENT_POSTER,
    posterAlt: "Interior perpustakaan sebagai poster Daurah Asatidz",
    posterFocalPoint: "CENTER",
  });

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const loadInvitation = async () => {
      try {
        const response = await fetch(`${ENV.API_BASE_URL}/invitations/public/${invitationType}/${token}`, {
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || "Undangan tidak dapat dibuka.");
        const data = result.data;
        setMockData((current) => ({
          ...current,
          invitationNumber: data.invitation.invitationNumber,
          quota: data.invitation.quota || 1,
          eventName: data.event.name,
          eventDates: `${new Date(data.event.startDate).toLocaleDateString("id-ID")} – ${new Date(
            data.event.endDate
          ).toLocaleDateString("id-ID")}`,
          institutionName: data.institution?.name || "Undangan Individu",
          institutionCode: data.institution?.code || "INDIVIDU",
          representativeEmail: data.institution?.email || "",
          responseDeadline: data.invitation.responseDeadline || "",
          eventSubtitle: data.event.subtitle || "",
          venueName: data.event.venueName || "",
          venueAddress: data.event.venueAddress || "",
          posterUrl: data.event.posterUrl || DEFAULT_EVENT_POSTER,
          posterAlt: data.event.posterAlt || `Poster ${data.event.name}`,
          posterFocalPoint: data.event.posterFocalPoint || "CENTER",
        }));
        setDelegates([]);
      } catch (error) {
        if (!controller.signal.aborted) {
          setPageError(error instanceof Error ? error.message : "Undangan tidak dapat dibuka.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void loadInvitation();
    return () => controller.abort();
  }, [token, invitationType]);

  const existingUstadzCandidates = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      fullName: "Ustadz Dr. Muhammad Muslih, Lc., M.A.",
      phone: "081233334444",
      email: "muslih@example.org",
      address: "Bandung, Jawa Barat",
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      fullName: "Ustadz Abu Ahmad Zakaria",
      phone: "081955556666",
      email: "abu.ahmad@example.org",
      address: "Jakarta, DKI Jakarta",
    },
  ];

  const handleVerifyEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (repEmail.trim().toLowerCase() === mockData.representativeEmail.toLowerCase() || verificationCode === "123456") {
      setEmailVerified(true);
    } else {
      alert("Email perwakilan tidak sesuai. Gunakan kode OTP 123456 untuk simulasi.");
    }
  };

  const handleAddDelegate = (candidate?: {
    id: string;
    fullName: string;
    phone: string;
    email: string;
    address: string;
  }) => {
    if (delegates.length >= mockData.quota) {
      alert(`Kuota delegasi maksimal untuk lembaga Anda adalah ${mockData.quota} orang.`);
      return;
    }

    if (candidate) {
      setDelegates([
        ...delegates,
        {
          fullName: candidate.fullName,
          phone: candidate.phone,
          whatsapp: candidate.phone,
          email: candidate.email,
          address: candidate.address,
          isLead: false,
          existingProfileId: candidate.id,
        },
      ]);
      setShowSearchModal(false);
    } else {
      setDelegates([
        ...delegates,
        { fullName: "", phone: "", whatsapp: "", email: "", address: "", isLead: false },
      ]);
    }
  };

  const handleSetLead = (index: number) => {
    setDelegates(delegates.map((d, i) => ({ ...d, isLead: i === index })));
  };

  const handleRemoveDelegate = (index: number) => {
    setDelegates(delegates.filter((_, i) => i !== index));
  };

  const submitResponse = async (isFinal: boolean) => {
    if (!token) throw new Error("Token undangan tidak tersedia.");
    const response = await fetch(`${ENV.API_BASE_URL}/invitations/public/${invitationType}/${token}/response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responseStatus,
        notes,
        isFinal,
        emailVerificationCode: verificationCode,
        delegates: responseStatus === "ACCEPTED"
          ? delegates.map((delegate) => ({
              ...delegate,
              email: delegate.email.trim() || null,
              phone: delegate.phone.trim() || null,
              whatsapp: delegate.whatsapp.trim() || null,
              address: delegate.address.trim() || null,
            }))
          : [],
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      if (result.error?.details?.fieldErrors) {
        const errors = Object.entries(result.error.details.fieldErrors)
          .map(([field, msg]) => `- ${field}: ${msg}`)
          .join("\n");
        throw new Error(`${result.error.message}\n${errors}`);
      }
      throw new Error(result.error?.message || "Konfirmasi gagal disimpan.");
    }
    return result.data;
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setPageError("");
    try {
      await submitResponse(false);
      alert("Draft formulir delegasi berhasil disimpan sementara.");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Draft gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (delegates.length === 0 && responseStatus === "ACCEPTED") {
      alert("Silakan masukkan minimal 1 delegasi Ustadz.");
      return;
    }
    setIsSaving(true);
    setPageError("");
    try {
      await submitResponse(true);
      setIsSubmittedFinal(true);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Konfirmasi final gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const remainingQuota = mockData.quota - delegates.length;
  const deadlineExpired = Boolean(mockData.responseDeadline && new Date(mockData.responseDeadline) < new Date());

  return (
    <PublicLayout>
      <div className="invitation-page mx-auto max-w-5xl space-y-6">
        {isLoading && (
          <div className="space-y-3" aria-label="Memuat undangan">
            <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
          </div>
        )}
        {pageError && (
          <div role="alert" className="whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-900">
            {pageError}
          </div>
        )}
        {!isLoading && (
        <>
        <header className="invitation-event-hero">
          <div className="invitation-event-hero__poster">
            <img
              src={mockData.posterUrl || DEFAULT_EVENT_POSTER}
              alt={mockData.posterAlt || `Poster ${mockData.eventName}`}
              style={{ objectPosition: posterObjectPosition(mockData.posterFocalPoint) }}
            />
          </div>
          <div className="invitation-event-hero__content">
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-700/80 text-emerald-100 text-xs font-mono font-bold px-2.5 py-1 rounded">
              {mockData.invitationNumber}
            </span>
            <span className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs px-2.5 py-1 rounded font-semibold">
              {invitationType === "institution" ? `Kuota ${mockData.quota} asatidz` : "Undangan individu"}
            </span>
          </div>

          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Undangan resmi</p>
          <h1 className="text-2xl font-black leading-tight sm:text-3xl">{mockData.eventName}</h1>
          {mockData.eventSubtitle && <p className="text-sm leading-6 text-emerald-100">{mockData.eventSubtitle}</p>}

          <div className="pt-3 border-t border-emerald-700/50 flex items-center space-x-2 text-xs text-emerald-200">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Pelaksanaan: {mockData.eventDates}</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-emerald-200">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>{[mockData.venueName, mockData.venueAddress].filter(Boolean).join(" · ") || "Lokasi akan diumumkan"}</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-emerald-200">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>{mockData.institutionName}</span>
          </div>
          <div className={`border-t pt-3 text-sm font-bold ${deadlineExpired ? "border-rose-400/40 text-rose-200" : "border-emerald-700/50 text-emerald-100"}`}>
            Batas konfirmasi: {mockData.responseDeadline ? new Date(mockData.responseDeadline).toLocaleString("id-ID") : "Tidak dibatasi"}
            {deadlineExpired && " · Telah berakhir, hubungi panitia"}
          </div>
          </div>
        </header>

        <nav aria-label="Progres konfirmasi undangan" className="invitation-progress">
          {[
            ["1", "Verifikasi", emailVerified || isSubmittedFinal],
            ["2", "Respons & delegasi", isSubmittedFinal],
            ["3", "Konfirmasi", isSubmittedFinal],
          ].map(([number, label, completed], index) => {
            const active = (!emailVerified && index === 0) || (emailVerified && !isSubmittedFinal && index === 1) || (isSubmittedFinal && index === 2);
            return (
              <div key={String(number)} className={active ? "is-active" : completed ? "is-complete" : ""} aria-current={active ? "step" : undefined}>
                <span>{completed ? "✓" : number}</span>
                <strong>{String(label)}</strong>
              </div>
            );
          })}
        </nav>

        {/* STEP 1: Email Verification Modal/Section */}
        {!emailVerified && (
          <form onSubmit={handleVerifyEmail} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 border-b pb-3 text-slate-900 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>Langkah 1: Verifikasi Keamanan Email Perwakilan</span>
            </div>
            <p className="text-xs text-slate-600">
              Demi keamanan data, silakan konfirmasikan email resmi perwakilan lembaga <strong>({mockData.institutionName})</strong>:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Perwakilan Lembaga</label>
                <input
                  type="email"
                  value={repEmail}
                  onChange={(e) => setRepEmail(e.target.value)}
                  placeholder="kontak@mahadsunnah.or.id"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kode OTP Verifikasi (Gunakan: 123456)</label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="123456"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-mono tracking-wider"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={deadlineExpired}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow transition min-h-[44px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Verifikasi & Buka Formulir
            </button>
          </form>
        )}

        {/* STEP 2: Main Response Form */}
        {emailVerified && !isSubmittedFinal && (
          <form onSubmit={handleFinalSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-center justify-between">
              <span className="font-bold">✓ Terverifikasi: {mockData.institutionName}</span>
              <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-mono font-bold">
                Sisa Kuota: {remainingQuota} dari {mockData.quota}
              </span>
            </div>

            {/* Attendance Status Decision */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">Status Kehadiran Lembaga *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setResponseStatus("ACCEPTED")}
                  className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-2 min-h-[44px] ${
                    responseStatus === "ACCEPTED"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Hadir (Mengirim Delegasi)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResponseStatus("DECLINED")}
                  className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center space-x-2 min-h-[44px] ${
                    responseStatus === "DECLINED"
                      ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span>Batal / Tidak Dapat Hadir</span>
                </button>
              </div>
            </div>

            {/* Delegates Input Section */}
            {responseStatus === "ACCEPTED" && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Pendataan Delegasi Ustadz ({delegates.length} dari {mockData.quota})
                    </h3>
                    <p className="text-[11px] text-slate-500">Tentukan Ketua Rombongan utusan lembaga.</p>
                  </div>
                  {delegates.length < mockData.quota && (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowSearchModal(true)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-800 hover:bg-blue-100 text-xs font-bold rounded-lg flex items-center space-x-1 min-h-[44px]"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Cari Profil Eksisting</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddDelegate()}
                        className="px-3 py-1.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-xs font-bold rounded-lg flex items-center space-x-1 min-h-[44px]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Baru</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {delegates.map((d, index) => (
                    <div key={index} className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-emerald-800">Delegasi #{index + 1}</span>
                          {d.existingProfileId && (
                            <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                              Profil Eksisting
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-3">
                          <label className="flex items-center space-x-1 text-xs cursor-pointer">
                            <input
                              type="radio"
                              name="delegationLead"
                              checked={d.isLead}
                              onChange={() => handleSetLead(index)}
                              className="text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="font-semibold text-slate-700 text-[11px]">Ketua Rombongan</span>
                          </label>

                          {delegates.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDelegate(index)}
                              className="text-rose-600 hover:text-rose-800 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-700">Nama lengkap Ustadz *</label>
                          <input
                            type="text"
                            required
                            value={d.fullName}
                            onChange={(e) => {
                              setDelegates((current) => current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, fullName: e.target.value } : item
                              ));
                            }}
                            placeholder="Contoh: Ustadz Abdullah, Lc."
                            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline outline-2 outline-transparent focus-visible:outline-emerald-700"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-700">Nomor telepon</label>
                          <input
                            type="tel"
                            value={d.phone}
                            onChange={(e) => {
                              setDelegates((current) => current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, phone: e.target.value } : item
                              ));
                            }}
                            placeholder="081234567890"
                            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline outline-2 outline-transparent focus-visible:outline-emerald-700"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-700">Nomor WhatsApp *</label>
                          <input
                            type="tel"
                            required
                            value={d.whatsapp}
                            onChange={(e) => {
                              setDelegates((current) => current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, whatsapp: e.target.value } : item
                              ));
                            }}
                            placeholder="081234567890"
                            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline outline-2 outline-transparent focus-visible:outline-emerald-700"
                          />
                          <p className="mt-1 text-sm leading-5 text-slate-500">Dipakai panitia untuk informasi operasional peserta.</p>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-semibold text-slate-700">Alamat email</label>
                          <input
                            type="email"
                            value={d.email}
                            onChange={(e) => {
                              setDelegates((current) => current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, email: e.target.value } : item
                              ));
                            }}
                            placeholder="ustadz@lembaga.or.id"
                            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline outline-2 outline-transparent focus-visible:outline-emerald-700"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-sm font-semibold text-slate-700">Alamat domisili</label>
                          <textarea
                            value={d.address}
                            onChange={(e) => {
                              setDelegates((current) => current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, address: e.target.value } : item
                              ));
                            }}
                            rows={3}
                            maxLength={500}
                            placeholder="Nama jalan, kecamatan, kota/kabupaten, provinsi"
                            className="min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline outline-2 outline-transparent focus-visible:outline-emerald-700"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes Input */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan untuk Panitia</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan estimasi kedatangan, kebutuhan khusus, atau pesan..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => void handleSaveDraft()}
                disabled={isSaving || deadlineExpired}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center space-x-1.5 min-h-[44px]"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Draft</span>
              </button>
              <button
                type="submit"
                disabled={isSaving || deadlineExpired}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow flex items-center space-x-1.5 min-h-[44px]"
              >
                <Send className="w-4 h-4" />
                <span>{isSaving ? "Menyimpan…" : "Kirim Konfirmasi Final"}</span>
              </button>
            </div>
          </form>
        )}

        {/* Search Existing Modal */}
        {showSearchModal && (
          <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-slate-900 border-b pb-2 flex items-center space-x-1.5">
                <Search className="w-4 h-4 text-blue-600" />
                <span>Cari Profil Ustadz Eksisting</span>
              </h3>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik nama atau nomor telepon..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
                {existingUstadzCandidates.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900 block">{c.fullName}</span>
                      <span className="text-[10px] text-slate-500">{c.phone}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddDelegate(c)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded flex items-center space-x-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Pilih</span>
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowSearchModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Final Success State */}
        {isSubmittedFinal && (
          <div className="bg-white border border-emerald-300 rounded-xl p-8 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Konfirmasi Final Berhasil Disimpan!</h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Terima kasih. Respons konfirmasi delegasi untuk <strong>{mockData.institutionName}</strong> telah berhasil dicatat oleh panitia Aman Daurah Asatidz.
            </p>
          </div>
        )}
        </>
        )}
      </div>
    </PublicLayout>
  );
};
