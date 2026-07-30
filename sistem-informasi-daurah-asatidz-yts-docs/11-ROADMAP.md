# Roadmap Pengembangan

## Fase 0 — Discovery dan Keputusan

Output:

- Istilah dan status final.
- User journey.
- Wireframe.
- ERD.
- Keputusan auth.
- Keputusan email.
- Keputusan storage.
- Data privacy policy.
- Event pertama untuk pilot.
- Daftar komponen BeUI/Hallmark yang benar-benar dipakai.

Exit criteria:

- PRD disetujui.
- Scope MVP terkunci.
- Tidak ada keputusan teknis kritis yang menggantung.

## Fase 1 — Foundation

Pekerjaan:

- Repository.
- Vite + React + TypeScript.
- Refine.
- shadcn/ui.
- Design tokens.
- Routing tiga portal.
- Netlify deployment.
- Neon development database.
- Drizzle schema dan migration.
- Authentication.
- RBAC dan event scope.
- Audit log.
- Error handling.
- Observability dasar.

Exit criteria:

- Login berfungsi.
- Role global dan event diuji.
- Preview deployment tersedia.
- Migration otomatis terkendali.

## Fase 2 — Master Data

Pekerjaan:

- CRUD lembaga.
- Perwakilan lembaga.
- CRUD asatidz.
- Afiliasi.
- Search dan filter.
- Duplicate candidate.
- Merge workflow.
- Import awal dari spreadsheet bila diperlukan.

Exit criteria:

- Admin dapat mengelola data tanpa duplikasi mudah.
- Riwayat merge tersimpan.

## Fase 3 — Event dan Jadwal

Pekerjaan:

- CRUD event.
- Hari.
- Sesi.
- Lokasi.
- Panitia dan assignment.
- Status transition.
- Halaman informasi publik.
- Kalender kegiatan.

Exit criteria:

- Satu event multi-hari dapat dikonfigurasi lengkap.

## Fase 4 — Invitation dan Registration

Pekerjaan:

- Undangan lembaga.
- Undangan individu.
- Link/token unik.
- Form perwakilan.
- Delegasi.
- Draft.
- Final confirmation.
- Approval.
- Waitlist.
- Cancel.
- Replacement.

Exit criteria:

- Satu lembaga dapat menyelesaikan proses dari email hingga daftar final.

## Fase 5 — Email dan Announcement

Pekerjaan:

- Template.
- Queue.
- Worker.
- Scheduled reminder.
- Webhook.
- Delivery log.
- Pengumuman.
- Ucapan terima kasih.

Exit criteria:

- Pengiriman tidak ganda.
- Bounce terlihat admin.
- Reminder berdasarkan segmentasi.

## Fase 6 — Check-in dan Attendance

Pekerjaan:

- QR peserta.
- Kode.
- Scanner.
- Session active.
- Attendance harian/sesi.
- Duplicate prevention.
- Late.
- Correction.
- On-site dashboard.

Exit criteria:

- Simulasi kedatangan peserta lulus.
- Dua scan bersamaan tidak membuat data ganda.

## Fase 7 — Reporting dan Stabilization

Pekerjaan:

- Dashboard.
- Laporan.
- Export.
- Security test.
- Load test.
- Accessibility.
- Backup/restore test.
- Dokumentasi admin/panitia.
- Training.
- Pilot event.

Exit criteria:

- Acceptance criteria MVP terpenuhi.
- Runbook event tersedia.
- Pilot selesai dan feedback tercatat.

## Fase 8 — Pengembangan Lanjutan

- Sertifikat.
- Evaluasi.
- WhatsApp.
- Konsumsi.
- Akomodasi.
- Offline queue.
- CRM segmentation.
- Multi-organizer.
- API integrasi eksternal.
