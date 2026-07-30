# Email dan Automation

## 1. Tujuan

Menyediakan komunikasi yang tepat sasaran, dapat ditelusuri, tidak ganda, dan tidak bergantung pada pengiriman manual panitia.

## 2. Jenis Email

| Code | Waktu |
|---|---|
| `INSTITUTION_INVITATION` | Undangan lembaga dikirim |
| `INDIVIDUAL_INVITATION` | Undangan individu dikirim |
| `EMAIL_VERIFICATION` | Verifikasi perwakilan/peserta |
| `DRAFT_RESUME_LINK` | Melanjutkan formulir |
| `CONFIRMATION_RECEIVED` | Setelah konfirmasi |
| `PARTICIPANT_APPROVED` | Setelah peserta disetujui |
| `PARTICIPANT_WAITLISTED` | Setelah masuk daftar tunggu |
| `PARTICIPANT_DECLINED` | Setelah ditolak |
| `DEADLINE_REMINDER` | Menjelang batas respons |
| `EVENT_H7` | H-7 |
| `EVENT_H3` | H-3 |
| `EVENT_H1` | H-1 |
| `EVENT_TODAY` | Hari pelaksanaan |
| `SCHEDULE_CHANGED` | Jadwal berubah |
| `DAY_TWO_REMINDER` | Daurah berselang hari |
| `THANKS_CONFIRMED` | Ucapan setelah konfirmasi |
| `THANKS_ATTENDED` | Ucapan setelah hadir |
| `EVALUATION_REQUEST` | Survei |
| `EMAIL_FAILURE_ALERT` | Peringatan kepada admin |

## 3. Segmentasi

Reminder dapat menargetkan:

- Undangan belum dibuka.
- Undangan dibuka tetapi belum merespons.
- Lembaga sudah menyatakan hadir tetapi belum mengirim peserta.
- Draft peserta belum difinalkan.
- Peserta menunggu persetujuan.
- Peserta sudah disetujui.
- Peserta hadir pada hari sebelumnya.
- Peserta belum check-in pada sesi wajib.
- Peserta yang benar-benar hadir untuk ucapan terima kasih.

## 4. Queue

Status:

```text
QUEUED
PROCESSING
SENT
FAILED
CANCELLED
DEAD_LETTER
```

Worker mengambil batch menggunakan pola lock:

1. Pilih job `QUEUED` dengan `scheduled_at <= now()`.
2. Lock row atau update atomik menjadi `PROCESSING`.
3. Tambahkan `locked_at` dan `locked_by`.
4. Kirim email.
5. Simpan provider message ID.
6. Ubah `SENT` atau `FAILED`.
7. Retry berdasarkan kebijakan.

## 5. Idempotency Key

Contoh:

```text
event:{eventId}:template:{templateCode}:recipient:{email}:context:{contextId}
```

Satu key hanya boleh menghasilkan satu job aktif/terkirim.

## 6. Retry

Rekomendasi awal:

- Attempt 1: langsung.
- Attempt 2: +5 menit.
- Attempt 3: +30 menit.
- Attempt 4: +2 jam.
- Attempt 5: +12 jam.
- Setelah itu: `DEAD_LETTER`.

Jangan retry:

- Email invalid permanen.
- Hard bounce.
- Complaint.
- Invitation revoked.
- Penerima opt-out dari jenis komunikasi opsional.

## 7. Scheduled Functions

Scheduled Function tidak mengirim ribuan email langsung. Tugasnya:

- Membuat job reminder berdasarkan aturan.
- Mengambil batch kecil.
- Memicu background worker bila tersedia.
- Menandai health check.

Cron Netlify menggunakan UTC. Semua jadwal event harus dikonversi dari `event.timezone` ke UTC ketika job dibuat.

## 8. Webhook

Webhook provider:

- Diverifikasi menggunakan signature.
- Disimpan idempotent berdasarkan provider event ID.
- Tidak mempercayai payload sebelum verification.
- Memperbarui `email_deliveries`.
- Menangani out-of-order event.

Status:

```text
ACCEPTED
SENT
DELIVERED
OPENED
BOUNCED
COMPLAINED
FAILED
```

`OPENED` bersifat indikatif dan tidak boleh dijadikan bukti mutlak bahwa penerima membaca email.

## 9. Template

Template menggunakan variable yang di-whitelist:

```text
{{recipient_name}}
{{institution_name}}
{{event_name}}
{{event_date}}
{{venue_name}}
{{response_deadline}}
{{invitation_url}}
{{participant_qr_url}}
{{committee_contact}}
```

Dilarang melakukan evaluasi kode dinamis pada template.

## 10. Ucapan Terima Kasih

### Setelah Konfirmasi

Trigger:

- Lembaga melakukan final confirmation.
- Ustadz individu melakukan konfirmasi hadir atau tidak hadir.

Konten menyesuaikan respons.

### Setelah Hadir

Trigger:

- Event selesai.
- Peserta memiliki setidaknya satu attendance valid.
- Dapat dibatasi pada peserta yang memenuhi persentase kehadiran tertentu.

## 11. Pengiriman Manual

Admin dapat mengirim ulang, tetapi:

- Sistem menampilkan pengiriman sebelumnya.
- Alasan pengiriman ulang dicatat.
- Dapat menggunakan idempotency override khusus.
- Tidak mengirim kepada hard-bounce tanpa koreksi alamat.

## 12. Deliverability

- Gunakan domain YTS.
- SPF, DKIM, dan DMARC.
- From name konsisten.
- Reply-to aktif.
- Hindari lampiran besar; gunakan tautan aman.
- Pantau bounce dan complaint.
- Pisahkan email transactional dari newsletter massal.
