import React from "react";
import { Link } from "react-router-dom";
import { AppFooter } from "@/components/common/AppFooter";

interface PublicLayoutProps {
  children: React.ReactNode;
  wide?: boolean;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children, wide = false }) => {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      <header className="bg-white border-b border-slate-200 py-4 shadow-sm">
        <div className={`${wide ? "max-w-6xl" : "max-w-4xl"} mx-auto px-4 flex items-center justify-between gap-3`}>
          <Link to="/programs" className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" aria-label="Tarbiyah Sunnah — daftar program Daurah Asatidz">
            <img src="/images/tarbiyah-sunnah-logo.svg" alt="Tarbiyah Sunnah" width="148" height="42" className="h-10 w-auto max-w-[130px] shrink-0 object-contain sm:max-w-[148px]" />
            <span className="hidden border-l border-slate-200 pl-2 text-xs font-bold leading-tight text-slate-700 sm:inline">Daurah<br />Asatidz</span>
          </Link>
          <nav aria-label="Navigasi publik" className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Link to="/programs" className="text-xs font-bold text-slate-700 hover:text-emerald-800">Program</Link>
            <Link to="/login/ustadz" className="rounded bg-emerald-800 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" aria-label="Masuk ke Portal Asatidz">Masuk portal</Link>
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
