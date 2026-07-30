# Prompt Log

Dokumen ini mencatat instruksi penting yang diberikan kepada coding agent agar keputusan dan perubahan dapat ditelusuri.

## Format

```markdown
## YYYY-MM-DD — Judul

### Tujuan
...

### Instruksi
...

### Batasan
...

### Output yang Diharapkan
...

### Hasil
...

### File Berubah
...

### Keputusan/Risiko
...
```

## 2026-07-30 — Inisialisasi Dokumentasi

### Tujuan

Membuat fondasi Sistem Informasi Daurah Asatidz YTS.

### Instruksi

- Mendukung multi-event.
- Undangan lembaga dan individu.
- Master data asatidz dan lembaga.
- Link unik per lembaga.
- Tiga portal.
- Email, reminder, jadwal, pengumuman.
- QR, kode, dan absensi per hari/sesi.
- Stack Refine, shadcn/ui, BeUI, Hallmark, Vite, Neon, dan Netlify.

### Batasan

- Tidak membuat microservices pada MVP.
- Tidak mengakses database langsung dari frontend.
- Konfirmasi dan kehadiran harus berbeda.
- Afiliasi ustadz dan lembaga menggunakan relasi.

### Output yang Diharapkan

Dokumentasi implementasi dan roadmap.

### Hasil

Paket dokumentasi versi `0.1.0`.
