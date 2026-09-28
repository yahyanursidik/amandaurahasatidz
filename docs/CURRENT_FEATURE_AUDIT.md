# Audit fitur dan rencana pengembangan

Tanggal: 27 September 2026. Dasar audit: rute aktif `src/App.tsx`, endpoint `netlify/functions/api.ts`, service, skema, dan layar aktif. Ini audit kode lokal; belum mencakup pengujian langsung terhadap database atau deployment produksi.

Pengujian koneksi Neon dijalankan hanya jika `RUN_NEON_INTEGRATION_TESTS=1`. Suite unit biasa tidak mengakses database eksternal.

## Status alur utama

| Area | Sudah berjalan di kode | Celah yang masih perlu dikerjakan |
| --- | --- | --- |
| Login dan hak akses | Tiga portal, cookie sesi bertanda tangan, password hash, RBAC per endpoint. Di produksi role dan status akun kini dibaca ulang dari database tiap permintaan. | Logout belum mencabut token lama di server; token berlaku sampai 7 hari. Rate limit masih di memori instance. Perlu penyimpanan sesi/revokasi dan limiter terdistribusi. |
| Event dan jadwal | Buat/ubah event, poster, status, hari dan sesi, mode absensi harian/sesi, dan batas konfirmasi. | Hari dan sesi baru bisa ditambahkan dari workspace; belum ada ubah, hapus aman, urut ulang, atau audit perubahan jadwal. |
| Lembaga dan undangan | Direktori lembaga, tautan unik, kode akses lembaga, kuota, tenggat, respons, dan delegasi. | Perlu pengujian end to end untuk perubahan delegasi setelah konfirmasi, penutupan tenggat, serta pengiriman ulang dan pencabutan tautan di produksi. |
| Peserta | Daftar dan persetujuan individu, profil, kontak WA/email, pembuatan akses portal per peserta. Upload CSV dengan preview dan validasi tersedia pada workspace event. | Upload CSV belum otomatis membuat akun portal untuk setiap baris; admin harus memakai aksi akses portal setelah impor. Daftar peserta event masih diambil sekaligus tanpa pagination server. |
| Check-in dan absensi | QR atau kode peserta, unit hari/sesi, koreksi manual, rekap dan raport individu. Scanner kamera memakai `BarcodeDetector`; input manual tersedia. | Perlu fallback kamera lintas browser, pengujian lapangan untuk event berjeda dan perangkat panitia, serta aturan offline/rekonsiliasi jika jaringan putus. |
| Portal peserta | Profil, undangan, jadwal, QR individu, pengumuman, absensi, dan perubahan wakil oleh kepala rombongan. | Perlu uji alur nyata setelah impor massal dan perubahan wakil; ketika API gagal di produksi kini ditampilkan error dan tombol coba lagi. |
| Komunikasi | Template WA, pengumuman, queue email, retry email gagal, halaman antrean admin. | Pengiriman WA masih membuka `wa.me` untuk dikirim manual. Status delivery email dan hasil webhook perlu diverifikasi pada provider yang dipakai. |
| Laporan dan audit | Rekap kehadiran, beberapa tipe laporan, ekspor, jejak audit. | Perlu rekonsiliasi angka lintas undangan/peserta/absensi dan pengujian ekspor dengan data besar serta formula CSV. |

## Perubahan dalam iterasi ini

- Menghubungkan menu antrean email di dashboard dan sidebar ke halaman status, filter, proses manual, dan retry khusus job gagal.
- Menambahkan pemeriksaan izin pada endpoint proses email serta klaim job bersyarat agar dua worker tidak mengirim job yang sama secara bersamaan.
- Menghilangkan payload email dari respons dashboard antrean; admin hanya menerima metadata operasional.
- Menjaga portal peserta dan layar panitia dari data simulasi pada kegagalan API produksi.
- Menguatkan CSV peserta: tanda petik/baris baru, header, jumlah kolom, batas ukuran, status yang tidak valid, duplikat kontak, konflik profil, dan kode peserta otomatis untuk impor berulang. Proses simpan melaporkan hasil tiap baris dan mengenali baris dari upload sebelumnya untuk percobaan ulang.
- Preview impor lembaga lama kini menampilkan kesalahan saat koneksi database gagal. Hasil validasi tidak lagi tampil seolah telah dibandingkan dengan database.
- Di produksi, token sesi tidak lagi menyimpan role/profil dan hak akses diperiksa ulang dari database.

## Prioritas berikutnya

1. **P0 — integritas transaksi:** `withTransaction` memakai fallback nontransaksional pada driver Neon HTTP. Impor peserta kini melaporkan keberhasilan/kegagalan per baris dan dapat dicoba ulang; satu baris yang gagal sesudah pembuatan profil masih bisa menyisakan profil/afiliasi tanpa peserta. Untuk jaminan atomik penuh, gunakan driver yang mendukung transaksi interaktif. Impor lembaga lama juga masih memakai fallback ini.
2. **P0 — sesi dan keamanan:** simpan sesi yang dapat dicabut, lakukan rotasi token saat perubahan password, dan pindahkan rate limit login/kode lembaga ke penyimpanan bersama antar instance.
3. **P1 — akun hasil upload:** beri admin opsi membuat akses portal massal setelah hasil impor tampil, dengan email unik, kredensial sekali lihat, dan status aktivasi per peserta.
4. **P1 — data besar:** pagination dan filter server untuk peserta, undangan, antrean email, dan laporan; pertahankan filter pada URL.
5. **P1 — jadwal:** ubah/hapus hari dan sesi dengan validasi ketika sudah ada presensi, serta audit perubahan.
6. **P1 — uji operasional:** jalankan skenario nyata satu hari, tiga hari berurutan, dan dua hari berjeda; verifikasi QR individu, duplikasi check-in, penggantian wakil, dan raport akhir.
7. **P2 — pengalaman penggunaan:** tingkatkan ukuran teks operasional yang masih `text-xs`, navigasi keyboard/fokus, dan fallback pemindai untuk browser tanpa `BarcodeDetector`.

## Kriteria pemeriksaan sebelum rilis

- Login tiap role berhasil sekali masuk; akses role yang dicabut langsung ditolak.
- Impor CSV 1, 2, dan 500 baris memberi hasil yang konsisten, termasuk kegagalan di tengah batch.
- Undangan lembaga menghasilkan akun dan QR terpisah per asatidz; pergantian wakil tidak mewariskan absensi orang lama.
- Setiap hari kegiatan memiliki unit absensi sendiri, termasuk ketika ada hari jeda; rekap cocok dengan catatan check-in.
- Job email tidak terkirim ganda saat dua worker berjalan, dan endpoint proses ditolak bagi pengguna tanpa izin.
- Semua layar produksi menampilkan error nyata ketika API tidak tersedia dan tidak memperlihatkan data contoh.

## Verifikasi lokal

- `npm run build`: berhasil.
- `npm test`: 165 lulus, 1 dilewati. Tes yang dilewati adalah koneksi langsung ke Neon; jalankan secara eksplisit dengan `RUN_NEON_INTEGRATION_TESTS=1` saat jaringan dan database tersedia.
