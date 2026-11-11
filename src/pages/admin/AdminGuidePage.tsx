import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpenCheck, CircleHelp, ExternalLink } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import "./AdminGuidePage.css";

type GuideAction = {
  label: string;
  to: string;
  eventScoped?: boolean;
};

type GuideStage = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  steps: string[];
  actions: GuideAction[];
};

export const ADMIN_GUIDE_STAGES: GuideStage[] = [
  {
    id: "draft",
    title: "Buat draft dan konfigurasi",
    shortTitle: "Buat draft",
    description: "Tentukan bentuk daurah sebelum membuka akses peserta.",
    steps: [
      "Isi identitas, slug halaman publik, poster, tanggal, zona waktu, lokasi, dan kontak acara.",
      "Pilih jalur reguler, undangan, atau campuran; atur kapasitas dan kuota masing-masing jalur.",
      "Tentukan presensi harian, per sesi, atau keduanya, lalu atur tenggat dan aturan konfirmasi. Simpan sebagai draft.",
    ],
    actions: [
      { label: "Buat event", to: "/admin/events/create" },
      { label: "Buka konfigurasi", to: "/admin/events/create#configuration" },
    ],
  },
  {
    id: "schedule",
    title: "Susun hari aktif, sesi, dan tim",
    shortTitle: "Jadwal & tim",
    description: "Jadwal menentukan unit absensi yang harus dipenuhi peserta.",
    steps: [
      "Tambahkan hanya tanggal kegiatan yang aktif. Hari jeda di antara dua tanggal acara tidak dihitung sebagai absensi.",
      "Buat sesi/rundown serta jendela check-in pada hari atau sesi yang akan dipresensi.",
      "Siapkan akun panitia, lalu berikan penugasan dan hak akses pada event yang tepat.",
    ],
    actions: [
      { label: "Jadwal & sesi", to: "/schedule", eventScoped: true },
      { label: "Tim event", to: "/team", eventScoped: true },
      { label: "Akun panitia", to: "/admin/committee" },
    ],
  },
  {
    id: "publish",
    title: "Terbitkan dan buka pendaftaran",
    shortTitle: "Terbitkan",
    description: "Periksa kesiapan sebelum tautan publik dibagikan.",
    steps: [
      "Periksa ringkasan kesiapan pada ikhtisar event, termasuk poster, jadwal, dan panitia.",
      "Terbitkan event, lalu buka pendaftaran sesuai waktu dan jalur yang telah dipilih.",
      "Uji halaman publik dan formulir reguler dari tombol Halaman publik pada event yang sudah terbit.",
    ],
    actions: [
      { label: "Ikhtisar event", to: "", eventScoped: true },
      { label: "Daftar event", to: "/admin/events" },
    ],
  },
  {
    id: "registration",
    title: "Kelola undangan dan peserta",
    shortTitle: "Pendaftaran",
    description: "Pilih pengisian rombongan sekali atau mandiri per asatidz dalam kuota lembaga.",
    steps: [
      "Buat tautan unik per lembaga. Pilih perwakilan yang mengisi sekali atau asatidz yang mengisi masing-masing sampai kuota penuh; bagikan tautan melalui WhatsApp atau email.",
      "Pantau jumlah pendaftar per undangan. Pada pola mandiri, setiap asatidz menerima QR dan akses portal sendiri; admin tetap meninjau persetujuannya. Peserta reguler dapat mendaftar lewat formulir publik atau diimpor admin.",
      "Setujui peserta, lalu kirim tautan konfirmasi pribadi dari tombol Bagikan akses. Setiap asatidz—termasuk anggota rombongan—memilih hadir atau berhalangan tanpa login; QR aktif setelah konfirmasi bila diwajibkan.",
    ],
    actions: [
      { label: "Undangan", to: "/registrations?view=invitations", eventScoped: true },
      { label: "Peserta", to: "/registrations?view=participants", eventScoped: true },
      { label: "Belum konfirmasi", to: "/registrations?view=participants&status=AWAITING_CONFIRMATION", eventScoped: true },
      { label: "Data lembaga", to: "/admin/institutions" },
    ],
  },
  {
    id: "communication",
    title: "Sampaikan informasi acara",
    shortTitle: "Komunikasi",
    description: "Gunakan kanal yang sesuai tanpa mengirim ulang pesan yang sama.",
    steps: [
      "Di Komunikasi Event, pilih sasaran dan periksa isi pengumuman sebelum diterbitkan.",
      "Untuk pesan lintas event, gunakan BC email dan pantau antrean atau email gagal.",
      "Untuk WhatsApp massal, siapkan template lalu buka wa.me satu per satu melalui wizard bertahap; sistem tidak mengirim otomatis.",
    ],
    actions: [
      { label: "Komunikasi event", to: "/communications", eventScoped: true },
      { label: "BC email", to: "/admin/broadcast" },
      { label: "WhatsApp bertahap", to: "/admin/ustadz/whatsapp" },
    ],
  },
  {
    id: "attendance",
    title: "Jalankan absensi pada hari acara",
    shortTitle: "Absensi QR",
    description: "Pilih unit yang benar, lalu catat kehadiran tiap orang.",
    steps: [
      "Di Kiosk QR, buat tautan aktivasi satu kali untuk perangkat di lokasi. Buka pada perangkat tersebut sebelum acara; aksesnya bisa dicabut.",
      "Pada perangkat kiosk, pilih hari atau sesi yang sedang dibuka lalu pindai QR pribadi setiap peserta. Kiosk tidak menampilkan daftar peserta atau menerima kode manual.",
      "Jika QR tidak dapat dipakai, panitia yang login dapat memasukkan kode atau melakukan koreksi. Admin memantau matriks kehadiran harian dan sesi.",
    ],
    actions: [
      { label: "Perangkat kiosk", to: "/kiosk", eventScoped: true },
      { label: "Rekap kehadiran", to: "/attendance", eventScoped: true },
    ],
  },
  {
    id: "reports",
    title: "Tutup acara dan tinjau riwayat",
    shortTitle: "Laporan",
    description: "Data undangan, presensi, dan profil tetap terhubung setelah acara.",
    steps: [
      "Setelah semua presensi selesai, ubah status event menjadi Selesai dari ikhtisar.",
      "Tinjau atau ekspor respons undangan, peserta per lembaga, kehadiran harian/per sesi, tidak hadir, dan peserta berulang.",
      "Buka profil asatidz untuk riwayat lintas event dan lembaga. Gunakan jejak audit bila perlu menelusuri perubahan.",
    ],
    actions: [
      { label: "Laporan event", to: "/reports", eventScoped: true },
      { label: "Riwayat asatidz", to: "/admin/ustadz?participation=attended" },
      { label: "Jejak audit", to: "/admin/audit-logs" },
    ],
  },
];

const supportingLinks = [
  { label: "Data lembaga", detail: "Lengkapi kontak → undang ke event → pantau delegasi.", to: "/admin/institutions" },
  { label: "Data asatidz", detail: "Tinjau profil → rapikan duplikat → lihat riwayat hadir.", to: "/admin/ustadz" },
  { label: "Panitia & akses", detail: "Buat akun → beri peran → tugaskan ke event.", to: "/admin/committee" },
  { label: "Ruang Asatidz", detail: "Baca masukan → tindak lanjuti → terbitkan sapaan.", to: "/admin/ruang-asatidz" },
  { label: "Peta Ukhuwah", detail: "Kelola lokasi → buat laporan → tindak lanjuti.", to: "/admin/peta-ukhuwah" },
  { label: "Antrean email", detail: "Periksa pengiriman → tangani email gagal.", to: "/admin/email-jobs" },
];

const validEventId = (value: string | null): value is string =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

export const resolveGuideAction = (action: GuideAction, eventId: string | null): string =>
  action.eventScoped && validEventId(eventId) ? `/admin/events/${eventId}${action.to}` : action.eventScoped ? "/admin/events" : action.to;

export const AdminGuidePage: React.FC = () => {
  const [params] = useSearchParams();
  const eventId = validEventId(params.get("eventId")) ? params.get("eventId") : null;

  return <AdminLayout>
    <PageHeader
      title="Panduan kerja admin"
      description="Ikuti alur dari draft event sampai laporan; buka fitur yang dibutuhkan pada setiap tahap."
      breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Panduan kerja" }]}
      actions={<Link to="/admin/events/create" className="admin-guide-create"><BookOpenCheck aria-hidden="true" size={18} /> Buat event</Link>}
    />

    <div className="admin-guide">
      <nav className="admin-guide-rail" aria-label="Isi panduan">
        <p className="admin-guide-rail__title">Dalam panduan</p>
        <a href="#alur-event">Alur event</a>
        <a href="#data-pendukung">Data</a>
        <a href="#kendala-umum">Bantuan</a>
      </nav>

      <div className="admin-guide-main">
        <section id="alur-event" className="admin-guide-intro" aria-labelledby="guide-intro-title">
          <div>
            <h2 id="guide-intro-title">Dari draft ke laporan.</h2>
          </div>
          <div className="admin-guide-context" role="note">
            <strong>{eventId ? "Konteks event aktif" : "Belum memilih event"}</strong>
            <span>{eventId ? "Tautan tahap membuka menu event ini." : "Pilih event saat membuka menu khusus event."}</span>
          </div>
        </section>

        <nav className="admin-guide-map" aria-label="Lompat ke tahap alur event">
          {ADMIN_GUIDE_STAGES.map((stage, index) => <a href={`#${stage.id}`} key={stage.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{stage.shortTitle}</strong>
            <ArrowRight aria-hidden="true" size={16} />
          </a>)}
        </nav>

        <ol className="admin-guide-stages" aria-label="Langkah kerja event">
          {ADMIN_GUIDE_STAGES.map((stage, index) => <li id={stage.id} className="admin-guide-stage" key={stage.id}>
            <span className="admin-guide-stage__number" aria-hidden="true">{index + 1}</span>
            <div className="admin-guide-stage__body">
              <h3>{stage.title}</h3>
              <p className="admin-guide-stage__description">{stage.description}</p>
              <ul>{stage.steps.map((step) => <li key={step}>{step}</li>)}</ul>
              <div className="admin-guide-stage__actions">
                {stage.actions.map((action) => <Link key={`${stage.id}-${action.label}`} to={resolveGuideAction(action, eventId)}>
                  {action.eventScoped && !eventId ? `Pilih event · ${action.label}` : action.label}
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>)}
              </div>
            </div>
          </li>)}
        </ol>

        <section id="data-pendukung" className="admin-guide-support" aria-labelledby="guide-support-title">
          <div className="admin-guide-section-head"><h2 id="guide-support-title">Data pendukung</h2><p>Menu yang menjaga alur event tetap rapi.</p></div>
          <div className="admin-guide-support__links">
            {supportingLinks.map((item) => <div className="admin-guide-support__item" key={item.to}>
              <Link to={item.to}><strong>{item.label}</strong><ArrowRight aria-hidden="true" size={18} /></Link>
              <p>{item.detail}</p>
            </div>)}
          </div>
        </section>

        <section id="kendala-umum" className="admin-guide-help" aria-labelledby="guide-help-title">
          <div className="admin-guide-section-head"><h2 id="guide-help-title">Jika ada kendala</h2><p>Periksa tiga hal ini sebelum mengulang proses.</p></div>
          <details><summary><CircleHelp aria-hidden="true" size={18} /> Undangan tidak terbuka</summary><p>Pastikan event sudah terbit, jalur undangan aktif, lembaga dan tenggat benar, lalu buat tautan dari menu Pendaftaran → Undangan. Tautan lama dapat dibuat ulang bila perlu.</p></details>
          <details><summary><CircleHelp aria-hidden="true" size={18} /> QR tidak tercatat</summary><p>Periksa status persetujuan peserta, syarat konfirmasi hadir, hari atau sesi yang dipilih, dan jam check-in. Untuk kode manual atau koreksi, gunakan portal panitia yang sudah login.</p></details>
          <details><summary><CircleHelp aria-hidden="true" size={18} /> Kiosk perlu aktivasi</summary><p>Periksa status perangkat di menu Kiosk QR. Jika akses dicabut atau kedaluwarsa, buat tautan aktivasi baru dan buka sekali pada perangkat yang dipakai di lokasi.</p></details>
        </section>

        <footer className="admin-guide-footer">
          <span>Panduan ini mengikuti menu yang tersedia di Portal Admin.</span>
          <Link to="/admin/events">Buka daftar event <ExternalLink aria-hidden="true" size={15} /></Link>
        </footer>
      </div>
    </div>
  </AdminLayout>;
};
