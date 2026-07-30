# Test Plan

## 1. Piramida Pengujian

- Unit test: business rule dan utility.
- Integration test: service + database.
- API test: handler, auth, validation.
- Component test: form dan interaction.
- End-to-end: alur utama.
- Load test: check-in dan email queue.
- Security test: permission dan token.

## 2. Unit Test Prioritas

- Event state transition.
- Kuota.
- Participant replacement.
- Duplicate matching.
- Attendance late calculation.
- Reminder segment selector.
- Idempotency key.
- Token hashing/verification.
- Timezone conversion.
- Permission evaluation.

## 3. Integration Test Prioritas

- Create invitation + link.
- Final confirmation + participant rows.
- Approve participant + participant code.
- Concurrent check-in.
- Attendance correction + audit.
- Email job locking.
- Webhook idempotency.
- Merge ustadz.

Gunakan database test terisolasi.

## 4. Permission Test

Setiap endpoint sensitif memiliki:

- User tanpa login.
- User role salah.
- User role benar event salah.
- User role benar event benar.
- Assignment expired.
- Resource institution lain.
- Super admin.

## 5. E2E Journey

### Lembaga

1. Email/tautan undangan.
2. Verifikasi.
3. Isi perwakilan.
4. Tambah delegasi.
5. Simpan draft.
6. Buka kembali.
7. Final confirmation.
8. Admin approve.
9. Peserta melihat QR.

### Ustadz Individu

1. Buka undangan.
2. Login/verify.
3. Update profil.
4. Konfirmasi.
5. Lihat jadwal.
6. Check-in.
7. Lihat riwayat.

### Panitia

1. Login.
2. Pilih event.
3. Buka scanner.
4. Scan sukses.
5. Scan ganda.
6. Kode fallback.
7. Koreksi.
8. Lihat summary.

## 6. Load Test

Skenario:

- 300 peserta.
- 10 scanner.
- Burst 20–40 request/detik.
- Scan participant yang sama bersamaan.
- Search nama.
- Dashboard refresh.
- Email queue 2.000 penerima.

Kriteria:

- Tidak ada duplicate attendance.
- Error rate dalam batas.
- Database connections tidak habis.
- Worker tidak mengirim ganda.

## 7. Security Test

- Token brute force/rate limit.
- Expired token.
- Revoked token.
- IDOR event.
- IDOR institution.
- Injection.
- XSS announcement.
- File upload spoofing.
- Webhook signature.
- Session fixation.
- CSRF sesuai arsitektur auth.
- Secret exposure pada build.

## 8. Accessibility Test

- Keyboard.
- Screen reader label.
- Focus order.
- Dialog.
- Error form.
- Contrast.
- Mobile zoom.
- Scanner fallback.

## 9. Regression Checklist Sebelum Event

- Login.
- Event page.
- Participant list.
- Search.
- QR generation.
- QR scan.
- Code check-in.
- Duplicate prevention.
- Attendance report.
- Email reminder.
- Announcement.
- Role petugas.
- Export darurat.
