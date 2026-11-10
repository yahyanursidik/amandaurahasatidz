# Recheck performa, data lama, dan kuota undangan

Tanggal: 10 November 2026. Baseline aplikasi: `30ffab9` (`main`).

Tindak lanjut kode dan hasil validasi QA dicatat terpisah pada [PERFORMANCE_IMPLEMENTATION_2026-11-10.md](PERFORMANCE_IMPLEMENTATION_2026-11-10.md). Temuan/bukti baseline di bawah tetap dipertahankan.

## Kesimpulan

- Ada waktu tunggu yang terasa pada akses publik: daftar program sekitar **1,38–3,13 detik** per request pada sampel ini; detail kegiatan lama **2,46–4,30 detik**. Ini pengukuran dari satu koneksi/lokasi, bukan SLA atau hasil load test.
- Data lama dapat dibaca pada sampel yang diuji. Pembacaan repository peserta event lama (230 peserta) sekitar **80–90 ms** dari mesin pengujian. Belum ada bukti bahwa umur data itu sendiri menyebabkan lambat; jumlah round trip, gambar, dan pengambilan data berlebih lebih jelas terlihat.
- Dua bug berhasil direproduksi dengan UI sebenarnya dan API fixture terisolasi: request awal ganda dan daftar peserta yang gagal untuk `REPORT_VIEWER` karena bergantung pada endpoint undangan yang tidak diizinkan.
- Laporan kuota 2 tetapi tampil 5 dapat dijelaskan dari konfigurasi tersimpan: undangan yang dirujuk masih berkuota **5**, sedangkan default event **2**. Perilaku checkbox dan batas 2 lulus pengujian browser terpisah.
- **Selama pengukuran audit tidak ada perubahan data/schema produksi, pengiriman email/WhatsApp, push, merge, atau deployment.** Publikasi Git sesudah audit hanya mencakup pengujian tambahan dan dokumen ini; belum ada perbaikan runtime untuk temuan performa/izin dan tidak mengubah kuota undangan produksi.

## Metode dan batasan

1. Browser produksi tanpa login: halaman utama, katalog riwayat, GET daftar program, dan GET detail kegiatan lama/aktif. Tidak mengirim formulir.
2. Database produksi: SELECT agregat dan metadata saja. Pengukuran repository lokal memakai allowlist SELECT serta transaksi HTTP `READ ONLY` di Postgres; hasil data pribadi tidak dicetak/disimpan sebagai artefak.
3. UI admin: komponen sebenarnya, React tanpa `StrictMode`, identitas fixture, API fixture, dan fungsi evaluasi permission dari aplikasi. Tidak memakai sesi atau API admin produksi.
4. Token undangan yang diberikan pengguna hanya dicocokkan lewat hash ke SELECT database. Endpoint publik undangan tidak dipanggil karena GET tersebut juga mengubah status dibuka dan menulis audit log. Token/URL rahasia tidak disalin ke dokumen ini.
5. Sampel bukan benchmark mobile/jaringan lambat, bukan uji beban serentak, dan tidak membuktikan aplikasi bebas bug. LCP/INP/CLS tidak diukur sebagai Web Vitals lengkap.

## Hasil browser produksi

| Pengukuran | Hasil sampel |
| --- | --- |
| Halaman utama pertama, first contentful paint | 7,624 detik |
| Halaman utama reload dengan cache, first contentful paint | 1,408 detik |
| Halaman utama pertama, request data program selesai sejak navigasi | 11,617 detik |
| Halaman utama reload, request data program selesai sejak navigasi | 4,333 detik |
| GET `/events/public`, pertama | 3,134 detik |
| GET `/events/public`, tiga request tambahan | 2,939 / 2,222 / 1,379 detik |
| GET detail kegiatan lama, dua request | 4,299 / 2,456 detik |
| GET detail kegiatan aktif, dua request | 1,956 / 1,460 detik |
| Katalog riwayat, request daftar selesai sejak navigasi | 4,024 detik; 5 kegiatan selesai + 1 agenda tampil |
| Gambar hero default | 2.279.849 byte; download pertama sekitar 5,60 detik |
| JSON daftar 6 program | sekitar 304,7 KB sebelum kompresi; sekitar 227,9 KB encoded pada request pertama |

First contentful paint bukan waktu seluruh data siap. Variasi latensi HTML/aset/API cukup besar sehingga hasil satu akses tidak boleh digeneralisasi ke semua pengguna. Seluruh request program/detail yang diukur menghasilkan HTTP 200. HTTP 401 dari `/auth/session` sesuai browser yang belum login, bukan bukti API program rusak. Tidak ada exception JavaScript tak tertangani yang ditemukan pada halaman publik yang diperiksa.

## Hasil pembacaan repository lokal

Angka berikut tidak mencakup autentikasi produksi, Netlify, atau perjalanan browser–API. Setiap query dibungkus transaksi read-only untuk pengamanan audit; ini bukan pengukuran endpoint deployment.

| Operasi | Dua sampel | Query | Ukuran JSON hasil aplikasi |
| --- | --- | --- | --- |
| Daftar program publik | 347 / 118 ms | 1 | 304,6 KB |
| Dashboard admin | 287 / 247 ms | 13 | 603 byte |
| Detail event lama | 155 / 234 ms | 4 | 84,6 KB |
| Seluruh peserta event lama, 230 orang | 90 / 80 ms | 1 | 256,7 KB |
| Direktori asatidz, 25 per halaman | 131 / 160 ms | 6 | 19,3 KB |
| Direktori lembaga, 25 per halaman | 41 / 38 ms | 3 | 11,9 KB |
| Profil dengan 5 riwayat kegiatan | 100 / 103 ms | 7 | 4,25 KB |

Database saat inspeksi: 7 event, 625 peserta event, 413 profil, dan 42 lembaga. Tabel presensi masih kosong, jadi ketepatan/performa riwayat presensi dengan data nyata belum dapat dinilai. `pg_stat_statements` belum terpasang; tidak diaktifkan dalam audit ini. Tidak tersedia ranking query historis atau p95/p99 dari seluruh trafik.

## Temuan terprioritas

### P1 — Daftar peserta gagal untuk pembaca laporan

Referensi: `src/pages/admin/events/EventRegistrationsPage.tsx:405`, `src/config/permissions.ts:107`, `netlify/functions/api.ts:1051` dan `:1060`.

- `REPORT_VIEWER` mempunyai `participants.read` dan `events.read`, tetapi tidak mempunyai `invitations.read`/`invitations.create`.
- Halaman peserta meminta daftar undangan, peserta, picker lembaga undangan, serta detail event dalam satu `Promise.all`.
- Fixture memakai evaluator permission aplikasi: peserta/event menghasilkan 200, undangan/picker menghasilkan 403. Hasilnya daftar peserta tidak tampil meskipun request pesertanya sukses.
- **Direproduksi**, bukan hanya dugaan. Belum diperbaiki.

Rekomendasi: pisahkan pemuatan sesuai tab dan izin; jangan menjadikan picker pembuatan undangan sebagai prasyarat membaca peserta. Pertahankan penolakan backend untuk endpoint yang memang tidak diizinkan; jangan memperluas izin role untuk menutupi bug UI.

### P2 — Request awal halaman peserta berlipat dua

Referensi: `src/pages/admin/events/EventRegistrationsPage.tsx:434–455`.

- Membuka langsung `registrations?view=participants` memicu efek event dan efek `participantView`.
- Tanpa `StrictMode`, fixture mencatat **2 request masing-masing** untuk undangan, peserta, picker lembaga, dan detail event: **8 request**, bukan 4.
- Generation guard menghindari hasil lama menimpa state, tetapi tidak membatalkan request/database yang sudah berjalan.
- **Direproduksi.** Jika picker perlu beberapa halaman, jumlah request bertambah lagi.

Rekomendasi: satu lifecycle pemuatan awal, pemuatan sesuai tab, serta deduplikasi/cancellation request. Hindari refresh seluruh koleksi untuk perubahan satu peserta.

### P2 — Gambar besar dan poster inline memperberat halaman publik

Referensi: `src/pages/public/PublicProgramsPage.tsx:109`, `:149`, `:184`; `netlify/functions/lib/repositories/eventRepository.ts:65–85`.

- Hero PNG sekitar 2,28 MB. Daftar enam program sekitar 304,7 KB; tiga poster inline menyumbang sekitar 301,6 ribu karakter.
- `loading="lazy"` tidak menghemat transfer poster yang sudah tertanam sebagai data URI dalam JSON: byte gambar telah ikut diunduh saat meminta daftar.
- Homepage hanya menampilkan tiga program unggulan, tetapi tetap mengambil seluruh katalog/riwayat.

Rekomendasi: gambar WebP/AVIF responsif; pisahkan poster/thumbnail dari JSON ke URL aset yang dapat dicache; endpoint ringkas/pagination untuk katalog publik. Jangan sekadar menghapus poster tanpa fallback yang tepat.

### P2 — Tampilan terpaginasikan belum berarti query ringan

Referensi: `netlify/functions/lib/repositories/ustadzRepository.ts:45–71`, `:139–177`; `netlify/functions/lib/repositories/participantRepository.ts:38–83`.

- Direktori asatidz menampilkan 25 profil, tetapi setiap request juga mengambil **403 profil tidak diarsipkan** untuk ringkasan/duplikat. Sampel menghasilkan 438 row database keseluruhan, bukan hanya 25.
- Daftar peserta mengambil seluruh peserta event sebelum frontend melakukan `slice` per 25. Sampel 230 peserta menghasilkan JSON 256,7 KB.
- Subquery jumlah riwayat dan alasan status dihitung per peserta. Indeks dengan prefix `participant_id` pada `participant_status_histories` dan prefix `ustadz_id` pada `event_participants` belum terlihat dalam metadata produksi.

Risiko pembesaran data, **bukan bukti query sekarang timeout**. Jangan menyimpulkan semua sequential scan buruk pada tabel kecil. Rekomendasi: pagination/filter server untuk peserta, ringkasan/duplikat berbasis agregat SQL atau cache terukur, dan evaluasi indeks dengan EXPLAIN pada branch pengujian sebelum migrasi.

### P2 — Banyak round trip berurutan dan autentikasi berulang

Referensi: `netlify/functions/lib/services/dashboardService.ts:14–77`, `netlify/functions/lib/repositories/eventRepository.ts:88–135`, `netlify/functions/lib/services/authService.ts:181–215`, `src/lib/refine/authProvider.ts:90–149`, `src/lib/refine/accessControlProvider.ts:5–18`.

- Dashboard menjalankan 13 query dalam sekitar 10 tahap menunggu; beberapa count independen masih berurutan.
- Detail event melakukan empat query berurutan, termasuk komite walaupun pemanggil hanya memerlukan pengaturan event.
- Identitas dan pengecekan login menggunakan request sesi terpisah; backend menyelesaikan user/assignment lagi setiap request produksi. `can()` juga selalu meminta permission ketika dipanggil. Frekuensi aktual pemanggilan permission pada seluruh portal belum diukur.

Rekomendasi: gabungkan agregat independen, gunakan projection/detail yang sesuai kebutuhan, dan deduplikasi request sesi/permission dalam batas pendek dengan invalidasi saat login/logout/perubahan akses. Jangan menghilangkan pemeriksaan permission server atau menyimpan izin lintas pengguna.

## Kasus khusus: kuota 2 tetapi formulir menampilkan 5

Undangan yang cocok dengan token pengguna: **INV/2026/11/04**, event **DAURAH-2026-11**.

| Data tersimpan saat diperiksa | Nilai |
| --- | --- |
| Kuota undangan tersebut | **5** |
| Kuota awal/default event | **2** |
| Status undangan | OPENED |
| Peserta terdaftar pada undangan | 0 |
| Tautan dicabut | Tidak |

Formulir publik menggunakan kuota undangan, bukan menimpa undangan lama dengan default event. Keduanya sengaja dapat berbeda. Form pembuatan yang masih kosong juga bukan editor undangan lama.

Untuk mengubah tautan tersebut: buka daftar undangan → cari **INV/2026/11/04** → **Edit undangan** → isi kuota **2** → **Simpan perubahan** → muat ulang formulir publik. Jika hanya satu perwakilan, matikan **Boleh membawa rombongan** pada editor undangan yang sama dan simpan; server menyimpan kuota 1. Penerima yang tidak berubah tidak memerlukan tautan baru.

Form **peserta utama tetap tampil** saat checkbox publik tidak dicentang. Yang disembunyikan adalah tombol tambah dan formulir anggota tambahan. Screenshot yang hanya memperlihatkan peserta utama tidak membuktikan peserta tambahan masih dapat ditambahkan.

Pengujian tambahan dengan admin editor dan public page yang memakai invitation fixture yang sama membuktikan:

1. Simpan kuota 2 → halaman publik menampilkan maksimal 2, bukan 5.
2. Belum dicentang → tepat satu form peserta utama, tanpa tombol tambah.
3. Dicentang → dapat menambah satu anggota; total 2; tombol tambah kemudian nonaktif.
4. Dilepas centangnya → anggota tambahan dan tombol tambah hilang; data anggota dibersihkan.
5. Dicentang kembali → data anggota yang dibuang tidak muncul kembali.
6. Admin mematikan rombongan dan menyimpan → seluruh kontrol rombongan publik hilang.

**Perilaku tersebut lulus pada kode saat ini. Kuota undangan produksi belum diubah oleh audit.** Form yang sudah terbuka juga tidak otomatis mengambil ulang kebijakan ketika admin mengubah undangan di tab lain; perlu muat ulang. Penyegaran kebijakan tanpa menghapus input peserta dapat menjadi perbaikan UX terpisah.

## Verifikasi

- Suite baseline dijalankan ulang: **1.049 lulus, 1 dilewati** (115 file lulus, 1 dilewati).
- Setelah dua test tambahan: suite terarah UI/service undangan **32 lulus**. Ini mencakup test baseline terkait, bukan 32 tambahan di luar 1.049.
- Verifikasi ulang sebelum publikasi Git: suite lengkap **1.051 lulus, 1 dilewati** (115 file lulus, 1 dilewati), termasuk kedua test baru.
- `npm run build`: lulus, termasuk TypeScript. Hash aset utama sesuai aset produksi yang terlihat dalam browser.
- `npm run test:institution-invitations:browser`: lulus, termasuk skenario baru kuota 2/unchecked dan regresi 320/390/768/1280 px.
- Reproduksi request ganda/role read-only: berhasil di fixture terisolasi, nol request produksi.
- `git diff --check`: lulus.

Prioritas berikutnya: benahi ketergantungan izin dan request ganda; optimalkan poster/daftar publik; lanjutkan pagination serta round trip backend. Tidak perlu menghapus atau memigrasikan riwayat lama untuk menyelesaikan masalah ini.
