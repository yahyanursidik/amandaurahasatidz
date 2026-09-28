# Design — Aman Daurah Asatidz

Sistem visual bersama untuk halaman masuk, halaman program, formulir, dan portal peserta. Perubahan halaman lain mengikuti token yang sudah ada di `tokens.css`; jangan membuat palet baru per portal.

## Genre dan suara

Modern-minimal, tenang, jelas, dan hormat. Kalimat operasional yang langsung menjawab: apa yang perlu dilakukan, kapan, dan apa yang terjadi berikutnya. Hindari jargon teknis kepada asatidz.

## Keluarga struktur

- Halaman program publik: Narrative Workflow — informasi acara, pilihan jalur daftar, lalu langkah setelah mendaftar.
- Halaman masuk: pintu masuk ringkas per peran, formulir menjadi titik fokus; gambar interior perpustakaan hanya pendamping.
- Portal peserta: Workbench — kartu program, status, jadwal, dan QR sebagai alat kerja, tanpa ilustrasi dekoratif.

## Identitas dan token

- Palet hijau-keabuan yang sudah ada di `tokens.css` (`--color-event-*`, `--color-login-*`, `--color-portal-*`) adalah sumber warna.
- Permukaan terang dengan teks gelap; hijau hanya untuk aksi utama, status, dan fokus. Portal admin, panitia, dan asatidz berbagi bentuk dan tipografi, berbeda hanya pada aksen yang sudah ada.
- Display: `--font-event-display`; body: `--font-event-body`. Tidak memakai huruf miring pada judul. Ukuran teks bantuan di ponsel paling kecil 0.875rem.
- Spasi memakai skala bernama `--space-event-*` / `--space-login-*` / `--space-portal-*`.
- Tombol dan input minimum 44 px; fokus terlihat; label tidak hanya berupa placeholder.

## Gerak dan responsif

- Maksimal satu animasi masuk ringan dan umpan balik tombol. Reduced motion mematikan gerak spasial.
- Validasi formulir menjelaskan kesalahan dekat tindakan dan dalam `role=alert`.
- Periksa lebar 320, 375, 414, dan 768 px. Tidak boleh ada gulir horizontal atau tombol dengan label dua baris.

## Konsistensi lintas halaman

- Nama produk: Aman Daurah Asatidz.
- Navigasi menunjukkan konteks jalur masuk saat ini; jangan mencampur pilihan ketiga portal di satu halaman login.
- Setiap program memakai poster sendiri bila disediakan, atau gambar interior perpustakaan bawaan tanpa figur.
- Jalur reguler dan undangan harus diberi label berbeda. Jangan menjanjikan kursi sampai persetujuan admin/panitia.
- Satu akun asatidz dapat memiliki beberapa kepesertaan di program yang berbeda; dalam satu program hanya satu kepesertaan aktif per profil.
