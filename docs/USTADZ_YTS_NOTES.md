# Catatan internal dan penanda warna YTS

## Akses dan lokasi

- Direktori `/admin/ustadz`: badge warna, jumlah catatan aktif, tautan langsung ke tab catatan. Tidak memuat judul/isi catatan.
- Detail `/admin/ustadz/:id?tab=notes`: tab Catatan internal YTS.
- Hanya SUPER_ADMIN atau SYSTEM_ADMIN **global aktif**. Assignment terbatas event/lembaga, belum aktif, kedaluwarsa, dan tanggal tidak valid tidak memberikan akses.
- DATA_STEWARD, admin event, panitia, peserta/asatidz, serta pengunjung publik tidak memiliki akses. Hak ustadz.read/update yang lebih luas tidak memberikan hak membaca catatan.

## Arti warna

| Warna | Label |
| --- | --- |
| Biru | Informatif |
| Kuning | Perlu tindak lanjut |
| Merah | Perlu perhatian segera |
| Hijau | Tindak lanjut selesai |

Satu profil dapat mempunyai banyak catatan. Badge memilih prioritas merah → kuning → biru → hijau dari catatan aktif. Selalu ada label teks, bukan warna saja. Catatan arsip tidak menentukan badge aktif. Penanda merupakan koordinasi manual, bukan penilaian kualitas ustadz, sanksi otomatis, atau dasar otomatis penolakan peserta. Tidak mengubah approval peserta/status profil.

## Pengelolaan

Tambah judul, warna, dan isi; simpan; edit catatan aktif; arsipkan atau pulihkan dengan konfirmasi. Filter status/warna serta pagination. Catatan mencatat nama pembuat/pengubah, tanggal, dan revisi. Tidak tersedia hapus permanen, pengiriman, ekspor catatan, atau riwayat teks semua revisi. Catatan baru pada profil yang digabung harus dibuat di profil tujuan; catatan profil asal ikut tampil dengan atribusi asli melalui scope rekursif yang aman dari siklus. Pengarsipan profil tidak menghapus catatan.

Editor melindungi perubahan belum tersimpan ketika berpindah tab, mengikuti tautan, keluar, menggunakan menu navigasi admin, Back/Forward, atau reload. Tombol/form dibatasi saat penyimpanan berlangsung. Versi usang, note ID milik profil lain, edit arsip, dan arsip/pulih berulang ditolak di database lewat predicate scope/version/status atomik.

Tuliskan fakta, sumber/tanggal, konteks, dan tindak lanjut seperlunya. Pisahkan pengamatan terverifikasi dari dugaan; hindari tuduhan dan data pribadi tidak relevan. Isi berupa teks biasa dengan escaping React, bukan HTML. Catatan internal tidak menggantikan prosedur klarifikasi dan koreksi dengan pihak terkait.

## Privasi teknis

Tabel `ustadz_yts_notes` terpisah dari profil umum. Endpoint khusus `/admin/ustadz-notes` dijaga server, bukan hanya menu UI. Respons sukses memakai `Cache-Control: no-store`. Tidak bergabung ke portal profile/overview, API profile/direktori umum, daftar peserta, pesan/email, atau CSV profil. Semua batch summary harus melewati penjagaan yang sama, dibatasi 50 UUID, hanya mengembalikan profil/count/warna. Isi/judul/flag tidak disalin ke audit log umum; audit hanya aksi/actor/resource/revisi. Database role/aplikasi produksi tetap perlu dikelola sebagai akses sensitif karena catatan tidak terenkripsi per kolom.

## Migrasi dan validasi

`npm run db:migrate:ustadz-notes` membaca `drizzle/0012_ustadz_yts_notes.sql` offline: satu tabel (11 kolom, primary key, 3 foreign key, constraint panjang/warna/revisi) dan satu indeks. Setelah target serta cadangan diverifikasi, gunakan `npm run db:migrate:ustadz-notes -- --apply`. Runner memakai DATABASE_MIGRATION_URL atau DATABASE_URL, satu transaksi SQL, lalu memeriksa kolom/indeks. CREATE IF NOT EXISTS bukan pemeriksaan kesesuaian lengkap skema yang telah ada. Runner ini manual dan tidak tercatat otomatis oleh journal drizzle-kit, seperti migrasi fitur sebelumnya.

Pengujian: unit validasi/service/routes/UI, handler API sesungguhnya dengan sesi dan DB mock, serta `npm run test:ustadz-notes:browser` (Chromium, actual directory/detail, API in-memory, traffic luar diblokir). Dry-run bukan bukti fitur telah bekerja dengan database nyata. Terapkan migrasi sebelum memakai tab di produksi; verifikasi staging, privasi, dan deploy terlebih dahulu. Implementasi fitur tidak menjalankan migrasi produksi, tidak membuat catatan pada orang asli, tidak menghubungi peserta, dan tidak melakukan push/deploy otomatis.