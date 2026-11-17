# Menjalankan aplikasi lokal

Instalasi ini memakai PostgreSQL 17 di `127.0.0.1:54329`, database
`daurah_local`, dengan data persisten pada `.local/postgres/`. Konfigurasi
koneksi dan password akun demo tersimpan di `.env.local`. Kedua lokasi
diabaikan Git.

Jalankan dari direktori proyek:

```sh
sh scripts/dev-local.sh
```

Perintah tersebut menjalankan database bila belum aktif, lalu aplikasi pada
http://127.0.0.1:3000. Skrip juga mencari runtime Node bawaan Codex jika `node`
belum ada di PATH. Dengan Node dan npm terpasang biasa, gunakan `npm run dev:local`.
Port 3000 harus kosong. Ctrl+C menghentikan aplikasi; database tetap berjalan.

| Portal | Halaman masuk | Email |
| --- | --- | --- |
| Admin | `/login/admin` | `admin@yts.or.id` |
| Panitia | `/login/committee` | `panitia@yts.or.id` |
| Asatidz | `/login/ustadz` | `ustadz.demo@yts.or.id` |

Ketiga akun menggunakan nilai `SEED_DEFAULT_PASSWORD` pada `.env.local`.
Data seed mencakup lembaga, event, jadwal, undangan, peserta dan pengumuman.
Jadwal demo bawaan bertanggal Agustus 2026: sesuaikan jadwal, tenggat dan status
event di portal admin saat mencoba pendaftaran atau presensi pada tanggal lain.

Dengan Node di PATH:

```sh
# Menerapkan seluruh migrasi lokal (termasuk SQL manual setelah 0008).
node scripts/migrate-local.mjs
# Menguji login semua portal, sesi, pembacaan data dan commit/rollback.
node scripts/check-local.mjs
```

Runner migrasi mencatat hash migrasi dan melewati berkas yang sudah diterapkan.
Jangan memakai `npm run db:migrate` untuk database ini: jurnal Drizzle bawaan
hanya mencatat migrasi sampai 0008. Skrip migrasi tambahan per fitur yang memakai
Neon langsung juga bukan runner database lokal.

Menghentikan database:

```sh
sh scripts/local-db.sh stop
```

Driver lokal dipilih hanya jika `DATABASE_DRIVER=postgres`; tanpa pilihan ini
aplikasi tetap memakai driver Neon. Konfigurasi produksi tidak perlu diubah.
Jangan menghapus `.local/postgres/` jika ingin mempertahankan data lokal.

Pengiriman email ke inbox memerlukan konfigurasi Mailketing atau SMTP yang valid.
Worker email dan pengingat otomatis belum diaktifkan. Database lokal tidak
menyediakan layanan pengiriman email. Fitur yang memakai kamera memerlukan izin
kamera dari browser.
