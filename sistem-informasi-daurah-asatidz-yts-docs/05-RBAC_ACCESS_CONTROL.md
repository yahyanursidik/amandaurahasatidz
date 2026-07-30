# RBAC dan Access Control

## 1. Prinsip

Sistem menggunakan kombinasi:

- Role-based access control.
- Event scope.
- Institution scope.
- Ownership.
- State-based permission.

Frontend hanya membantu UX. Otorisasi final selalu dilakukan pada backend.

## 2. Role

### Global

- `SUPER_ADMIN`
- `SYSTEM_ADMIN`
- `DATA_STEWARD`
- `REPORT_VIEWER`

### Event Scoped

- `EVENT_ADMIN`
- `COMMITTEE_LEAD`
- `REGISTRATION_OFFICER`
- `CHECKIN_OFFICER`
- `INFORMATION_OFFICER`
- `EVENT_VIEWER`

### External

- `USTADZ`
- `INSTITUTION_REPRESENTATIVE`

## 3. Permission Code

```text
events.read
events.create
events.update
events.publish
events.cancel
events.archive

institutions.read
institutions.create
institutions.update
institutions.merge

ustadz.read
ustadz.create
ustadz.update
ustadz.merge

invitations.read
invitations.create
invitations.send
invitations.revoke

participants.read
participants.create
participants.update
participants.approve
participants.waitlist
participants.cancel
participants.replace
participants.export

schedule.read
schedule.manage

announcements.read
announcements.manage
announcements.publish

attendance.read
attendance.record
attendance.correct
attendance.export

email.read
email.manage_templates
email.send
email.retry

users.read
users.manage
roles.manage

reports.read
reports.export

audit.read
settings.manage
```

## 4. Matriks Ringkas

| Aksi | Super Admin | Event Admin | Panitia Check-in | Ustadz | Perwakilan |
|---|---:|---:|---:|---:|---:|
| Membuat event | Ya | Tidak/default | Tidak | Tidak | Tidak |
| Mengelola event yang ditugaskan | Ya | Ya | Tidak | Tidak | Tidak |
| Melihat peserta event | Ya | Ya | Terbatas | Diri sendiri | Lembaga sendiri |
| Menyetujui peserta | Ya | Ya | Tidak | Tidak | Tidak |
| Check-in peserta | Ya | Ya | Ya | Self bila diaktifkan | Tidak |
| Koreksi kehadiran | Ya | Sesuai izin | Terbatas | Tidak | Tidak |
| Melihat audit log | Ya | Event sendiri | Tidak | Tidak | Tidak |
| Mengubah profil ustadz | Ya | Terbatas | Tidak | Diri sendiri | Saat daftar delegasi |
| Mengubah peserta lembaga | Ya | Ya | Tidak | Tidak | Sampai final/deadline |

## 5. Event Scope

Contoh assignment:

```json
{
  "user_id": "uuid",
  "role": "CHECKIN_OFFICER",
  "event_id": "uuid",
  "starts_at": "2026-08-01T00:00:00Z",
  "ends_at": "2026-08-05T23:59:59Z"
}
```

Permission efektif:

```text
role permission
AND assignment aktif
AND event_id request sesuai
AND resource berada pada event tersebut
```

## 6. Institution Scope

Perwakilan hanya boleh:

- Membaca lembaga yang terhubung.
- Membaca undangan lembaga tersebut.
- Mengelola peserta pada undangan tersebut.
- Tidak membaca catatan internal admin.
- Tidak mengubah master lembaga setelah konfirmasi final, kecuali field yang diizinkan.
- Tidak melihat peserta lembaga lain.

## 7. Ownership Ustadz

Ustadz hanya boleh:

- Membaca profilnya.
- Mengusulkan perubahan profilnya.
- Melihat event yang terkait dengannya.
- Melihat QR miliknya.
- Melihat kehadirannya.
- Melakukan konfirmasi miliknya.
- Tidak mengubah approval status.
- Tidak melihat catatan internal.

## 8. State-Based Rules

Contoh:

- Event `ARCHIVED`: hanya read.
- Invitation `REVOKED`: token tidak dapat dipakai.
- Institution response `FINAL_CONFIRMED`: peserta terkunci kecuali reopened.
- Participant `CANCELLED`: tidak dapat check-in.
- Session di luar jendela check-in: ditolak kecuali override petugas.
- Attendance yang sudah dikoreksi: koreksi berikutnya hanya role lebih tinggi.

## 9. Access Control Provider Refine

Access control provider menerima:

```ts
can({
  resource: "participants",
  action: "approve",
  params: { eventId, participantId }
})
```

Provider frontend memanggil endpoint permission summary atau menggunakan claims session yang aman. Backend tetap memeriksa ulang.

## 10. Audit Akses

Catat:

- Export peserta.
- Export kehadiran.
- Pembukaan kembali form.
- Revoke invitation.
- Merge profil.
- Koreksi attendance.
- Perubahan role.
- Perubahan template email.
- Akses data sensitif oleh role khusus.
