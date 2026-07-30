# API Specification

## 1. Konvensi

Base path:

```text
/api/v1
```

Format:

```json
{
  "data": {},
  "meta": {},
  "error": null,
  "requestId": "req_xxx"
}
```

Error:

```json
{
  "data": null,
  "meta": null,
  "error": {
    "code": "PARTICIPANT_ALREADY_CHECKED_IN",
    "message": "Peserta sudah melakukan check-in.",
    "details": {}
  },
  "requestId": "req_xxx"
}
```

## 2. HTTP Status

- `200` berhasil.
- `201` dibuat.
- `204` berhasil tanpa body.
- `400` payload atau business input tidak valid.
- `401` belum terautentikasi.
- `403` tidak berhak.
- `404` resource tidak ditemukan dalam scope pengguna.
- `409` konflik status atau duplicate.
- `422` validasi field.
- `429` rate limited.
- `500` kesalahan internal.
- `503` integrasi sementara tidak tersedia.

## 3. Pagination

Query:

```text
?page=1&pageSize=25&sort=-createdAt&filter[status]=APPROVED
```

Response meta:

```json
{
  "page": 1,
  "pageSize": 25,
  "total": 248,
  "pageCount": 10
}
```

## 4. Idempotency

Header:

```text
Idempotency-Key: uuid
```

Wajib untuk:

- Final submit undangan.
- Approve participant.
- Check-in.
- Pengiriman email manual.
- Replacement.
- Webhook processing.

## 5. Endpoint Authentication

```text
POST /auth/google/start
GET  /auth/google/callback
POST /auth/magic-link
POST /auth/email-otp/request
POST /auth/email-otp/verify
POST /auth/logout
GET  /auth/session
```

## 6. Events

```text
GET    /events
POST   /events
GET    /events/:eventId
PATCH  /events/:eventId
POST   /events/:eventId/publish
POST   /events/:eventId/open-registration
POST   /events/:eventId/close-registration
POST   /events/:eventId/start
POST   /events/:eventId/complete
POST   /events/:eventId/archive
```

## 7. Event Days dan Sessions

```text
GET    /events/:eventId/days
POST   /events/:eventId/days
PATCH  /events/:eventId/days/:dayId
DELETE /events/:eventId/days/:dayId

GET    /events/:eventId/sessions
POST   /events/:eventId/sessions
PATCH  /events/:eventId/sessions/:sessionId
DELETE /events/:eventId/sessions/:sessionId
POST   /events/:eventId/sessions/reorder
```

## 8. Institutions

```text
GET   /institutions
POST  /institutions
GET   /institutions/:institutionId
PATCH /institutions/:institutionId
GET   /institutions/:institutionId/history
GET   /institutions/:institutionId/representatives
POST  /institutions/:institutionId/representatives
```

## 9. Ustadz

```text
GET   /ustadz
POST  /ustadz
GET   /ustadz/:ustadzId
PATCH /ustadz/:ustadzId
GET   /ustadz/:ustadzId/affiliations
POST  /ustadz/:ustadzId/affiliations
POST  /ustadz/duplicate-candidates
POST  /ustadz/merge
```

## 10. Invitations

```text
GET   /events/:eventId/invitations
POST  /events/:eventId/invitations/institution
POST  /events/:eventId/invitations/individual
GET   /events/:eventId/invitations/:invitationId
PATCH /events/:eventId/invitations/:invitationId
POST  /events/:eventId/invitations/:invitationId/send
POST  /events/:eventId/invitations/:invitationId/resend
POST  /events/:eventId/invitations/:invitationId/revoke
POST  /events/:eventId/invitations/:invitationId/reopen
```

## 11. Public Invitation

```text
GET  /public/invitations/:token
POST /public/invitations/:token/verify-email
PUT  /public/invitations/:token/representative
GET  /public/invitations/:token/participants
POST /public/invitations/:token/participants
PATCH /public/invitations/:token/participants/:participantId
DELETE /public/invitations/:token/participants/:participantId
POST /public/invitations/:token/submit
```

Proteksi:

- Token hash.
- Rate limit.
- Captcha pada aksi berisiko.
- Verifikasi email.
- Response tidak membocorkan ID internal yang tidak perlu.

## 12. Participants

```text
GET   /events/:eventId/participants
POST  /events/:eventId/participants
GET   /events/:eventId/participants/:participantId
PATCH /events/:eventId/participants/:participantId
POST  /events/:eventId/participants/:participantId/approve
POST  /events/:eventId/participants/:participantId/waitlist
POST  /events/:eventId/participants/:participantId/decline
POST  /events/:eventId/participants/:participantId/cancel
POST  /events/:eventId/participants/:participantId/replace
POST  /events/:eventId/participants/bulk-approve
```

## 13. Schedule dan Announcements

```text
GET  /events/:eventId/schedule
GET  /events/:eventId/announcements
POST /events/:eventId/announcements
PATCH /events/:eventId/announcements/:announcementId
POST /events/:eventId/announcements/:announcementId/publish
POST /events/:eventId/announcements/:announcementId/unpublish
```

## 14. Check-in

```text
POST /events/:eventId/checkin/scan-participant
POST /events/:eventId/checkin/by-code
POST /events/:eventId/checkin/self
POST /events/:eventId/checkin/tokens
POST /events/:eventId/checkin/tokens/:tokenId/revoke
GET  /events/:eventId/checkin/recent
```

Request:

```json
{
  "participantToken": "opaque-token",
  "sessionId": "uuid",
  "method": "PARTICIPANT_QR"
}
```

Response:

```json
{
  "data": {
    "result": "SUCCESS",
    "participant": {
      "displayName": "Nama Ustadz",
      "institutionName": "Nama Lembaga"
    },
    "attendance": {
      "status": "PRESENT",
      "checkinAt": "2026-08-01T01:05:00Z"
    }
  }
}
```

## 15. Attendance

```text
GET   /events/:eventId/attendance
GET   /events/:eventId/attendance/summary
POST  /events/:eventId/attendance/manual
POST  /events/:eventId/attendance/:attendanceId/correct
POST  /events/:eventId/attendance/bulk-mark
GET   /events/:eventId/attendance/export
```

## 16. Email

```text
GET  /events/:eventId/email/jobs
POST /events/:eventId/email/send-invitations
POST /events/:eventId/email/send-reminder
POST /events/:eventId/email/jobs/:jobId/retry
POST /webhooks/email/:provider
```

## 17. Portal Ustadz

```text
GET   /me/profile
PATCH /me/profile
GET   /me/invitations
POST  /me/invitations/:invitationId/respond
GET   /me/events
GET   /me/events/:eventId/schedule
GET   /me/events/:eventId/qr
GET   /me/events/:eventId/attendance
GET   /me/announcements
```

## 18. Reports

```text
GET /events/:eventId/reports/invitations
GET /events/:eventId/reports/participants
GET /events/:eventId/reports/attendance
GET /reports/network
POST /reports/exports
GET /reports/exports/:exportId
```

## 19. Validation

Semua request:

- Schema Zod.
- Unknown field ditolak pada endpoint command.
- Normalisasi email dan nomor telepon.
- Tanggal divalidasi terhadap timezone event.
- Enum hanya menerima nilai yang disetujui.
- String HTML dibersihkan sesuai konteks.
