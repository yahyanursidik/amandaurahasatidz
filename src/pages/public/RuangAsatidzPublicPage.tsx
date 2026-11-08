import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, HandHeart, Lightbulb, LockKeyhole, MessageCircle } from "lucide-react";
import { PublicLayout } from "@/components/layouts/PublicLayout";

const ROOT = "/portal/ruang-asatidz";

const pathways = [
  { path: "/saran", icon: Lightbulb, title: "Sampaikan saran", description: "Masukan untuk program dan pelayanan YTS." },
  { path: "/pengalaman", icon: BookOpen, title: "Ceritakan pengalaman", description: "Bagikan pelajaran dari mengajar dan berdakwah." },
  { path: "/kebutuhan", icon: HandHeart, title: "Ajukan kebutuhan", description: "Sampaikan kebutuhan materi atau pendampingan." },
  { path: "/pesan", icon: MessageCircle, title: "Lihat pesan saya", description: "Baca balasan dan tindak lanjut dari YTS." },
];

/** Public introduction only. Never load private threads or account-only stories here. */
export function RuangAsatidzPublicPage() {
  return <PublicLayout wide>
    <div className="public-ruang">
      <header className="public-ruang__intro">
        <p className="public-home__identity">Yayasan Tarbiyah Sunnah · Bersama para asatidz</p>
        <h1>Ruang Asatidz</h1>
        <p className="public-ruang__lead">Disapa. Didengar. Terhubung.</p>
        <p>Ruang untuk menyampaikan saran, pengalaman, dan kebutuhan kepada YTS—tetap terhubung setelah daurah selesai.</p>
        <div className="public-ruang__actions"><Link to={ROOT} className="public-home__button public-home__button--primary">Buka ruang pribadi <ArrowRight aria-hidden="true" /></Link><a href="#pilihan-ruang" className="public-home__button public-home__button--quiet">Lihat pilihan ruang</a></div>
        <p className="public-ruang__access">Halaman ini terbuka untuk umum. Jika belum masuk, Anda akan diarahkan ke Portal Asatidz lalu kembali ke pilihan Anda.</p>
      </header>

      <section id="pilihan-ruang" aria-labelledby="pathways-title" className="public-ruang__pathways">
        <div><h2 id="pathways-title">Apa yang ingin Anda lakukan?</h2><p>Satu akun asatidz untuk semua percakapan dan kegiatan Anda.</p></div>
        <div className="public-ruang__path-list">{pathways.map((item) => <article key={item.path} className="public-ruang__path">
          <item.icon aria-hidden="true" /><div><h3>{item.title}</h3><p>{item.description}</p></div>
          <Link to={`${ROOT}${item.path}`} aria-label={`${item.title} di Portal Asatidz`}>Buka <ArrowRight aria-hidden="true" /></Link>
        </article>)}</div>
      </section>

      <section aria-labelledby="connection-title" className="public-ruang__connection">
        <div><h2 id="connection-title">Tetap terhubung</h2><p>Baca sapaan YTS dan pengalaman bersama di portal. Cerita hanya tampil setelah izin penulis dan moderasi.</p></div>
        <div className="public-ruang__connection-links"><Link to={ROOT}>Baca kabar YTS <ArrowRight aria-hidden="true" /></Link><Link to={`${ROOT}/terhubung`}>Lihat cerita bersama <ArrowRight aria-hidden="true" /></Link></div>
      </section>

      <section aria-labelledby="privacy-title" className="public-ruang__privacy">
        <LockKeyhole aria-hidden="true" /><div><h2 id="privacy-title">Pribadi secara default</h2><p>Pesan dan balasan hanya untuk Anda dan pengelola YTS yang berwenang. Tidak ditampilkan di halaman publik ini. Ruang ini bukan kanal darurat; hindari data sensitif yang tidak diperlukan.</p></div>
      </section>

      <section aria-labelledby="start-title" className="public-ruang__next">
        <div><h2 id="start-title">Belum memiliki akun?</h2><p>Lihat riwayat daurah dan informasi kegiatan yang masih dibuka. Sudah terdaftar tetapi belum punya password? Gunakan aktivasi akun di halaman masuk.</p></div>
        <div><Link to="/programs" className="public-home__button public-home__button--quiet">Lihat riwayat daurah</Link><Link to="/login/ustadz" className="public-home__text-link">Masuk Portal Asatidz <ArrowRight aria-hidden="true" /></Link></div>
      </section>
    </div>
  </PublicLayout>;
}
