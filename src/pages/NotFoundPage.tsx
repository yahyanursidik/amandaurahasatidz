import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  const location = useLocation();
  const home = location.pathname.startsWith("/committee")
    ? "/committee"
    : location.pathname.startsWith("/portal")
      ? "/portal"
      : "/admin";

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-slate-100 p-5">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-700">
          <Compass className="h-6 w-6" />
        </div>
        <p className="mt-5 font-mono text-xs font-black text-emerald-700">404 · HALAMAN TIDAK DITEMUKAN</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">Jalur ini belum tersedia.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Periksa kembali alamat halaman atau kembali ke beranda portal Anda.
        </p>
        <Link
          to={home}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
};
