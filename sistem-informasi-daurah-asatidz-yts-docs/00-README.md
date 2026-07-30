# Dokumentasi Sistem Informasi Daurah Asatidz YTS

## Ringkasan

Repositori dokumentasi ini menjadi sumber acuan produk dan pengembangan **Sistem Informasi Daurah Asatidz Yayasan Tarbiyah Sunnah (YTS)**.

Sistem dirancang untuk mengelola:

- Multi-event atau multi-daurah.
- Undangan per lembaga dan per individu.
- Profil asatidz dan afiliasi lembaga.
- Pendaftaran ulang melalui tautan unik.
- Konfirmasi peserta.
- Jadwal kegiatan dan pengumuman.
- Email undangan, konfirmasi, reminder, dan ucapan terima kasih.
- Check-in menggunakan QR dan kode.
- Absensi per hari dan per sesi.
- Pelaporan kehadiran.
- Tiga portal: Admin, Panitia, dan Ustadz.

## Sasaran Utama

1. Menjadikan data asatidz dan lembaga sebagai master data berkelanjutan.
2. Menghilangkan pencatatan berulang untuk setiap daurah.
3. Memisahkan data undangan, konfirmasi, persetujuan, dan kehadiran.
4. Memudahkan panitia bekerja sebelum, saat, dan setelah daurah.
5. Menjadi fondasi CRM jejaring asatidz dan lembaga YTS.

## Stack Utama

- React + TypeScript.
- Vite.
- `@refinedev/core@5.0.12`.
- shadcn/ui.
- BeUI dan Hallmark sebagai sumber pola visual/komponen terpilih.
- Tailwind CSS.
- Neon PostgreSQL.
- Drizzle ORM.
- Netlify.
- Netlify Functions.
- Penyedia autentikasi berbasis PostgreSQL.
- Penyedia transactional email.
- Object storage S3-compatible.

> Nama paket, repository, lisensi, dan kompatibilitas BeUI serta Hallmark wajib diverifikasi dan dicatat di `02-STACK.md` sebelum dependensi dipasang.

## Daftar Dokumen

| File | Tujuan |
|---|---|
| `01-PRD.md` | Kebutuhan produk dan proses bisnis |
| `02-STACK.md` | Keputusan teknologi dan aturan dependensi |
| `03-SYSTEM_ARCHITECTURE.md` | Arsitektur aplikasi dan batas layanan |
| `04-DATABASE_SCHEMA.md` | Entitas, relasi, constraint, dan indeks |
| `05-RBAC_ACCESS_CONTROL.md` | Role, permission, dan event scope |
| `06-API_SPEC.md` | Konvensi serta rancangan endpoint API |
| `07-EMAIL_AUTOMATION.md` | Email, reminder, queue, dan webhook |
| `08-CHECKIN_ATTENDANCE.md` | QR, kode, check-in, dan absensi |
| `09-UI_UX_GUIDE.md` | Navigasi dan standar pengalaman pengguna |
| `10-SECURITY_PRIVACY.md` | Keamanan, privasi, audit, dan retensi |
| `11-ROADMAP.md` | Tahapan implementasi |
| `12-ACCEPTANCE_CRITERIA.md` | Kriteria penerimaan fitur |
| `13-DEPLOYMENT_OPERATIONS.md` | Environment, deployment, dan operasional |
| `14-AGENTS.md` | Aturan untuk coding agent |
| `15-PROMPT_LOG.md` | Log instruksi yang diberikan kepada AI |
| `16-DECISION_LOG.md` | Catatan keputusan arsitektur dan produk |
| `17-TEST_PLAN.md` | Strategi pengujian |
| `18-SEED_DATA.md` | Data awal untuk development dan demo |
| `ALL-IN-ONE.md` | Gabungan seluruh dokumen |

## Urutan Baca untuk Developer

1. `01-PRD.md`
2. `03-SYSTEM_ARCHITECTURE.md`
3. `04-DATABASE_SCHEMA.md`
4. `05-RBAC_ACCESS_CONTROL.md`
5. `06-API_SPEC.md`
6. Dokumen modul terkait pekerjaan yang sedang dikerjakan.
7. `12-ACCEPTANCE_CRITERIA.md`
8. `17-TEST_PLAN.md`

## Urutan Implementasi Singkat

1. Bootstrap proyek dan design system.
2. Database, migration, authentication, RBAC, dan audit log.
3. Master data lembaga serta asatidz.
4. Event, hari, sesi, dan kepanitiaan.
5. Undangan lembaga dan individu.
6. Pendaftaran ulang, konfirmasi, dan persetujuan.
7. Email serta reminder.
8. Check-in dan absensi.
9. Dashboard, laporan, ekspor, dan stabilisasi.

## Prinsip Produk

> Bangun sederhana untuk daurah pertama, tetapi jangan membuat struktur data yang hanya dapat dipakai satu kali.

## Status Dokumen

- Versi: `0.1.0`
- Status: Draft implementasi awal
- Tanggal penyusunan: 30 Juli 2026
- Pemilik produk: Yayasan Tarbiyah Sunnah
