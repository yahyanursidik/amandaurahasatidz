# Penerapan pendaftaran program daurah

## Alur yang tersedia

1. Admin membuat/mengubah program di `/admin/events` dan memilih jalur **reguler**, **undangan**, atau **reguler dan undangan**. `Kapasitas total` membatasi jumlah peserta disetujui; `Kuota reguler` dan `Kuota undangan` membatasi masing-masing jalur. Angka `0` menutup jalur, sedangkan kolom kosong berarti tanpa batas khusus jalur (tetap tunduk pada kapasitas total).
2. Admin memublikasikan program lalu membuka pendaftaran. Daftar program ada di `/programs`; halaman setiap program ada di `/events/:slug`.
3. Asatidz reguler membuka `/events/:slug/register`, memverifikasi email kepala rombongan dengan kode enam digit, lalu mengisi data diri dan hingga 19 anggota lain. Status awal setiap orang `PENDING_REVIEW`; kode peserta bukan bukti persetujuan. Satu profil dapat mendaftar pada beberapa program, tetapi hanya sekali pada program yang sama.
4. Semua peserta menerima email pribadi, mengaktifkan akun di `/login/ustadz` bila belum memiliki password, dan melihat program/statusnya sendiri. Kepala rombongan dapat melihat daftar anggota, tetapi setiap QR presensi tetap milik individu. Perubahan anggota rombongan reguler sementara dibantu panitia; penggantian mandiri belum tersedia.
5. Undangan lembaga/individu tetap memakai tautan khusus dari panitia; formulir publik tidak menggantikannya. Impor admin saat ini dihitung sebagai jalur reguler.

## Sebelum digunakan pada database nyata

- Cadangkan database dan pastikan target `DATABASE_MIGRATION_URL` adalah lingkungan yang memang hendak diperbarui. Jangan menjalankan migrasi terhadap database produksi hanya untuk mencoba UI localhost.
- Terapkan migrasi `drizzle/0007_busy_thunderbolt.sql` melalui prosedur deployment database yang berlaku (`npm run db:migrate` bila koneksi dan izin sudah diverifikasi). Migrasi menambah `regular_quota` dan `invitation_quota` pada `events`.
- Terapkan juga migrasi `drizzle/0008_superb_excalibur.sql` untuk ID rombongan reguler dan target lembaga pengumuman.
- Pastikan `DATABASE_URL`, `SESSION_SECRET`, `INVITATION_OTP_SECRET`, dan `APP_URL` (URL publik produksi, untuk tautan dalam email) sudah disetel pada lingkungan API. Set `EMAIL_PROVIDER=MAILKETING`, `MAILKETING_API_TOKEN` (secret server-only), `MAILKETING_FROM_EMAIL=no-reply@yts.web.id`, dan `MAILKETING_FROM_NAME=Aman Daurah Asatidz`. Verifikasi domain/sender serta kredit di Mailketing. Set `EMAIL_WORKER_ENABLED=true` setelah uji pengiriman; tanpa ini email hanya tersimpan di antrean. Jadwal worker tiap menit akan kembali membuat permintaan database berkala bila diaktifkan.
- Pengingat otomatis sehari sebelum acara bersifat opt-in: set `ENABLE_AUTOMATED_REMINDERS=true` setelah uji penerima dan template. Pengingat lanjutan manual memakai kehadiran pada hari acara terjadwal sebelumnya, termasuk bila ada jeda antartanggal. Pengumuman dari admin/panitia dapat memilih pengiriman email saat publikasi. Semua tetap melalui antrean aplikasi; daftar/subscriber Mailketing tidak otomatis disinkronkan agar peserta yang tidak memberi persetujuan pemasaran tidak dimasukkan ke daftar BC.
- Uji satu program nonproduksi: publikasi, permintaan kode email, pendaftaran, aktivasi password, persetujuan panitia, lalu tampilan QR/portal. Uji juga kuota `0`, kuota penuh, email peserta yang sudah ada, dan pendaftaran kedua pada program yang sama.

## Batasan yang perlu diperhatikan

- Kuota dicek saat peserta **disetujui**, sehingga jumlah pendaftar yang menunggu peninjauan bisa melebihi kursi tersedia. Panitia perlu meninjau/menempatkan sisanya ke waitlist.
- Pemeriksaan kuota saat persetujuan saat ini berupa baca-lalu-perbarui, belum serialisasi atomik lintas permintaan serentak. Hindari persetujuan paralel pada kursi terakhir sampai penguncian database diterapkan.
- Pembatasan permintaan kode pada API saat ini berbasis memori proses, bukan pembatasan terpusat lintas instance serverless. Untuk pendaftaran publik berskala besar, tambahkan perlindungan anti-abuse yang persisten/di edge.
- Jika Neon HTTP tidak mendukung transaksi interaktif, pembungkus transaksi saat ini dapat mengeksekusi langkah satu per satu; kegagalan di tengah pendaftaran berisiko menyisakan akun/profil tanpa pendaftaran lengkap. Audit dan pemulihan perlu disiapkan sebelum lalu lintas publik besar.
- Email yang berstatus `ACCEPTED` berarti diterima antrean Mailketing, **bukan** bukti sudah tiba di kotak masuk. Pantau bounce/keluhan dari dashboard provider. Jangan menaruh token Mailketing di Git, browser, atau variabel `VITE_`; rotasi token yang pernah dibagikan di percakapan sebelum dipakai produksi.
