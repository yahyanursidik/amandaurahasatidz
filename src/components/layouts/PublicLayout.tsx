import React from "react";
import { Link } from "react-router-dom";
import { AppFooter } from "@/components/common/AppFooter";

interface PublicLayoutProps {
  children: React.ReactNode;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      <header className="bg-white border-b border-slate-200 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <Link to="/programs" className="flex items-center space-x-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" aria-label="Aman Daurah Asatidz — daftar program">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
              ADA
            </div>
            <span className="font-semibold text-slate-800 text-base">
              Aman Daurah Asatidz
            </span>
          </Link>
          <Link to="/login/ustadz" className="shrink-0 rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" aria-label="Masuk ke Portal Asatidz">Masuk</Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 my-auto">
        {children}
      </main>

      <AppFooter className="flex flex-col items-center justify-center gap-1 border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500 sm:flex-row sm:gap-2" />
    </div>
  );
};
