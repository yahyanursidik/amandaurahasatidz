# Keputusan Terbuka, Analisis Risiko, dan Evaluasi Dokumen

Dokumen ini mendokumentasikan keputusan arsitektur yang belum final (*open decisions*), analisis risiko teknis, serta evaluasi potensi konflik atau kekurangan pada dokumen spesifikasi **Sistem Informasi Daurah Asatidz YTS**.

---

## 1. Keputusan Terbuka (Open Decisions)

### A. Provider Authentication (ADR-007)
- **Status**: *Open / Under Review*
- **Konteks**: Dokumen menyenaraikan Better Auth atau solusi lain berbasis PostgreSQL.
- **Tantangan**: Solusi autentikasi harus dapat berjalan dengan lancar di lingkungan Netlify Serverless Functions tanpa menimbulkan ketersambungan stateful yang berat.
- **Rekomendasi Baseline**: Untuk Fase 1, gunakan Session-Based Tokens yang dikelola secara aman via PostgreSQL + HTTP-Only Cookies via Netlify Functions backend.

### B. Transactional Email Provider (ADR-008)
- **Status**: *Open / Under Review*
- **Konteks**: Pilihan awal merujuk ke Resend atau provider setara.
- **Kriteria Wajib**: Dukungan webhook signature, DKIM/SPF domain verification, delivery event callback, dan reputasi IP yang baik untuk wilayah Indonesia.

### C. Status Package BeUI & Hallmark (ADR-009) — [UNRESOLVED]
- **Status**: **UNRESOLVED**
- **Analisis & Keputusan Agent**:
  > [!WARNING]
  > URL repository privat, registri NPM, maupun lisensi resmi untuk paket bernama "BeUI" dan "Hallmark" **belum terverifikasi / tidak ditemukan dalam spesifikasi**.
  > Sesuai instruksi pengembangan, agent **TIDAK MENGARANG** isi atau keberadaan package ini.
- **Mitigasi**:
  - Seluruh komponen UI pada MVP dibangun 100% menggunakan **shadcn/ui** + **Tailwind CSS** sebagai fondasi UI resmi yang teruji.
  - Pola visual khusus BeUI/Hallmark hanya akan diadopsi secara manual setelah URL package/repository resmi dikonfirmasi oleh pemilik produk.

---

## 2. Identifikasi Risiko Teknis & Konflik Dokumen

### A. Potensi Race Condition pada Serverless Email Queue
- **Risiko**: Karena Netlify Scheduled Functions berjalan secara asinkron di lingkungan serverless, beberapa eksekusi cron yang berurutan cepat dapat mencoba mengambil baris `email_jobs` yang sama.
- **Mitigasi**: Pengambilan batch email job **wajib** menggunakan query update atomic dengan klausa locking (`UPDATE email_jobs SET status = 'PROCESSING', locked_at = now() WHERE ... RETURNING ...`).

### B. Batas Persepsi Konfirmasi Lembaga vs Kehadiran Peserta
- **Konflik Potensial**: Sering kali konfirmasi hadir dari lembaga disalahartikan sebagai data kehadiran fisik di lokasi.
- **Penegasan Sistem**: Dokumen PRD dan Schema menegaskan bahwa `invitation_responses` (konfirmasi niat hadir) dan `attendance_records` (scan kehadiran fisik di lokasi) adalah 2 entitas terpisah. Kehadiran fisik **hanya** sah jika ada record di `attendance_records`.

### C. Token Hash pada Link Undangan Publik vs Usability
- **Risiko**: Token acak yang terlalu panjang memudahkan penyebaran tidak sah jika dikirim via pesan terbuka, namun token pendek berisiko brute-force.
- **Mitigasi**: Gunakan token 128-bit entropy (disimpan sebagai SHA-256 hash di database), disertai Rate Limiting dan Captcha (Turnstile) pada endpoint verifikasi publik.

### D. Penanganan Profil Duplikat Asatidz Lintas Event
- **Risiko**: Satu ustadz terdaftar oleh dua lembaga berbeda dengan ejaan nama atau nomor telepon yang sedikit bervariasi.
- **Mitigasi**: Gunakan algoritma normalisasi nama (`normalized_name`) dan matching email/phone saat perwakilan lembaga mengisi formulir delegasi, dengan memberikan *warning* sebelum data disimpan.
