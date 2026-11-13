# Perbaikan audit lintas alur — 13 November 2026

## Perubahan akses

- API impor menolak akun peserta/lembaga dan penugasan event yang tidak sesuai. Status persetujuan dan daftar tunggu memerlukan izin tersendiri; perubahan lama memerlukan revisi yang masih sesuai. Impor tidak mengonfirmasi hadir atau menimpa kontak master.
- Bagikan akses memerlukan `participants.manage_portal_access`. Respons hanya memberi bukti baca-saja; tidak berisi QR atau tautan keputusan. Pengaman nomor bersama/cadangan/perubahan belum ditinjau berlaku pada jalur ini dan wizard.
- Formulir publik tidak lagi memberikan sandi sementara atau akses keputusan. Bukti memakai `prc_`. Akses keputusan memakai `pcf_` dengan tujuan berbeda, dikirim langsung ke email pendaftaran hanya setelah peserta meminta dan mengisi email yang cocok. Tautan ini berlaku 30 menit dan terikat profil, email, serta waktu rotasi QR. Tautan lama tanpa tujuan keamanan baru hanya membuka status.
- Kode unik lembaga benar-benar diperiksa kembali pada penyimpanan transaksi, bukan hanya pada UI. Pesan undangan menyertakan kode. Mode undangan tidak disimpulkan dari awalan token lama.
- Token akses disensor di log request dan pesan kesalahan. Penggantian perwakilan dan pembacaan rombongan ditolak jika kepala rombongan sudah tidak aktif. Kombinasi peran tidak dapat memperluas laporan lintas event secara tidak sengaja.

## Presensi dan laporan

- Penerbitan QR, portal, dan Gate memakai jadwal unit yang sama, termasuk jendela akhir sesi yang melewati tengah malam. Konfirmasi rencana hadir tetap terpisah dari pencatatan presensi.
- QR Lokasi tetap singkat; peserta diarahkan login dahulu dan pindai ulang jika kedaluwarsa. Refresh otomatis memakai ulang baris token per unit; rotasi petugas tetap tercatat.
- Profil Asatidz dan rapor menghitung kelayakan yang sama. Jumlah kelompok lembaga/wilayah dan urutan halaman diperbaiki. Ekspor memakai ukuran halaman tetap, menetralkan rumus CSV, dan memakai UUID yang benar pada audit. Fitur Excel peserta tetap menggunakan sel teks.

## Email dan operasi

- OTP aktivasi dan permintaan akses dikirim saat diminta, termasuk ketika `EMAIL_WORKER_ENABLED=false`. Kode/akses baru ini tidak disimpan ke antrean.
- Pemberitahuan transaksi disimpan lalu dicoba hanya untuk job baru terkait tindakan, bukan seluruh BC. Batas waktu pengiriman berlaku per tindakan/batch. Sisa antrean tetap perlu diproses petugas berwenang bila worker otomatis nonaktif.
- Klaim email yang tertinggal direkonsiliasi. Bila belum diketahui apakah penyedia sudah menerima, status menjadi `DELIVERY_UNCERTAIN`; retry memerlukan pemeriksaan penyedia dan konfirmasi admin agar tidak mengirim ganda.
- Tidak memerlukan migrasi skema atau seed produksi. Usulan nomor baru ditampilkan di tab Peserta dan disimpan sebagai riwayat tinjauan, tidak dipercaya atau menimpa master dari form publik. Admin/pemilik menyimpan WhatsApp pada profil setelah memeriksa; penyimpanan eksplisit menyelesaikan usulan yang ditinjau secara atomik, tanpa menutup usulan baru yang datang bersamaan.
- Kode unik ditampilkan setelah undangan lembaga dibuat. Gunakan **Lihat kode unik** pada daftar undangan untuk melihat kode undangan lama tanpa mencabut tautan; akses ini memerlukan izin mengelola undangan dan tercatat di audit.

## Pemeriksaan sebelum rilis

Jalankan `npm test -- --maxWorkers=4 --testTimeout=15000`, `npm run build`, dan empat tes browser `test:event-registration:browser`, `test:institution-invitations:browser`, `test:kiosk:browser`, serta `test:ustadz-whatsapp:browser`. Tes menggunakan database lokal PGlite dan transport tiruan. Hasil rilis dicatat di PR; jangan mengartikan tes tiruan sebagai bukti email masuk ke inbox atau presensi sungguhan.
