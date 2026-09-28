# Perbaikan HTTP 500 ketika membuat event

Pada 28 September 2026, database `DaurahAsatidz / production / neondb` tertinggal dari skema kode: `events.regular_quota`, `events.invitation_quota`, `event_participants.public_group_id`, dan `event_announcements.target_institution_id` belum tersedia. GET `/api/v1/events` dan POST pembuatan event mengembalikan 500. Migrasi setara `drizzle/0007_busy_thunderbolt.sql` dan `drizzle/0008_superb_excalibur.sql` telah diuji di cabang sementara dan diterapkan ke cabang utama setelah persetujuan pengguna.

Untuk lingkungan database lain yang mengalami kesalahan sama, jalankan `npm run db:migrate:program-registration` dengan `DATABASE_MIGRATION_URL` atau `DATABASE_URL` yang benar setelah memeriksa target database. Skrip bersifat idempoten dan memverifikasi empat kolom. Versi API sekarang memberi respons `DATABASE_SCHEMA_OUTDATED` (503) saat menemukan kolom/tabel yang tertinggal, menggantikan respons 500 generik.

Peringatan React DevTools dan React Router di console bukan penyebab penyimpanan event gagal. Future flags React Router telah diaktifkan agar peringatannya tidak mengaburkan kesalahan API.
