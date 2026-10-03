import React from "react";
import { HeartHandshake } from "lucide-react";

/** Greeting is intentionally limited to HOME; React escapes profile names as text. */
export const PortalGreeting: React.FC<{ fullName: string; activeTab: string }> = ({ fullName, activeTab }) => {
  if (activeTab !== "HOME") return null;
  const name = fullName.trim() || "Bapak/Ibu Asatidz";
  return <section aria-labelledby="portal-greeting-title" className="mb-6 flex min-w-0 items-start gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
    <HeartHandshake aria-hidden="true" className="mt-1 h-7 w-7 shrink-0 text-emerald-800" />
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Selamat datang di Portal Asatidz</p>
      <h2 id="portal-greeting-title" className="mt-2 text-xl font-black leading-snug text-emerald-950 [overflow-wrap:anywhere] sm:text-2xl">Assalamu’alaikum, {name}.</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">Senang dapat menyambut Anda kembali. Semoga Allah memberkahi ilmu, amal, dan langkah dakwah Anda. Mari siapkan kegiatan daurah dan terus terhubung bersama keluarga besar Tarbiyah Sunnah.</p>
    </div>
  </section>;
};