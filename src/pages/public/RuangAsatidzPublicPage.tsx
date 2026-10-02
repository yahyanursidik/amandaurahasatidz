import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, HandHeart, HeartHandshake, Lightbulb, LockKeyhole, MessageCircle } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";

const ROOT = "/portal/ruang-asatidz";
const primary = "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
const secondary = "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

const pathways = [
  { path: "/saran", icon: Lightbulb, title: "Sampaikan saran", description: "Masukan Anda membantu YTS meninjau program dan pelayanan yang lebih baik." },
  { path: "/pengalaman", icon: BookOpen, title: "Ceritakan pengalaman", description: "Bagikan pelajaran atau tantangan mengajar dan dakwah. Cerita Anda pribadi secara default." },
  { path: "/kebutuhan", icon: HandHeart, title: "Ajukan kebutuhan", description: "Sampaikan kebutuhan materi, pendampingan, atau dukungan beserta konteksnya untuk ditinjau YTS." },
  { path: "/pesan", icon: MessageCircle, title: "Mulai percakapan", description: "Ajukan pertanyaan, baca pesan Anda, dan lihat balasan serta status tindak lanjut dari tim YTS." },
];

/** Public introduction only. Never load private threads or account-only stories here. */
export function RuangAsatidzPublicPage() {
  return <PublicLayout wide>
    <div className="space-y-10 pb-8 text-slate-900 sm:space-y-14">
      <header className="overflow-hidden rounded-3xl border border-emerald-100 bg-emerald-50 p-6 sm:p-10 lg:p-12">
        <p className="text-sm font-bold text-emerald-800">Yayasan Tarbiyah Sunnah · Bersama para asatidz</p>
        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
          <div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Ruang Asatidz</h1>
            <p className="mt-4 text-xl font-bold text-emerald-900 sm:text-2xl">Disapa. Didengar. Terhubung.</p>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700">Assalamu’alaikum, Asatidz. Di tengah kesibukan mengajar dan berdakwah, ada ruang untuk suara, cerita, dan kebutuhan Anda. Mari tetap terhubung dengan YTS, tidak hanya saat daurah berlangsung.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={ROOT} className={primary}>Buka Ruang Asatidz <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /></Link>
              <a href="#pilihan-ruang" className={secondary}>Lihat pilihan ruang</a>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Halaman pengenalan ini terbuka untuk umum. Masuk dengan akun asatidz untuk menggunakan ruang pribadi; tidak perlu menunggu persetujuan peserta pada suatu event.</p>
          </div>
          <aside className="rounded-2xl border border-emerald-200 bg-white p-6" aria-label="Ruang pribadi Anda">
            <HeartHandshake className="h-9 w-9 text-emerald-700" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-bold">Terhubung lebih lama</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">Satu akun untuk percakapan dengan YTS. Pesan tidak terikat pada satu kegiatan dan riwayatnya dapat dibaca kembali di portal.</p>
            <Link to={`${ROOT}/pesan`} className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-emerald-800 underline underline-offset-4">Lihat pesan saya <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </aside>
        </div>
      </header>

      <section aria-labelledby="pillars-title">
        <h2 id="pillars-title" className="text-2xl font-black">Ruang untuk saling menguatkan</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            { title: "Disapa", text: "Baca sapaan dan kabar YTS di dalam portal. Hubungan baik tidak harus menunggu kegiatan berikutnya.", path: "", label: "Baca sapaan di portal" },
            { title: "Didengar", text: "Sampaikan saran, pertanyaan, dan kebutuhan melalui percakapan pribadi dengan tim YTS.", path: "/saran", label: "Sampaikan suara Anda" },
            { title: "Terhubung", text: "Baca pengalaman bersama di portal. Cerita hanya tampil setelah izin penulis dan moderasi YTS.", path: "/terhubung", label: "Lihat cerita di portal" },
          ].map((pillar) => <article key={pillar.title} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="text-xl font-bold text-emerald-900">{pillar.title}</h3>
            <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{pillar.text}</p>
            <Link to={`${ROOT}${pillar.path}`} className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-emerald-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">{pillar.label} <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /></Link>
          </article>)}
        </div>
      </section>

      <section id="pilihan-ruang" aria-labelledby="pathways-title" className="scroll-mt-6">
        <h2 id="pathways-title" className="text-2xl font-black">Apa yang ingin Anda sampaikan?</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">Pilih ruang yang sesuai. Jika belum masuk, Anda diarahkan ke login Portal Asatidz, lalu kembali ke pilihan Anda.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {pathways.map((item) => <article key={item.path} className="rounded-2xl border border-slate-200 bg-white p-6">
            <item.icon className="h-7 w-7 text-emerald-700" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
            <Link to={`${ROOT}${item.path}`} className={`${secondary} mt-5`}>{item.title} <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /></Link>
          </article>)}
        </div>
      </section>

      <section aria-labelledby="privacy-title" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex items-start gap-3"><LockKeyhole className="mt-1 h-6 w-6 shrink-0 text-emerald-700" aria-hidden="true" /><h2 id="privacy-title" className="text-xl font-bold">Pribadi secara default</h2></div>
        <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-7 text-slate-600">
          <li>Pesan dan balasan hanya tersedia bagi pemilik akun dan pengelola YTS yang berwenang. Tidak ditampilkan di halaman publik ini.</li>
          <li>Pengalaman hanya dibagikan di papan portal setelah persetujuan penulis dan moderasi, termasuk nama penulis. Balasan percakapan tetap pribadi.</li>
          <li>Ruang ini bukan kanal darurat. Jangan mengirim data sensitif atau informasi pribadi pihak lain yang tidak perlu.</li>
          <li>YTS meninjau pesan sesuai kapasitas layanan. Tidak ada janji waktu respons atau jaminan pemenuhan kebutuhan.</li>
        </ul>
      </section>

      <section aria-labelledby="start-title" className="rounded-3xl bg-slate-900 p-6 text-white sm:p-9">
        <h2 id="start-title" className="text-2xl font-black">Mari mulai dari percakapan</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Sudah memiliki akun asatidz? Buka ruang pribadi Anda. Jika akun sudah terdaftar tetapi belum memiliki password, gunakan aktivasi akun pada halaman masuk. Jika belum terdaftar, lihat jalur pendaftaran yang tersedia di halaman program.</p>
        <div className="mt-6 flex flex-wrap gap-3"><Link to={ROOT} className={secondary}>Masuk ke ruang pribadi <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link><Link to="/programs" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-500 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Lihat program daurah</Link></div>
      </section>
    </div>
  </PublicLayout>;
}