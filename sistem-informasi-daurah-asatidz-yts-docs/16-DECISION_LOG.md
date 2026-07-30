# Decision Log

## Format ADR Ringkas

```markdown
## ADR-XXX — Judul

- Status:
- Tanggal:
- Pemilik:
- Konteks:
- Keputusan:
- Konsekuensi:
- Alternatif:
```

## ADR-001 — Modular Monolith

- **Status:** Accepted
- **Tanggal:** 2026-07-30
- **Konteks:** Produk masih MVP tetapi memiliki banyak modul.
- **Keputusan:** Satu frontend, satu backend functions boundary, satu database, modul terpisah secara logis.
- **Konsekuensi:** Operasional sederhana; disiplin batas modul wajib dijaga.
- **Alternatif:** Microservices, tiga frontend terpisah.

## ADR-002 — Satu Aplikasi Tiga Portal

- **Status:** Accepted
- **Tanggal:** 2026-07-30
- **Keputusan:** Route group `/admin`, `/committee`, dan `/portal` dalam satu aplikasi.
- **Konsekuensi:** Komponen dan autentikasi dapat digunakan bersama.

## ADR-003 — Neon Tidak Diakses dari Browser

- **Status:** Accepted
- **Tanggal:** 2026-07-30
- **Keputusan:** Seluruh database access melalui Netlify Functions.
- **Konsekuensi:** API dan authorization layer wajib dibangun.

## ADR-004 — Profil Ustadz sebagai Master Data

- **Status:** Accepted
- **Tanggal:** 2026-07-30
- **Keputusan:** Profil ustadz tidak dibuat per event; afiliasi menggunakan tabel relasi.
- **Konsekuensi:** Dibutuhkan duplicate detection dan merge workflow.

## ADR-005 — Konfirmasi Terpisah dari Attendance

- **Status:** Accepted
- **Tanggal:** 2026-07-30
- **Keputusan:** Respons undangan dan kehadiran merupakan entitas/status berbeda.
- **Konsekuensi:** Laporan dapat menghitung no-show secara akurat.

## ADR-006 — Database-backed Email Queue untuk MVP

- **Status:** Proposed
- **Tanggal:** 2026-07-30
- **Keputusan:** Gunakan `email_jobs` dan Netlify Scheduled/Background Functions.
- **Konsekuensi:** Cukup sederhana untuk MVP, tetapi worker perlu locking dan idempotency.

## ADR-007 — Provider Authentication (Custom Session Engine)

- **Status:** Accepted
- **Tanggal:** 2026-07-30
- **Konteks:** Diperlukan solusi autentikasi yang berjalan aman di Netlify Functions serverless, terintegrasi dengan PostgreSQL (Neon), mendukung Google OAuth & Email OTP, tidak mengunci vendor frontend, dan aman dari XSS/token theft.
- **Keputusan:** Gunakan **Custom PostgreSQL-Backed Session Engine** dengan cookie `yts_session` ber-attribute `HttpOnly`, `Secure`, `SameSite=Lax`. Token utama **tidak pernah** disimpan di `localStorage` frontend. Menerapkan session rotation saat login/verify dan revocation saat logout.
- **Konsekuensi:** Bebas vendor lock-in; memerlukan pengelolaan session token table dan rate-limiter di backend.
- **Alternatif:** Better Auth, Auth0, Clerk, Supabase Auth.

## ADR-008 — Provider Transactional Email

- **Status:** Open
- **Pilihan awal:** Resend atau provider setara.
- **Kriteria:** Webhook, domain verification, delivery status, stabilitas, biaya.

## ADR-009 — BeUI dan Hallmark

- **Status:** Open
- **Pertanyaan:** Package/repository mana yang dimaksud?
- **Keputusan:** Hanya dipakai setelah lisensi, versi, dan overlap dengan shadcn diperiksa.

## ADR-010 — Status Unresolved BeUI & Hallmark dan Baseline UI

- **Status:** Accepted
- **Tanggal:** 2026-07-30
- **Konteks:** Package BeUI dan Hallmark belum terverifikasi registri/repository resminya.
- **Keputusan:** Tandai status BeUI dan Hallmark sebagai UNRESOLVED. Gunakan shadcn/ui + Tailwind CSS sebagai fondasi utama UI untuk seluruh komponen sistem tanpa mengarang package yang belum diverifikasi.
- **Konsekuensi:** Komponen UI dibangun penuh dengan shadcn/ui dan Tailwind CSS; adopsi pola BeUI/Hallmark dilakukan secara manual jika dokumen/package resmi disediakan.

