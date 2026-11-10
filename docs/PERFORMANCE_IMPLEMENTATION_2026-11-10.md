# Implementasi audit performa dan perbaikan bug

Tanggal: 10 November 2026. Baseline kode: `3f16149`; branch kerja: `fix/performance-audit-20261110`.
Temuan awal: [PERFORMANCE_RECHECK_2026-11-10.md](PERFORMANCE_RECHECK_2026-11-10.md).

## Ruang lingkup dan keamanan

- Dokumen ini mencatat hasil tahap implementasi/pengujian pra-rilis; pada akhir tahap tersebut kode belum di-push, di-merge, atau di-deploy. Status rollout berikutnya dicatat pada pull request dan laporan rilis.
- Tidak mengubah kuota undangan, data, schema, permission, atau konfigurasi produksi. `.env` tetap menunjuk ke konfigurasi semula; tidak ditulis ulang.
- SQL baru diuji dengan transaksi **READ ONLY** pada branch QA `br-solitary-tree-azr2uewb`, project `weathered-mode-74673540`.
- Lima indeks tambahan hanya diterapkan pada QA melalui koneksi langsung yang host-nya telah diverifikasi. Fixture QA sebelumnya tidak di-reset/dihapus.
- Tidak memasang ekstensi, menghapus indeks, mereset statistik, atau menaikkan compute. Backend tetap memvalidasi sesi, permission, scope event, kapasitas, dan kuota pada setiap aksi.

## Perbaikan

### Hak akses, request ganda, dan respons terlambat

- Tab peserta admin tidak lagi bergantung pada izin membaca/membuat undangan atau master lembaga. `REPORT_VIEWER` membaca peserta dan pengaturan registrasi saja.
- Kontrol impor, persetujuan, perubahan status, ekspor, dan pembuatan/reset akun portal mengikuti permission masing-masing. Kontrol panitia juga memeriksa status konfirmasi peserta.
- Efek pemuatan daftar dimulai dalam microtask agar efek pertama yang dibuang oleh React StrictMode tidak membuat request nyata.
- Request lama dibatalkan atau hasilnya ditolak jika komponen, event, halaman, atau filter berubah. Pembacaan cakupan seleksi/ekspor lama tidak boleh menimpa konteks baru.
- Pemeriksaan sesi/identitas/permission berbagi request yang sedang berlangsung. Hasil sukses hanya disimpan di memori browser selama lima detik; tidak disimpan ke localStorage. Login, logout, fokus jendela, perubahan storage, dan kegagalan verifikasi menginvalidasi cache. Respons sesi lama yang selesai setelah invalidasi ditolak.

### Peserta, pilihan lintas halaman, dan riwayat

- `GET /events/:id/participants?page=1&pageSize=25` menerima filter pencarian, status, kontak, lembaga/undangan, serta pengurutan stabil. Maksimal 100 baris/request.
- Metadata mencakup jumlah hasil filter, jumlah kandidat persetujuan, dan ringkasan seluruh event. Ringkasan tidak dihitung dari satu halaman saja.
- Admin/panitia hanya memuat 25 peserta per halaman. Pencarian server di-debounce. Jika mutasi mengosongkan halaman terakhir, halaman valid di bawahnya diminta ulang—bukan sekadar mengganti label nomor halaman.
- Pilihan peserta tetap bertahan saat berpindah halaman/filter. Registry lintas halaman hanya menyimpan ID, nama, kode, serta status yang diperlukan; bukan seluruh kontak/profil.
- `projection=selection&eligible=true` diminta hanya setelah pengguna secara eksplisit memilih seluruh hasil filter/semua pending. Checkbox seleksi memeriksa keanggotaan scope, bukan hanya membandingkan jumlah pilihan.
- Persetujuan tetap memakai batch maksimal 25, melaporkan kegagalan parsial/hasil belum pasti, dan tidak mengulang request mutasi otomatis.
- Ekspor CSV panitia membaca seluruh halaman filter aktif secara eksplisit, maksimum 100 baris/request. Ekspor bukan hanya halaman yang sedang ditampilkan.
- Endpoint peserta tanpa parameter tetap menyediakan daftar lengkap untuk kompatibilitas pemanggil lama. Endpoint ini bukan lagi jalur pemuatan workspace baru.
- Riwayat profil asatidz, event lama, presensi, serta alasan status tetap dipertahankan. Pembacaan afiliasi dan riwayat event yang independen diparalelkan. Pengurutan alasan status mempunyai tie-breaker ID.

### Query dan data berlebih

- Dashboard admin: 13 query menjadi satu statement dengan agregat skalar. Dashboard panitia: lima query menjadi satu statement.
- Resolusi sesi staff menggabungkan identitas dan role assignment dalam satu query tanpa mengambil hash password. Lookup profil portal hanya mengambil ID.
- Ringkasan, kelengkapan, serta kandidat duplikat direktori asatidz dihitung di SQL, bukan mengambil seluruh profil aktif pada setiap halaman.
- Pengaturan registrasi dipisahkan ke `GET /events/:id/registration-settings`: tanpa poster inline, sesi, atau akun panitia. Pembacaan anak detail event diparalelkan.
- Pemilih event di workspace peserta panitia dan pengelolaan panitia memakai `GET /events/options`, bukan seluruh record/poster setiap event. Jalur `/events` lama tetap kompatibel.
- Pemilih lembaga undangan opsional tidak lagi menahan daftar utama jika gagal dimuat. Direktori asatidz membatalkan request lama dan mengoreksi halaman di luar rentang.

### Katalog publik dan poster

- Beranda hanya meminta `view=featured&pageSize=3`.
- Riwayat meminta `view=history&pageSize=12`; agenda meminta `view=agenda&pageSize=6`, dengan tombol muat berikutnya. Masing-masing memiliki state/error terpisah; perpindahan halaman riwayat tidak memuat ulang agenda.
- Poster inline pada katalog/detail publik diganti di SQL menjadi URL `GET /events/public/:slug/poster?v=<updatedAt-ms>`. Blob tidak ikut dikirim dalam JSON.
- Endpoint gambar memeriksa status publik dan arsip, membatasi MIME JPEG/PNG/WebP, memberi ETag/304 dan `nosniff`. Versi yang cocok memakai cache immutable; versi lama/tanpa versi tidak diberi immutable. SVG tidak disajikan.
- Aset PNG asli dipertahankan untuk kompatibilitas. Default baru memakai WebP 1600px/800px, dengan `srcset` pada hero.

### Kebijakan kuota undangan yang sudah terbuka

- Form admin membedakan pengaturan **undangan baru** dari **edit undangan yang sudah dibagikan**.
- Halaman publik memeriksa `GET /invitations/public/:type/:token/policy` saat kembali fokus/terlihat. Endpoint ini murni SELECT: tidak menaikkan `usedCount`, menandai opened, atau menulis audit.
- Batas berasal dari undangan tersimpan, bukan default event. Penurunan kuota membersihkan anggota berlebih, mempertahankan input peserta utama, dan mereset persetujuan. Form memberi pemberitahuan perubahan.
- Undangan yang dicabut/telah ditutup memblokir pengiriman. Gangguan jaringan pada pemeriksaan read-only tidak menghapus input; POST tetap memeriksa kebijakan terbaru di backend. Tidak ada polling, submit, atau retry mutasi otomatis.

## Bukti pengurangan beban

Ukuran berikut adalah byte JSON/aset yang diukur lokal; bukan ukuran gzip atau hasil load test. Data QA mencakup fixture tambahan sehingga perbandingan direktori/katalog dengan audit awal tidak identik per baris.

| Jalur | Sebelum | Sesudah |
| --- | ---: | ---: |
| Peserta event historis (230 orang), respons awal | 256.688 byte / 230 baris | 28.242 byte / 25 baris (**−89%**) |
| Peserta historis, data mentah DB yang ditransfer | 140.923 byte | 22.120 byte, termasuk metadata agregat |
| Data event untuk workspace registrasi | 84.600 byte, 4 query detail | 602 byte, 1 query settings |
| Dashboard admin | 13 query | 1 query |
| Dashboard panitia | 5 query | 1 query |
| Direktori asatidz, transfer mentah DB | 108.485 byte / 438 baris pada audit awal | 19.376 byte / 45 baris pada QA |
| Katalog publik awal | 304.609 byte / 6 program pada audit awal | 1.393 byte / 3 featured pada QA |
| Poster default PNG | 2.279.849 byte | WebP 1600px: 126.018 byte (**−94,5%**) |
| Poster hero layar kecil | PNG yang sama | WebP 800px: 43.646 byte (**−98,1%**) |

Seluruh 230 ID peserta dibandingkan antara hasil daftar lengkap dan gabungan halaman: tidak ada data hilang/duplikat. Lima event riwayat pada profil sampel tetap utuh. Filter kontak, status, kelengkapan dan duplikat dibandingkan dengan aturan JS sebelumnya, bukan hanya memeriksa bentuk SQL.

**Latensi tidak dijanjikan:** sampel waktu lokal bervariasi akibat koneksi, cache/cold start, dan pekerjaan paralel di mesin pengujian. Indeks tidak otomatis mempercepat tabel kecil; sequential scan dapat merupakan pilihan planner yang benar. Klaim utama yang terukur adalah penurunan payload, pengurangan round trip, serta perbaikan bug.

Pada rencana QA terakhir, query halaman peserta memakai `idx_participants_event_created` dan membaca 25 baris untuk halaman pertama; subquery jumlah keikutsertaan memakai `idx_participants_ustadz`. Sampel waktu eksekusi SQL halaman tersebut 0,335 ms, dibanding 1,037 ms pada sampel sebelum indeks. Ini bukan benchmark stabil atau ukuran latensi API. Ringkasan direktori masih sekitar 26 ms di kedua sampel, sehingga tidak diklaim lebih cepat karena penambahan indeks.

## Hasil verifikasi akhir

| Pemeriksaan | Hasil |
| --- | --- |
| TypeScript | Lulus |
| Unit/regresi service | **1.085 lulus, 1 dilewati**; 120 file lulus, 1 file dilewati |
| Browser performa, React StrictMode | Lulus; 155 peserta, satu request awal, permission, seleksi lintas halaman, tujuh batch approval, CSV lengkap, stale read, katalog, dan policy refresh |
| Browser undangan yang sudah ada | Lulus pada lebar 320/390/768/1280px, termasuk alur penggantian undangan dicabut yang ada di working tree |
| SQL live QA | Lulus; seluruh 230 peserta historis, lima event riwayat profil sampel, filter/summary, serta katalog tetap benar |
| Indeks QA | Kelima indeks tersedia, valid, dan ready |
| Pengaman runner migrasi | Dry-run tidak mengakses DB; host berbeda dan pooled ditolak sebelum koneksi |
| Build produksi frontend | Lulus (`tsc` + Vite) |
| Bundle API Node.js | Lulus (esbuild) |
| Pemeriksaan diff/whitespace | Lulus |

Artefak pengujian tersimpan lokal di direktori temp OpenCode: `performance-browser-results.json`, `performance-read-final.json`, serta screenshot `performance-committee-desktop.png` dan `performance-policy-refresh.png`. Laporan JSON berisi metrik/rencana yang disanitasi, bukan row pribadi atau credential. Branch QA yang digunakan dijadwalkan kedaluwarsa pada **11 November 2026, 16:00 UTC**; pengujian berikutnya perlu branch QA baru jika branch ini sudah berakhir.

## Menjalankan verifikasi

```powershell
npm run typecheck
npx vitest run tests/unit netlify/functions/lib/services/institutionAccessCodeService.test.ts --maxWorkers=4 --testTimeout=30000
npm run test:institution-invitations:browser
npm run test:performance:browser
npm run build
```

`test:performance:browser` memakai API fixture dan Chromium lokal, React StrictMode, 155 peserta, serta katalog lebih dari satu halaman. Tidak memakai database atau mengirim email/WhatsApp nyata.

Pengujian SQL live memerlukan target eksplisit dan tidak memuat `.env` sendiri:

```powershell
$env:PERFORMANCE_DATABASE_URL = '<URL database QA>'
npm run test:performance:reads -- --expected-host=<host-QA> --output=<path-laporan-json>
```

Script `scripts/check-performance-reads.mjs` memaksa transaksi READ ONLY, memeriksa semantik/pagination/riwayat, dan merekam agregat serta rencana `EXPLAIN (ANALYZE, BUFFERS)`. Tidak menyimpan data pribadi, parameter query, atau credential ke laporan.

## Indeks opsional dan rollout

`drizzle/0015_performance_read_indexes.sql` menambah:

- `idx_participants_ustadz`
- `idx_participants_event_created`
- `idx_participant_history_latest`
- `idx_ustadz_norm_name` dan `idx_ustadz_phone` (melengkapi deklarasi ORM yang tidak ada di beberapa deployment lama).

Aplikasi tidak bergantung pada keberadaan indeks tersebut. Migrasi tidak mengubah row/kuota/permission.

```powershell
# Default: hanya menampilkan SQL, tidak mengakses DB.
npm run db:migrate:performance

# Hanya setelah target/izin rollout disetujui; gunakan koneksi langsung, bukan -pooler.
$env:DATABASE_MIGRATION_URL = '<URL langsung untuk target yang disetujui>'
npm run db:migrate:performance -- --apply --expected-host=<host-target>
```

Runner menolak host yang berbeda atau pooled, membuat indeks satu per satu dengan `CONCURRENTLY`, dan memeriksa kelima indeks valid/ready. Jika ada indeks tidak valid karena proses terputus, runner melaporkan kegagalan; tidak menghapus/membangun ulang otomatis.

Rollout harus menyertakan frontend dan API baru bersama. Pada tindak lanjut, pengguna telah mengizinkan commit, push, merge ke `main`, dan deploy melalui pipeline yang tersedia. Izin ini **tidak mencakup migrasi indeks atau perubahan kuota produksi**; indeks tetap opsional dan belum diterapkan di produksi.

## Batasan yang masih perlu dipantau

- Pagination berbasis offset dan ekspor lintas request bukan snapshot transaksi tunggal. Perubahan pendaftaran bersamaan dapat mengubah halaman selama ekspor/seleksi. Urutan deterministik dan deduplikasi ID dipakai, tetapi snapshot export/keyset pagination perlu desain tersendiri bila volume/konkurensi meningkat.
- Ringkasan direktori tetap dihitung pada setiap request. Bila jumlah profil membesar, pertimbangkan cache agregat singkat atau ringkasan terpelihara setelah pengukuran baru—jangan mencache otorisasi backend.
- Jalur legacy peserta masih dapat mengirim daftar besar bagi pemanggil lama yang sengaja memintanya; belum dihapus agar tidak merusak kompatibilitas.
- Poster tetap tersimpan di kolom lama; endpoint gambar mengurangi transfer berulang dan memanfaatkan cache, bukan memindahkan penyimpanan ke object storage.
- Kode/bukti lokal ini belum mengukur latensi deployment setelah rilis. Tidak ada perubahan kuota produksi, termasuk undangan yang pada audit masih bernilai 5 sementara default event 2.
