# Profil dan keandalan Portal Asatidz

## Profil Saya

Lokasi: `/portal/profile`. Peserta dapat mengubah nama lengkap, email kontak, gelar, tempat/tanggal lahir, telepon, WhatsApp, alamat, domisili, ringkasan pendidikan, dan keahlian. Simpan atau batalkan perubahan melalui tombol editor. Perubahan yang belum disimpan dilindungi konfirmasi saat meninggalkan editor.

**Email kontak bukan email login.** Perubahan `ustadz_profiles.email` digunakan untuk kontak/notifikasi dan tidak mengubah `users.email`, password, peran, atau status persetujuan. Email login ditampilkan terpisah, hanya baca. Nama akun disinkronkan dengan nama profil dalam satu pernyataan SQL atomik. Pergantian email login memerlukan alur verifikasi terpisah dan tidak disediakan editor ini.

## Domisili otomatis

Ketik sedikitnya dua huruf atau beberapa kata, misalnya `bandung barat`, `kota bandung`, atau `kab. bogor`. Pencarian mencocokkan semua kata pada nama kabupaten/kota dan provinsi; urutan kata tidak harus sama. Pilih saran agar provinsi serta kode wilayah terisi otomatis. Provinsi pada editor profil hanya baca; server menghitung kembali provinsi dari kode kabupaten/kota dan menolak kode pasangan yang tidak sesuai.

Snapshot lokal memuat 38 provinsi dan 514 kabupaten/kota dari BPS SIG periode `2025_2.2025`. Kode memakai namespace BPS, bukan Kemendagri. Snapshot sebelumnya dari emsifa hanya memuat 34 provinsi. Wilayah pemekaran Papua mengikuti BPS pada pilihan baru; penyimpanan profil tidak memutakhirkan seluruh kode lama di database secara massal. Jika kode lama tidak dikenali, perubahan bidang lain tetap diperbolehkan dan domisili lama tidak otomatis dihapus.

Dataset `src/lib/indonesiaRegionData.ts` digunakan bersama frontend dan backend; browser tidak meminta layanan wilayah pihak ketiga. Penyegaran eksplisit: `node scripts/refresh-indonesia-regions.mjs`, tinjau selisih dan perubahan kode sebelum commit. Penyegaran bukan bagian build/migrasi otomatis.

## Kepemilikan dan keamanan

- Resolusi profil mengutamakan tautan `user_id` ke ID akun terautentikasi, bukan ID profil dari sesi atau email kontak.
- Fallback untuk data lama hanya jika tepat satu profil belum tertaut cocok dengan email login tersimpan di database. Profil milik akun lain tidak boleh diambil.
- Saat simpan, fallback aman ditautkan ke akun dalam pernyataan atomik yang sama agar perubahan email kontak tidak menghilangkan akses.
- Pembaruan memeriksa ulang kepemilikan, status arsip/merge, dan revisi; bidang status, lembaga, ID akun, serta peran tidak dapat diubah peserta.
- Tidak ada migrasi baru untuk profil: kolom profil yang dipakai sudah tersedia.

## Portal

Beranda `/portal` menampilkan salam dan doa hangat dengan nama profil. Menu Ruang Asatidz tetap mengarah ke `/portal/ruang-asatidz` beserta subhalamannya. Tautan **Halaman publik Ruang Asatidz** di sidebar dan header portal dihapus; halaman publik `/ruang-asatidz` tetap tersedia di navigasi publik.

### Materi & Rekaman

Admin mengelola materi dari **Event → Materi & Rekaman**. Pilih video atau PDF, kaitkan dengan sesi bila perlu, lalu isi tautan utama dan tautan alternatif. Pratinjau tersedia sebelum simpan. Admin dapat menyimpan draf, membagikan materi, atau menariknya kembali dengan menyimpan sebagai draf. Portal Asatidz mengelompokkan materi yang dibagikan berdasarkan event. Pintasan dari jadwal membuka filter event dan sesi. Status **Tandai selesai** tersimpan per akun peserta.

Template pengumuman **Materi dan rekaman** menyisipkan tautan portal khusus event. Filter event dan sesi pada tautan langsung dipertahankan saat peserta masuk ke portal.

Video mendukung YouTube dan Google Drive. PDF mendukung file Google Drive dan URL HTTPS `.pdf` tetap dari Amazon S3. Host S3 kompatibel atau CDN milik organisasi dapat didaftarkan melalui `MATERIAL_PDF_HOSTS` di sisi server, berupa hostname persis yang dipisahkan koma. File S3 harus bisa diakses lewat URL tersebut dan dikirim sebagai `application/pdf` atau `application/octet-stream`. Penampil dalam portal membaca PDF per halaman hingga 64 MiB. Untuk PDF di atas 512 KiB, penyimpanan harus mendukung permintaan HTTP Range. Tautan **Buka PDF** tetap tersedia untuk membuka dokumen langsung di penyedia. Akses ke tautan yang sudah dibagikan mengikuti izin penyedia file. Tautan S3 bertanda tangan kedaluwarsa sehingga formulir meminta URL tetap.

Terapkan `drizzle/0018_event_recordings.sql` sebelum `drizzle/0019_event_materials.sql`. Migrasi kedua mempertahankan ID, tautan, dan status rekaman lama. Jalur halaman lama mengarah ke menu baru, dan API rekaman lama tetap mengembalikan video.

## Pengujian

Jalankan `npm run typecheck`, `npm test -- --maxWorkers=2`, dan `npm run build`. Uji browser profil `node scripts/check-profile-browser.mjs` memakai Chromium/Edge/Chrome dan API fixture lokal; tidak mengakses database atau provider email.

Tes database nyata hanya boleh dijalankan secara opt-in pada branch terisolasi. Jangan menjalankan worker email atau pengiriman massal sebagai bagian tes portal.

Suite `npm run test:portal:live` memerlukan `RUN_PORTAL_FEATURES_LIVE=1`, `PORTAL_TEST_DATABASE_HOST` sama persis dengan host `DATABASE_URL`, dan `PORTAL_TEST_ISOLATED_BRANCH=1`; context produksi ditolak. Fixture random dibersihkan, termasuk penerima pengumuman sebelum peserta/event agar foreign key tidak menghalangi cleanup. Suite tidak memanggil worker, mengantrekan email, atau mengirim email.

Validasi nyata staging 3 Oktober 2026: 3 tes portal lulus (login/cookie, profil atomik, kontak vs login, wilayah, pembatasan kepemilikan QR, jadwal/riwayat, template/draf/pratinjau/publikasi portal tanpa email, tandai baca, QR lokasi dan self check-in). Suite Ruang Asatidz juga 3 tes lulus (pesan pribadi/balasan, draft sapaan, moderasi pengalaman dan privasi). Alur undangan publik dan pengiriman email peserta asli tidak dijalankan dalam staging smoke ini.

Uji browser memakai halaman portal yang dimuat lazy setelah BrowserRouter, sama seperti urutan aplikasi. Delapan tab utama diperiksa, termasuk kegagalan API QR/pengumuman/status baca beserta pemulihan, pengaman perubahan belum disimpan saat klik tautan dan Back, pencarian wilayah, simpan/reset/reload, dan overflow mobile. Guard riwayat kecil dimuat dari `src/main.tsx` sebelum router agar editor yang dimuat lazy dapat mencegat Back tanpa kehilangan draft. Permintaan eksternal diblokir pada fixture; tidak ada permintaan database atau email.
