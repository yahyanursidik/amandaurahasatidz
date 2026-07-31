# Evaluasi Komprehensif Modul

Tanggal evaluasi: 31 Juli 2026

## Ringkasan

Aplikasi sudah memiliki fondasi tiga jalur masuk, RBAC, pengelolaan event, undangan lembaga/individu, peserta, check-in, email, laporan, dan portal asatidz. Iterasi UI ini memperbaiki arsitektur navigasi, jalur URL, keadaan loading/error/kosong, serta menghubungkan dashboard, daftar event, halaman event publik, dan audit sistem ke API.

Namun, aplikasi belum siap dinyatakan production-ready. Sejumlah layar operasional masih memakai data simulasi atau `alert`, dan mekanisme sesi serta rate limit masih memakai memori proses. Migrasi password juga harus diterapkan pada basis data target sebelum autentikasi produksi digunakan.

## Perubahan yang sudah diterapkan

- Login dipisah menjadi `/login/admin`, `/login/committee`, dan `/login/ustadz`.
- Sidebar desktop, drawer mobile, dan navigasi bawah memiliki status aktif yang konsisten.
- Rute tidak dikenal menampilkan halaman 404 sesuai portal, bukan diam-diam kembali ke dashboard.
- Portal asatidz sekarang mengikuti URL untuk undangan, kegiatan, jadwal, QR, pengumuman, kehadiran, dan profil.
- Rute panitia untuk scanner, QR lokasi, kehadiran, dan pengumuman dipisahkan.
- Dashboard admin dan panitia mengambil metrik dari API dan menampilkan status koneksi.
- Daftar event dan halaman event publik memakai API, dengan loading, error, empty state, serta label jelas untuk data pratinjau development.
- Halaman Audit Sistem dan endpoint pembacaan audit sudah tersedia.
- Halaman event publik sekarang menyertakan sesi yang diambil bersama hari event.
- Endpoint event publik menolak event draft, dibatalkan, atau diarsipkan.
- Breadcrumb memakai navigasi client-side dan kontrol interaktif memiliki target sentuh yang lebih baik.

## Temuan per modul

### P0 — wajib sebelum produksi

1. **Sesi autentikasi belum persisten.** Sesi aktif disimpan di memori proses. Pada lingkungan serverless, sesi dapat hilang saat instance berganti. Simpan sesi ter-hash di database atau penyimpanan persisten dengan expiry dan revoke.
2. **Rate limit belum terdistribusi.** Pembatasan berbasis memori tidak konsisten antar-instance. Gunakan Redis/KV atau penyimpanan atomik.
3. **Migrasi password belum diterapkan.** Jalankan dan verifikasi migrasi `0002_public_wallop.sql` pada database target, lalu rotasi akun demo.
4. **Scanner panitia belum kamera nyata.** UI scanner dan hasil check-in masih simulasi. Integrasikan pembaca QR, validasi signature, event aktif, jendela check-in, serta respons duplicate/offline.
5. **Portal asatidz masih memakai data contoh.** Profil, RSVP, jadwal, QR, pengumuman, dan riwayat kehadiran harus mengambil data user yang sedang login; tindakan tidak boleh lagi memakai `alert`.

### P1 — alur operasional utama

1. Tambahkan konteks **event aktif** yang konsisten untuk admin dan panitia; jangan mengandalkan event contoh atau sesi hard-coded.
2. Hubungkan form create/edit/detail event, lembaga, dan asatidz ke API secara menyeluruh, termasuk validasi server, optimistic feedback, dan konflik data.
3. Selesaikan alur undangan lembaga: quota, konfirmasi lembaga, daftar wakil asatidz, status per wakil, audit perubahan, dan ekspor.
4. Pastikan peserta yang berasal dari lembaga memiliki identitas individu dan QR individu sehingga check-in tidak bergantung pada lembaga.
5. Hubungkan halaman kehadiran dan pengumuman panitia ke endpoint nyata; tambahkan filter event/sesi dan pembatasan permission.
6. Tambahkan pagination, filter status, dan URL query pada daftar besar agar pencarian dapat dibagikan dan tidak membebani browser.

### P2 — kualitas, aksesibilitas, dan observabilitas

1. Tambahkan test alur per role: login, membuat event, membuat undangan lembaga, mendaftarkan beberapa asatidz, persetujuan, dan check-in individu.
2. Uji keyboard, focus order, pembaca layar, kontras, zoom 200%, dan layar sempit pada semua form dan dialog.
3. Tambahkan error boundary, toast yang dapat diakses, retry terarah, serta telemetry tanpa data pribadi.
4. Tambahkan loading berbasis skeleton hanya pada area yang berubah; hindari blocking seluruh halaman.
5. Ukur bundle, render list, dan respons API dengan data realistis; gunakan pagination/virtualization bila diperlukan.

## Arsitektur navigasi yang disarankan

- **Admin:** Dashboard → Event → Lembaga → Asatidz → Audit Sistem.
- **Panitia:** Dashboard → Check-in → QR Lokasi → Kehadiran → Pengumuman.
- **Asatidz:** Beranda → Undangan → Kegiatan → Jadwal → QR → Pengumuman → Kehadiran → Profil.
- **Publik:** Informasi event dan tautan undangan; tidak ada navigasi ke fungsi internal.

Setiap portal memiliki landing dan permission sendiri. Perpindahan role tidak ditampilkan sebagai pilihan portal dalam satu halaman login.

## Kriteria selesai untuk alur lembaga

1. Admin membuat event dan undangan khusus lembaga dengan token acak yang dapat dicabut.
2. Lembaga membuka tautan, mengonfirmasi, lalu memasukkan wakil asatidz sesuai quota.
3. Admin melihat status lembaga serta daftar setiap asatidz yang diajukan.
4. Setiap asatidz mendapatkan participant ID dan QR individu.
5. Panitia memindai QR individu; sistem memvalidasi event, sesi, status peserta, waktu, dan duplikasi.
6. Rekap lembaga dan rekap individu konsisten, dapat diaudit, dan dapat diekspor.

## Batas klaim saat ini

Build dan typecheck hanya membuktikan konsistensi kompilasi, bukan keamanan produksi atau kebenaran seluruh alur. Label “aman”, “real-time”, atau “siap produksi” sebaiknya baru digunakan setelah sesi persisten, migrasi, integrasi scanner, pengujian role end-to-end, dan verifikasi deployment selesai.
