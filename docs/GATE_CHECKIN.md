# Gate cepat panitia

- Halaman `/gate` atau `/gate/:eventSlug` terbuka **tanpa login**. Rute `/check-in` lama membuka halaman operasional yang sama, bukan halaman statis yang menyatakan check-in selalu terbuka. Daftar program berasal dari event yang dipublikasikan.
- Pilih program dan hari/sesi yang membuka check-in, kemudian pakai QR lewat kamera, kode peserta, atau cari nama. Pencarian menampilkan paling banyak 12 kandidat per event dan memerlukan setidaknya dua karakter; pilih orang yang tepat sebelum mencatat. Kamera perlu izin perangkat dan `BarcodeDetector`; bila browser tidak mendukung, kode/nama tetap tersedia. API pencarian/pencatatan publik menerapkan batas permintaan per perangkat.
- Token QR peserta ditandatangani dengan event ID dan versi rotasi. Kode peserta unik per event, sedangkan pencarian nama tidak langsung mencatat presensi: selalu diarahkan ke kode peserta terpilih. Server menolak status belum disetujui, event lain, unit tertutup, dan duplikat check-in pada unit yang sama.
- Admin event memiliki tabel peserta yang dipaginasi; header kolom tetap berbentuk tabel pada semua layar dan tabel panjang dapat digeser horizontal pada ponsel.
