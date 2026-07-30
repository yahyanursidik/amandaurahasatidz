# Deployment dan Operasional

## 1. Environment

```text
local
development
preview
staging
production
```

Minimum praktis:

- Local.
- Preview per pull request.
- Production.

Untuk event penting, staging sangat disarankan.

## 2. Database Branch

- Development branch.
- Preview branch atau disposable branch.
- Staging branch.
- Production branch.

Migration:

1. Dibuat dalam PR.
2. Diuji pada development.
3. Diuji pada staging/preview.
4. Backup/restore plan ditinjau.
5. Dijalankan production melalui proses terkendali.
6. Tidak menjalankan destructive migration tanpa langkah dua tahap.

## 3. Netlify

Konfigurasi minimal:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"
```

Scheduled jobs ditetapkan di konfigurasi atau function config dan selalu ditulis dengan asumsi UTC.

## 4. Preview Deployment

Preview tidak boleh:

- Menggunakan database production.
- Mengirim email ke penerima nyata tanpa allowlist.
- Mengakses bucket production.
- Menggunakan OAuth callback production.

Gunakan email sink atau allowlist developer.

## 5. CI

Pipeline:

1. Install locked dependencies.
2. Typecheck.
3. Lint.
4. Unit test.
5. Build.
6. Migration validation.
7. Integration test.
8. Dependency/security check.
9. Preview deploy.

## 6. Release

- Semantic version internal.
- Changelog.
- Migration note.
- Feature flag bila berisiko.
- Rollback plan.
- Smoke test.
- Approval product owner untuk perubahan besar.

## 7. Monitoring

Pantau:

- Error rate.
- Function duration.
- Database connections.
- Slow queries.
- Email failure.
- Webhook failure.
- Check-in failure.
- Login failure.
- Scheduled job health.
- Storage failure.

## 8. Runbook Hari Acara

Sebelum acara:

- Freeze perubahan schema.
- Pastikan daftar peserta terbaru.
- Uji scanner seluruh perangkat.
- Uji jaringan lokasi.
- Siapkan charger/power bank.
- Export daftar darurat.
- Pastikan sesi dan jendela check-in.
- Pastikan petugas mendapat role.
- Pastikan QR dan kode peserta terkirim.
- Uji satu akun peserta.

Saat acara:

- Buka dashboard on-site.
- Monitor error.
- Catat kejadian manual.
- Jangan mengubah data master tanpa kebutuhan.
- Gunakan correction workflow.

Setelah acara:

- Tutup check-in.
- Rekonsiliasi data manual.
- Review duplicate/correction.
- Generate laporan.
- Kirim ucapan terima kasih.
- Cabut akses panitia sementara.
- Post-event review.

## 9. Backup Darurat

Sebelum event:

- Export participant list.
- Export participant code.
- Export institution mapping.
- Print/unduh daftar sesi.
- Pastikan file tersimpan aman dan hanya dipegang PIC.

Setelah dipakai, file darurat harus dihapus sesuai SOP.
