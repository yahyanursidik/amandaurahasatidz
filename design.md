# Design — Daurah Duat dan Pegiat Dakwah

Sistem visual bersama untuk halaman masuk, halaman program, formulir, dan portal peserta. Perubahan halaman lain mengikuti token yang sudah ada di `tokens.css`; jangan membuat palet baru per portal.

## Genre dan suara

Modern-minimal, tenang, jelas, dan hormat. Kalimat operasional yang langsung menjawab: apa yang perlu dilakukan, kapan, dan apa yang terjadi berikutnya. Hindari jargon teknis kepada asatidz.

## Keluarga struktur

- Halaman daurah publik: Index-First — riwayat kegiatan yang telah selesai menjadi fokus, sedangkan agenda aktif dan jalur pendaftaran tampil terpisah. Pengunjung tidak diminta membandingkan atau memilih daurah sebagai katalog produk.
- Halaman satu daurah dan formulir reguler: Narrative Workflow — ringkasan tanggal/tempat dan status, rundown sesuai zona waktu event, baru data peserta pertama dan anggota rombongan bila ada. Setelah dikirim, fokus pada bukti pendaftaran tanpa QR dan tautan status pribadi. QR presensi muncul setelah persetujuan dan konfirmasi hadir jika diwajibkan.
- Halaman masuk: pintu masuk ringkas per peran, formulir menjadi titik fokus; gambar interior perpustakaan hanya pendamping.
- Portal peserta: Workbench — kartu program, status, jadwal, dan QR sebagai alat kerja, tanpa ilustrasi dekoratif.
- Admin Event: Workbench — daftar ringkas, konteks satu event, lalu jalur kerja ke jadwal, undangan, peserta, panitia, kehadiran, komunikasi, dan laporan.

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

- Nama produk: Daurah Duat dan Pegiat Dakwah.
- Navigasi menunjukkan konteks jalur masuk saat ini; jangan mencampur pilihan ketiga portal di satu halaman login.
- Setiap program memakai poster sendiri bila disediakan, atau gambar interior perpustakaan bawaan tanpa figur.
- Jalur reguler dan undangan harus diberi label berbeda. Jangan menjanjikan kursi sampai persetujuan admin/panitia.
- Satu akun asatidz dapat memiliki beberapa kepesertaan di program yang berbeda; dalam satu program hanya satu kepesertaan aktif per profil.
- Tanggal dan waktu event mengikuti zona event (WIB/WITA/WIT), bukan zona komputer admin. Ringkasan tidak menyembunyikan tindakan penting di balik dekorasi.

## Exports

`tokens.css` di akar proyek adalah sumber lengkap. Pemetaan inti berikut menjaga identitas event bila sistem dipindahkan; proyek saat ini masih memakai Tailwind v3, jadi blok `@theme` adalah format portabel, bukan kode aktif.

### tokens.css

```css
:root {
  --color-event-paper: oklch(98% 0.006 160);
  --color-event-ink: oklch(20% 0.02 160);
  --color-event-rule: oklch(86% 0.014 160);
  --color-event-accent: oklch(47% 0.13 160);
  --color-event-accent-ink: oklch(98% 0.006 160);
  --color-event-focus: oklch(42% 0.15 160);
  --font-event-display: "Trebuchet MS", ui-sans-serif, sans-serif;
  --font-event-body: ui-sans-serif, system-ui, sans-serif;
  --space-event-md: 1rem;
  --ease-event-out: cubic-bezier(0.16, 1, 0.3, 1);
  --radius-event-control: 0.5rem;
}
```

### Tailwind v4 `@theme`

```css
@theme {
  --color-event-paper: oklch(98% 0.006 160);
  --color-event-ink: oklch(20% 0.02 160);
  --color-event-rule: oklch(86% 0.014 160);
  --color-event-accent: oklch(47% 0.13 160);
  --color-event-focus: oklch(42% 0.15 160);
  --font-event-display: "Trebuchet MS", ui-sans-serif, sans-serif;
  --font-event-body: ui-sans-serif, system-ui, sans-serif;
  --spacing-event-md: 1rem;
  --radius-event-control: 0.5rem;
}
```

### DTCG `tokens.json`

```json
{
  "color": {
    "event-paper": { "$value": "oklch(98% 0.006 160)", "$type": "color" },
    "event-ink": { "$value": "oklch(20% 0.02 160)", "$type": "color" },
    "event-accent": { "$value": "oklch(47% 0.13 160)", "$type": "color" }
  },
  "font": { "event-body": { "$value": "ui-sans-serif, system-ui, sans-serif", "$type": "fontFamily" } },
  "space": { "event-md": { "$value": "1rem", "$type": "dimension" } }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: 98% 0.006 160;
  --foreground: 20% 0.02 160;
  --primary: 47% 0.13 160;
  --primary-foreground: 98% 0.006 160;
  --border: 86% 0.014 160;
  --input: 86% 0.014 160;
  --ring: 42% 0.15 160;
  --radius: 0.5rem;
}
```
