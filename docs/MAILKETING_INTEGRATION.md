# Koneksi Mailketing

Pemberitahuan pendaftaran, persetujuan, konfirmasi, undangan, pengingat, informasi acara, dan BC memakai antrean email aplikasi. Pendaftaran/persetujuan/konfirmasi mencoba memproses hanya email transaksi yang baru dibuat, dengan waktu dibatasi; sisa antrean atau kegagalan dapat diperiksa admin. Kode pembuatan sandi dikirim langsung saat diminta; aplikasi tidak menyimpan kode baru ke antrean. Penyedia default adalah Mailketing API v2. Alamat pengirim yang diminta: `no-reply@yts.web.id`.

## Aktivasi aman

1. Karena token pernah dibagikan dalam percakapan, cabut dan buat token baru di dashboard Mailketing. Simpan hanya sebagai environment variable server di Netlify (Production), **bukan** di Git, `VITE_`, atau formulir browser.
2. Verifikasi domain `yts.web.id` dan sender `no-reply@yts.web.id` di Mailketing. Pastikan kredit tersedia. Rujuk [dokumentasi Mailketing API v2](https://api.mailketing.co.id/docs/).
3. Atur variabel berikut pada lingkungan Netlify yang menjalankan API dan fungsi terjadwal:

   ```text
   EMAIL_PROVIDER=MAILKETING
   MAILKETING_API_TOKEN=<token-baru-rahasia>
   MAILKETING_FROM_EMAIL=no-reply@yts.web.id
   MAILKETING_FROM_NAME=Daurah Duat dan Pegiat Dakwah
   APP_URL=https://<domain-aplikasi>
   EMAIL_WORKER_ENABLED=false
   ```

4. Deploy ulang agar fungsi memakai variabel baru. Masuk sebagai Super Admin → **BC & kampanye email** → **Periksa koneksi Mailketing**. Pemeriksaan penyedia ini hanya membaca kredit dan daftar sender; tidak mengirim email atau membuat antrean baru. Status “siap” berarti prasyarat dasar terpenuhi, bukan bukti email diterima peserta.
5. Simpan satu template BC lalu gunakan **Kirim uji template** ke alamat milik sendiri. Ini mengirim **satu email sungguhan** dan menyimpan hasilnya di riwayat. Periksa inbox/spam serta dashboard Mailketing. Jangan menjadwalkan BC sebelum uji ini berhasil.
6. Jika ingin sisa pemberitahuan antrean dan BC dikirim otomatis, set `EMAIL_WORKER_ENABLED=true` di Netlify dan deploy ulang. Bila `false`, admin yang berwenang dapat memproses sisa antrean manual. Email pendaftaran/persetujuan/konfirmasi tetap dicoba setelah tindakan terkait, sedangkan kode pembuatan sandi dikirim langsung saat diminta. Mengaktifkan worker menyebabkan permintaan database berkala setiap menit; pertimbangkan ini jika Neon diharapkan tidur saat tidak ada aktivitas.
7. Jika statusnya **Perlu cek penyedia**, periksa riwayat Mailketing terlebih dahulu. Aplikasi tidak otomatis mengirim ulang ketika belum dapat memastikan apakah penyedia sudah menerima pesan. Jika memang belum diterima, admin dapat mengantrekan ulang setelah mengonfirmasi pengecekan.

## Batasan dan pengoperasian

- Respons `ACCEPTED`/`SENT` berarti penyedia menerima pesan, **bukan** jaminan sampai ke inbox. Pantau bounce/complaint melalui dashboard Mailketing dan riwayat pengiriman aplikasi.
- BC aplikasi memakai data asatidz aktif dalam database, bukan daftar Mailketing. Endpoint `/lists` dan `/subscribers` tersedia di penyedia, tetapi sinkronisasi otomatis sengaja tidak dijalankan. Jika kelak digunakan untuk kampanye non-operasional, siapkan persetujuan komunikasi dan mekanisme berhenti berlangganan terlebih dahulu.
- Jika status menyebut token ditolak, sender belum terdaftar, atau kredit habis, perbaiki di akun Mailketing lalu ulangi pemeriksaan. Jangan tempel token ke tiket, log, atau chat.
- Untuk localhost, isi variabel pada `.env` yang diabaikan Git dan jalankan fungsi Netlify, bukan hanya Vite; Vite sendiri tidak menyediakan endpoint backend `/api`. Jangan memakai token produksi untuk eksperimen lokal bila token pengujian tersedia.
