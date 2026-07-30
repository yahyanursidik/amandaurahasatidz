# Stack dan Keputusan Teknologi

## 1. Tujuan Dokumen

Dokumen ini menetapkan teknologi yang digunakan, batas tanggung jawab tiap komponen, dan aturan penambahan dependensi.

## 2. Stack Disepakati

### Frontend

- React.
- TypeScript strict mode.
- Vite.
- React Router.
- `@refinedev/core@5.0.12`.
- TanStack Query 5.
- shadcn/ui.
- Tailwind CSS.
- BeUI.
- Hallmark.
- React Hook Form.
- Zod.
- date-fns.
- TanStack Table bila diperlukan.
- Library QR scanner yang mendukung browser modern.
- Library QR generator.

### Backend

- Netlify Functions.
- TypeScript.
- REST API internal.
- Drizzle ORM.
- Neon Serverless Driver.
- Zod.
- Structured logging.
- Transactional email provider.
- Object storage S3-compatible.

### Database

- Neon PostgreSQL.
- Migration menggunakan Drizzle Kit.
- Pooled connection untuk request aplikasi.
- Direct/unpooled connection untuk migration bila diperlukan.
- Branch database terpisah untuk development, preview/staging, dan production.

### Hosting

- Netlify untuk frontend dan functions.
- Neon untuk PostgreSQL.
- Object storage eksternal untuk file.
- Transactional email provider untuk email.

## 3. Peran Refine

Refine dipakai sebagai fondasi aplikasi data-intensive dan bukan sebagai library UI.

Refine mengatur:

- Resource.
- Data provider.
- Auth provider.
- Access control provider.
- Routing integration.
- Query dan mutation lifecycle.
- Notification provider.
- Audit-friendly action flow.

Refine tidak boleh:

- Mengakses database langsung dari browser.
- Menentukan permission hanya di frontend.
- Menggantikan service layer backend.
- Menjadi tempat business rule kompleks.

## 4. Peran shadcn/ui

shadcn/ui menjadi sumber komponen dasar yang dimiliki oleh codebase:

- Button.
- Input.
- Select.
- Dialog.
- Sheet.
- Dropdown.
- Form primitives.
- Table primitives.
- Tabs.
- Badge.
- Alert.
- Toast.
- Command menu.

Komponen hasil instalasi dapat dimodifikasi sesuai design system YTS.

## 5. Peran BeUI dan Hallmark

Sebelum digunakan, tim wajib mencatat:

```text
Nama paket:
Repository:
Versi:
Lisensi:
Kompatibilitas React:
Kompatibilitas Tailwind:
Komponen yang akan dipakai:
Alasan pemakaian:
Alternatif shadcn yang tersedia:
```

Aturan:

1. BeUI dan Hallmark hanya dipakai untuk komponen atau pola yang benar-benar dibutuhkan.
2. Tidak boleh ada tiga library untuk satu primitive yang sama.
3. Semua komponen harus mengikuti design token proyek.
4. Tidak boleh menambahkan library dengan lisensi tidak jelas.
5. Komponen yang sulit diuji atau tidak aksesibel harus diganti.
6. Jika nama “BeUI” atau “Hallmark” merujuk pada registry privat, URL dan prosedur instalasinya wajib didokumentasikan.

## 6. Database Access

Browser tidak boleh menerima `DATABASE_URL`.

Pola akses:

```text
Browser
  -> Netlify Function API
      -> Service
          -> Repository/Drizzle
              -> Neon PostgreSQL
```

Gunakan:

- HTTP driver untuk query singkat dan non-interaktif.
- Pool/transaction-compatible mode untuk transaksi yang memerlukan beberapa operasi.
- Pooled Neon connection string untuk workload serverless.
- Separate migration connection bila tool migration mensyaratkannya.

## 7. Authentication

Kriteria solusi autentikasi:

- Mendukung PostgreSQL.
- Mendukung Google OAuth.
- Mendukung magic link atau OTP email.
- Session aman menggunakan cookie `HttpOnly`.
- Mendukung role internal.
- Dapat bekerja di Netlify Functions.
- Tidak mengunci produk pada vendor frontend tertentu.

Keputusan final provider dicatat pada `16-DECISION_LOG.md`.

## 8. Email

Kriteria provider:

- Transactional email.
- Domain verification.
- API yang stabil.
- Webhook delivery.
- Bounce dan complaint event.
- Idempotency atau dukungan deduplikasi.
- Template dapat dikelola dalam repository.
- Dukungan region dan compliance yang memadai.

## 9. Object Storage

Dipakai untuk:

- Surat undangan.
- Rundown.
- Materi.
- Denah.
- Foto profil.
- Lampiran pengumuman.

Database hanya menyimpan:

- `object_key`
- `bucket`
- `mime_type`
- `size`
- `checksum`
- `visibility`
- `created_by`
- timestamps

## 10. Version Pinning

- Core framework dan auth package dipasang dengan versi eksplisit.
- Lockfile wajib disimpan.
- Update dependensi dilakukan melalui PR terpisah.
- Major update tidak digabung dengan pengembangan fitur.
- Vulnerability kritis diprioritaskan.

Contoh:

```json
{
  "@refinedev/core": "5.0.12"
}
```

## 11. Environment Variables

Minimal:

```bash
APP_ENV=
APP_URL=
DATABASE_URL=
DATABASE_MIGRATION_URL=
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EMAIL_API_KEY=
EMAIL_WEBHOOK_SECRET=
EMAIL_FROM=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
LOG_LEVEL=
```

## 12. Referensi Resmi

- Refine Core: https://refine.dev/core/docs/core/
- Refine packages: https://refine.dev/docs/packages/list-of-packages/
- shadcn/ui Vite: https://ui.shadcn.com/docs/installation/vite
- Neon serverless driver: https://neon.com/docs/serverless/serverless-driver
- Neon connection pooling: https://neon.com/docs/connect/connection-pooling
- Netlify Functions: https://docs.netlify.com/build/functions/overview/
- Netlify Scheduled Functions: https://docs.netlify.com/build/functions/scheduled-functions/
- Netlify Background Functions: https://docs.netlify.com/build/functions/background-functions/
