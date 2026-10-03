# Ruang Asatidz — Disapa, Didengar, Terhubung

Ruang komunikasi asatidz dengan Yayasan Tarbiyah Sunnah (YTS), tidak terikat pada satu event atau peserta yang sudah disetujui. Akses memerlukan akun dan role USTADZ. Super Admin/System Admin mengelola percakapan dan publikasi melalui menu admin.

## Halaman publik

- `/ruang-asatidz`: halaman pengenalan khusus, dapat dibuka tanpa login dari menu publik **Ruang Asatidz** atau kartu pengenalan di halaman program. Portal asatidz tidak menyediakan tautan keluar menuju halaman publik ini.
- Halaman publik menjelaskan Disapa, Didengar, Terhubung, pilihan saran/pengalaman/kebutuhan/pesan, serta privasi dan batas layanan. Tidak mengambil data percakapan, sapaan database, atau cerita pengguna.
- Tombol tindakan menuju `/portal/ruang-asatidz` dan subhalamannya. Jika belum login, pengguna masuk melalui Portal Asatidz lalu kembali ke rute Ruang yang dipilih. Tujuan kembali dibatasi ke rute Ruang yang dikenal, bukan URL eksternal.
- Pesan pribadi, balasan, sapaan, dan papan pengalaman tetap berada di portal yang membutuhkan akun. Persetujuan berbagi yang sudah diberikan penulis tidak diubah menjadi izin publikasi anonim di internet.
- Halaman publik tidak menyediakan registrasi akun atau pengiriman pesan anonim; gunakan aktivasi untuk akun yang sudah terdaftar, atau lihat jalur pendaftaran program.

## Menu asatidz

- `/portal/ruang-asatidz`: sapaan/kabar YTS yang dipublikasikan.
- `/portal/ruang-asatidz/saran`: menyampaikan saran untuk program dan pelayanan.
- `/portal/ruang-asatidz/pengalaman`: pengalaman mengajar/dakwah; pribadi secara default.
- `/portal/ruang-asatidz/kebutuhan`: permintaan pendampingan, materi, atau dukungan; bukan jaminan pemenuhan.
- `/portal/ruang-asatidz/pesan`: riwayat pesan, pertanyaan, dan status tindak lanjut.
- `/portal/ruang-asatidz/pesan/:id`: percakapan pribadi dan balasan tim YTS.
- `/portal/ruang-asatidz/terhubung`: pengalaman yang penulis izinkan dibagikan dan sudah dimoderasi YTS.

## Menu admin

- `/admin/ruang-asatidz`: kotak masuk, filter kategori/status, detail, balasan pribadi, perubahan status.
- `/admin/ruang-asatidz/tindak-lanjut`: pesan dalam proses.
- `/admin/ruang-asatidz/moderasi`: pengalaman beserta status publikasinya; tidak otomatis dipublikasikan.
- `/admin/ruang-asatidz/sapaan`: buat/ubah sapaan, simpan draf, terbitkan, atau tarik sapaan.

Status pesan: `NEW`, `READ`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`. Status publikasi terpisah: `PRIVATE`, `PENDING`, `PUBLISHED`, `HIDDEN`. Membaca detail tidak otomatis menandai status dibaca; admin menyimpan perubahan secara eksplisit. Percakapan yang ditutup tidak menerima balasan; YTS dapat membuka kembali status sebelum menindaklanjuti.

## Privasi dan keamanan

- Saran, kebutuhan, pertanyaan, serta pengalaman tanpa izin berbagi hanya tersedia bagi pemilik akun dan pengelola YTS yang berwenang.
- Pengalaman dibagikan hanya jika kategori `EXPERIENCE`, `shareExperience=true`, dan publikasi `PUBLISHED`. Nama akun ditampilkan bersama cerita setelah persetujuan penulis. Email, identitas akun internal, dan balasan pribadi tidak masuk papan pengalaman.
- Balasan percakapan tidak ikut dipublikasikan. Tidak tersedia komentar publik, lampiran, atau pencarian kontak asatidz.
- Pengelolaan menggunakan permission global `ruang_asatidz.manage`, hanya pada `SUPER_ADMIN` dan `SYSTEM_ADMIN`. Petugas event/lembaga tidak mendapat akses kotak masuk pribadi.
- API menggunakan autentikasi, pemeriksaan ownership, validasi UUID/input, pagination, pembatasan laju perubahan, dan `Cache-Control: no-store`. Teks dirender sebagai teks biasa, bukan HTML dari pengguna.
- Audit menyimpan metadata tindakan, bukan isi pesan pribadi.
- Ruang ini bukan kanal darurat. Jangan mengirim informasi pribadi pihak lain atau data sensitif yang tidak perlu. Tidak ada janji waktu respons, notifikasi otomatis, atau pemenuhan kebutuhan.

## Database dan rilis

Tiga tabel baru: `ruang_asatidz_threads`, `ruang_asatidz_replies`, `ruang_asatidz_greetings`. SQL idempoten mandiri ada di `drizzle/0009_ruang_asatidz.sql`. SQL ini **tidak terdaftar pada journal Drizzle**; gunakan runner khusus agar tidak diasumsikan sudah diterapkan oleh `npm run db:migrate`.

1. Periksa target `DATABASE_MIGRATION_URL` atau `DATABASE_URL`, siapkan cadangan, dan uji di database nonproduksi.
2. `npm run db:migrate:ruang-asatidz` hanya menampilkan SQL (**dry-run**, tidak menghubungi database).
3. `npm run db:migrate:ruang-asatidz -- --apply` menerapkan SQL dalam satu transaksi Neon dan memverifikasi keberadaan tiga tabel. Perintah ini mengubah database.
4. Rilis frontend dan API bersama setelah skema tersedia. Tabel belum tersedia menghasilkan pesan migrasi `DATABASE_SCHEMA_OUTDATED`, bukan keberhasilan palsu.

Fitur ini tidak melakukan migrasi produksi, push Git, deploy, pengiriman email/WhatsApp, atau penerbitan sapaan awal secara otomatis. Tidak memerlukan dependency tambahan. Perubahan persetujuan massal yang sebelumnya belum dirilis tetap dipertahankan.

## Pengujian database nyata (opt-in)

Suite `tests/integration/ruang_asatidz_live.test.ts` memanggil handler API asli, login password dan cookie sesi asli, serta database Neon tanpa mock. Tes berjalan dengan resolusi role dari database seperti produksi. Suite biasa melewatinya agar tidak menulis ke database eksternal tanpa otorisasi eksplisit.

Contoh PowerShell setelah memilih database tujuan dengan skema yang sudah dimigrasikan:

```powershell
$env:RUN_RUANG_ASATIDZ_INTEGRATION_TESTS = "1"
$env:RUANG_TEST_DATABASE_HOST = ([uri]$env:DATABASE_URL).Host
npm run test:ruang-asatidz:live
Remove-Item Env:RUN_RUANG_ASATIDZ_INTEGRATION_TESTS, Env:RUANG_TEST_DATABASE_HOST
```

`DATABASE_URL` harus tersedia pada lingkungan proses. Pastikan hostname adalah target yang memang diizinkan sebelum menyetelnya. Tes membuat tiga akun sementara dengan email `.invalid`, role, pesan privat, balasan, dan draf sapaan. Cleanup menghapus hanya data dari UUID akun acak milik run tersebut, termasuk audit uji. Jika proses dihentikan paksa, cleanup tidak dijamin; periksa akun dengan awalan `ruang-live-` dan log run sebelum menghapus secara terarah.

Publikasi pengalaman **tidak diuji pada produksi**. Untuk branch uji terisolasi saja, tambahkan `RUANG_TEST_ALLOW_PUBLICATION=1` dan `RUANG_TEST_ISOLATED_BRANCH=1`; keduanya wajib agar tes publikasi berjalan. Jangan menyetel flag ini untuk database produksi.

### Penerapan 2 Oktober 2026

- Target yang diperiksa: proyek Neon `DaurahAsatidz`, database `neondb`, branch `production` (`br-still-star-azoho3h9`).
- Cadangan sebelum migrasi: `ruang-asatidz-backup-2026-10-02T14-08-51-148Z` (`br-round-cake-azxkr8gn`), tanpa endpoint compute. Cadangan dipertahankan; kelola retensinya melalui prosedur backup, jangan hapus sebelum rilis diverifikasi.
- Migrasi diterapkan terlebih dahulu pada branch staging terisolasi. Tiga tes integrasi lulus, termasuk moderasi/publikasi dan proyeksi tanpa email/balasan privat.
- Runner khusus kemudian menerapkan migrasi produksi dan memverifikasi tiga tabel. Dua tes privat/draf lulus pada database produksi; tes publikasi sengaja dilewati. Cleanup data uji berhasil.
- Pengujian ini membuktikan alur handler API lokal dengan database nyata, bukan pengujian browser end-to-end atau verifikasi endpoint hosting produksi.
- Branch staging sementara telah dihapus setelah pengujian selesai; branch cadangan tetap tersedia.