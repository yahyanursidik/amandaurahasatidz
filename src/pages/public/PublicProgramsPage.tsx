import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, MapPin, QrCode, RefreshCw, Search, Users } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { ENV } from "@/config/env";
import { DEFAULT_EVENT_POSTER } from "@/lib/eventPoster";

type Program = {
  slug: string;
  code: string;
  name: string;
  subtitle: string | null;
  posterUrl: string | null;
  posterAlt: string | null;
  startDate: string;
  endDate: string;
  venueName: string | null;
  audienceMode: string;
  status: string;
};

const formatDate = (value: string) => new Intl.DateTimeFormat("id-ID", {
  day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
}).format(new Date(`${value}T00:00:00+07:00`));

const statusText: Record<string, string> = {
  REGISTRATION_OPEN: "Pendaftaran dibuka", PUBLISHED: "Informasi tersedia",
  REGISTRATION_CLOSED: "Pendaftaran ditutup", ONGOING: "Sedang berlangsung", COMPLETED: "Selesai",
};

export const PublicProgramsPage: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`${ENV.API_BASE_URL}/events/public`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(response.status >= 500
          ? "Daftar program sedang tidak tersedia. Coba lagi sebentar atau hubungi panitia."
          : payload.error?.message || "Daftar program tidak dapat dimuat.");
        setPrograms(payload.data || []);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Daftar program tidak dapat dimuat.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const visible = useMemo(() => programs.filter((program) =>
    `${program.name} ${program.code} ${program.venueName || ""}`.toLocaleLowerCase("id-ID")
      .includes(query.trim().toLocaleLowerCase("id-ID"))), [programs, query]);
  const registrationOpen = programs.filter((program) => program.status === "REGISTRATION_OPEN").length;

  return <PublicLayout wide>
    <div className="space-y-14 pb-10 text-slate-900">
      <header className="relative overflow-hidden rounded-3xl bg-slate-950 text-white">
        <img src="/images/event-poster-library-interior.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-emerald-950/60" />
        <div className="relative grid gap-8 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-end lg:px-14">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Aman Daurah Asatidz · Layanan program</p>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight tracking-tight sm:text-5xl">Belajar bersama. Terhubung lebih lama.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-200">Temukan daurah untuk para asatidz, lihat informasi resmi, daftar sesuai jalur yang tersedia, dan simpan akses kehadiran Anda dalam satu portal.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#program-terbaru" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-500 px-5 font-bold text-slate-950 hover:bg-emerald-400">Jelajahi program <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
              <Link to="/login/ustadz" className="inline-flex min-h-12 items-center rounded-xl border border-white/40 px-5 font-bold text-white hover:bg-white/10">Masuk Portal Asatidz</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Panduan singkat</p>
            <ol className="mt-4 space-y-4 text-sm text-slate-100">
              <li className="flex gap-3"><Search className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" /> Pilih program yang sesuai</li>
              <li className="flex gap-3"><ClipboardList className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" /> Ikuti alur pendaftaran</li>
              <li className="flex gap-3"><QrCode className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" /> Akses QR setelah disetujui</li>
            </ol>
          </div>
        </div>
      </header>

      <section id="program-terbaru" aria-labelledby="program-list-title" className="scroll-mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-800">Agenda & pendaftaran</p>
            <h2 id="program-list-title" className="mt-2 text-2xl font-black sm:text-3xl">Program yang tersedia</h2>
            <p className="mt-2 text-sm text-slate-600">Informasi berasal dari program yang telah diterbitkan panitia.{!loading && !error && registrationOpen > 0 ? ` ${registrationOpen} program membuka pendaftaran.` : ""}</p>
          </div>
          {programs.length > 0 && <label className="relative block sm:w-72"><span className="sr-only">Cari nama atau lokasi program</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari program atau lokasi" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700" /></label>}
        </div>
        {loading ? <div role="status" className="mt-6 grid gap-4 sm:grid-cols-2">{[0, 1].map((value) => <div key={value} className="h-72 animate-pulse rounded-2xl bg-slate-200" />)}</div>
          : error ? <div role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6"><p className="text-sm text-amber-950">{error}</p><button type="button" onClick={() => setRefresh((value) => value + 1)} className="mt-4 inline-flex min-h-11 items-center gap-2 font-bold text-emerald-800"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Muat ulang</button></div>
            : visible.length === 0 ? <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center"><CalendarDays className="mx-auto h-8 w-8 text-emerald-800" aria-hidden="true" /><p className="mt-3 font-bold">{query ? "Tidak ada program yang cocok." : "Belum ada program yang dipublikasikan."}</p><p className="mt-1 text-sm text-slate-600">{query ? "Coba kata kunci lain." : "Kunjungi halaman ini lagi untuk melihat agenda terbaru."}</p>{query && <button type="button" onClick={() => setQuery("")} className="mt-3 min-h-11 font-bold text-emerald-800 underline">Hapus pencarian</button>}</div>
              : <div className="mt-6 grid gap-5 sm:grid-cols-2">{visible.map((program) => <article key={program.slug} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                <div className="relative h-48 overflow-hidden bg-slate-200"><img src={program.posterUrl || DEFAULT_EVENT_POSTER} alt={program.posterAlt || `Poster ${program.name}`} className="h-full w-full object-cover" loading="lazy" onError={(event) => { event.currentTarget.src = DEFAULT_EVENT_POSTER; }} /><span className="absolute bottom-3 left-3 rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-900 shadow">{statusText[program.status] || "Informasi program"}</span></div>
                <div className="flex flex-1 flex-col p-5"><p className="text-xs font-black uppercase tracking-wide text-emerald-800">{program.code}</p><h3 className="mt-2 text-xl font-black leading-snug">{program.name}</h3>{program.subtitle && <p className="mt-2 text-sm leading-6 text-slate-600">{program.subtitle}</p>}
                  <div className="mt-4 space-y-2 text-sm text-slate-600"><p className="flex gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" /> {formatDate(program.startDate)}{program.endDate !== program.startDate ? ` – ${formatDate(program.endDate)}` : ""}</p><p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" /> {program.venueName || "Lokasi menyusul"}</p></div>
                  <Link to={`/events/${program.slug}`} className="mt-6 inline-flex min-h-11 items-center gap-2 self-start font-black text-emerald-800 hover:underline">Informasi & pendaftaran <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                </div>
              </article>)}</div>}
      </section>

      <section aria-labelledby="journey-title" className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6 sm:p-9">
        <p className="text-xs font-black uppercase tracking-widest text-emerald-800">Dari pendaftaran hingga kehadiran</p>
        <h2 id="journey-title" className="mt-2 text-2xl font-black">Satu alur, informasi lebih jelas</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { icon: Users, title: "Daftar di halaman program", text: "Buka informasi kegiatan dan isi formulir reguler bila pendaftaran sudah dibuka." },
            { icon: CheckCircle2, title: "Pantau persetujuan", text: "Simpan kode peserta dan lihat perkembangan keikutsertaan lewat Portal Asatidz." },
            { icon: QrCode, title: "Hadir dengan QR pribadi", text: "Setelah disetujui, tunjukkan QR atau kode peserta saat check-in sesuai jadwal." },
          ].map((step, index) => <div key={step.title} className="rounded-2xl bg-white p-5"><span className="text-xs font-black text-emerald-700">0{index + 1}</span><step.icon className="mt-3 h-6 w-6 text-emerald-700" aria-hidden="true" /><h3 className="mt-3 font-black">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p></div>)}
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-3xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-9">
        <div><h2 className="text-xl font-black">Sudah menjadi peserta?</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Masuk untuk memeriksa status, jadwal, dan QR pribadi yang tersedia setelah persetujuan panitia.</p></div>
        <Link to="/login/ustadz" className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-xl bg-emerald-500 px-5 font-black text-slate-950 hover:bg-emerald-400">Buka portal <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </section>
    </div>
  </PublicLayout>;
};
