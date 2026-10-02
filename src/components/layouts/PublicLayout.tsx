import React from "react";
import { Link, NavLink } from "react-router-dom";
import { AppFooter } from "@/components/common/AppFooter";

interface PublicLayoutProps {
  children: React.ReactNode;
  wide?: boolean;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children, wide = false }) => {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      <header className="bg-white border-b border-slate-200 py-4 shadow-sm">
        <div className={`${wide ? "max-w-6xl" : "max-w-4xl"} mx-auto px-4 flex flex-wrap items-center justify-between gap-3`}>
          <Link to="/programs" className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" aria-label="Tarbiyah Sunnah — daftar program Daurah Asatidz">
            <img src="/images/tarbiyah-sunnah-logo.svg" alt="Tarbiyah Sunnah" width="148" height="42" className="h-10 w-auto max-w-[130px] shrink-0 object-contain sm:max-w-[148px]" />
            <span className="hidden border-l border-slate-200 pl-2 text-xs font-bold leading-tight text-slate-700 sm:inline">Daurah<br />Asatidz</span>
          </Link>
          <nav aria-label="Navigasi publik" className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-4">
            <NavLink to="/programs" className={({ isActive }) => `inline-flex min-h-[44px] items-center rounded px-1 text-sm font-bold hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 ${isActive ? "text-emerald-800 underline underline-offset-4" : "text-slate-700"}`}>Program</NavLink>
            <NavLink to="/ruang-asatidz" className={({ isActive }) => `inline-flex min-h-[44px] items-center rounded px-1 text-sm font-bold hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 ${isActive ? "text-emerald-800 underline underline-offset-4" : "text-slate-700"}`}>Ruang Asatidz</NavLink>
            <Link to="/login/ustadz" className="inline-flex min-h-[44px] items-center rounded bg-emerald-800 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" aria-label="Masuk ke Portal Asatidz">Masuk portal</Link>
          </nav>
        </div>
      </header>

      <main className={`flex-1 ${wide ? "max-w-6xl" : "max-w-4xl"} w-full mx-auto p-4 sm:p-6 my-auto`}>
        {children}
      </main>

      <AppFooter className="flex flex-col items-center justify-center gap-1 border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500 sm:flex-row sm:gap-2" />
    </div>
  );
};
