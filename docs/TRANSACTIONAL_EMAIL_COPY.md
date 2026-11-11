# Pembuka email transaksional

Super Admin dapat mengubah pembuka dan sapaan di `/admin/email-templates` (menu **BC & Kampanye Email → Pembuka email transaksi**). Halaman menampilkan pratinjau untuk asatidz dan lembaga sebelum perubahan disimpan.

Pengaturan awal memakai basmalah, hamdalah, dan salawat berbahasa Arab. Sapaan asatidz awalnya `Al Ustadz Al Faadhil {{name}}, yang semoga dirahmati Allah Azza wa Jalla,`; sapaan lembaga memakai `Kepada Pimpinan {{name}}, ...`. Teks dapat diganti, tetapi kedua sapaan harus tetap memakai `{{name}}` agar nama penerima tidak hilang. Isi utama, kode pribadi, dan tautan QR/rundown/konfirmasi tetap berasal dari jenis transaksi masing-masing. Kode OTP sengaja tidak memakai pembuka panjang.

Pengaturan disimpan sebagai entri `TRANSACTIONAL_EMAIL_COPY_SETTINGS` di tabel `email_templates` yang sudah ada; tidak membutuhkan migrasi baru. Perubahan berlaku saat worker memproses email yang **belum dikirim**, termasuk antrean lama. Simpan pengaturan hanya setelah meninjau pratinjau, terutama bila ada email tertunda. Penyimpanan mencatat audit dan menolak versi halaman yang sudah kedaluwarsa agar perubahan admin lain tidak tertimpa.

Pengumuman khusus acara dan BC/kampanye mempunyai isi tersendiri yang dikunci saat dijadwalkan; pengaturan pembuka global ini tidak mengubah pesan khusus tersebut.

Saat `EMAIL_WORKER_ENABLED=false`, perubahan tidak mengirim email otomatis. Admin tetap dapat memproses antrean dari halaman pengiriman; lakukan uji satu email sendiri sebelum pengiriman luas. Teks dinormalisasi menjadi plain text lalu di-escape untuk HTML agar isi yang dikonfigurasi tidak menjadi markup aktif.
