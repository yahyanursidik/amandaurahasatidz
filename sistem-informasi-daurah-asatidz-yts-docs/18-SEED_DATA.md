# Seed Data

## 1. Tujuan

Seed data dipakai untuk:

- Development.
- Demo.
- Automated test.
- Simulasi daurah.
- Pelatihan panitia.

Tidak menggunakan data pribadi nyata pada development.

## 2. Role

```text
SUPER_ADMIN
SYSTEM_ADMIN
DATA_STEWARD
EVENT_ADMIN
COMMITTEE_LEAD
REGISTRATION_OFFICER
CHECKIN_OFFICER
INFORMATION_OFFICER
EVENT_VIEWER
USTADZ
INSTITUTION_REPRESENTATIVE
```

## 3. Akun Demo

```text
admin@example.test
event-admin@example.test
checkin@example.test
information@example.test
ustadz1@example.test
representative@example.test
```

Password hanya untuk environment demo lokal dan tidak digunakan pada production.

## 4. Lembaga Demo

- Ma'had Ilmu Sunnah Bandung.
- Yayasan Dakwah Al-Hikmah Cimahi.
- Rumah Qur'an As-Salam Garut.
- Pesantren An-Nur Sumedang.
- Komunitas Asatidz Priangan.

## 5. Asatidz Demo

Buat minimal 30 profil dengan variasi:

- Memiliki satu lembaga.
- Memiliki dua afiliasi.
- Tanpa user login.
- Sudah memiliki user login.
- Email sama untuk menguji duplicate warning.
- Nama mirip.
- Nomor telepon berbeda format.
- Domisili berbeda.

## 6. Event Demo

```text
Nama: Daurah Asatidz YTS 2026
Kode: DAYTS-2026-01
Mode: HYBRID
Attendance: DAILY_AND_SESSION
Tanggal: 14–15 Agustus 2026
Timezone: Asia/Jakarta
Capacity: 300
```

## 7. Sesi Demo

Hari 1:

- Registrasi.
- Pembukaan.
- Materi 1.
- Istirahat.
- Materi 2.
- Diskusi.

Hari 2:

- Registrasi hari kedua.
- Materi 3.
- Materi 4.
- Penutupan.

## 8. Invitation Cases

- Lembaga belum membuka.
- Lembaga sudah membuka.
- Lembaga menyimpan draft.
- Lembaga final confirmed.
- Lembaga menolak.
- Undangan expired.
- Undangan revoked.
- Email bounced.

## 9. Participant Cases

- Approved.
- Pending.
- Waitlisted.
- Declined.
- Cancelled.
- Replaced.
- Delegation lead.
- Individual invitation.
- Open registration.

## 10. Attendance Cases

- Hadir semua sesi.
- Hadir hari pertama saja.
- Hadir terlambat.
- Izin.
- Tidak hadir.
- Check-in ganda.
- Koreksi manual.
