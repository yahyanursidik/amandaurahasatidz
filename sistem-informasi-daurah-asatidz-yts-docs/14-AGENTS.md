# AGENTS.md

## Peran Agent

Anda adalah coding agent untuk Sistem Informasi Daurah Asatidz YTS.

Prioritas:

1. Kebenaran business rule.
2. Keamanan data.
3. Event-scoped authorization.
4. Type safety.
5. Maintainability.
6. UX panitia dan peserta.
7. Kecepatan implementasi tanpa mengorbankan fondasi.

## Sumber Kebenaran

Baca sebelum coding:

1. `01-PRD.md`
2. `03-SYSTEM_ARCHITECTURE.md`
3. `04-DATABASE_SCHEMA.md`
4. `05-RBAC_ACCESS_CONTROL.md`
5. `06-API_SPEC.md`
6. Dokumen modul terkait.
7. `12-ACCEPTANCE_CRITERIA.md`
8. `17-TEST_PLAN.md`

Jika dokumen bertentangan:

- Security dan access control lebih tinggi daripada kenyamanan.
- Acceptance criteria lebih konkret daripada uraian umum.
- Catat konflik di `16-DECISION_LOG.md`.
- Jangan membuat keputusan bisnis diam-diam.

## Aturan Wajib

- Gunakan TypeScript strict.
- Jangan menggunakan `any` tanpa alasan tertulis.
- Jangan mengakses Neon dari browser.
- Jangan menaruh secret di client.
- Validasi input pada server.
- Permission diperiksa pada backend.
- Query list harus terpaginated.
- Gunakan transaction untuk operasi multi-step.
- Buat audit log untuk aksi sensitif.
- Gunakan idempotency untuk check-in, email, dan webhook.
- Jangan hard delete data yang memiliki histori.
- Jangan menyimpan PII di QR.
- Jangan membuat status update generik jika seharusnya command khusus.

## Struktur Fitur

Setiap modul idealnya memiliki:

```text
schema
types
repository
service
permissions
routes/handler
tests
ui resource
```

## Definition of Done

Sebuah pekerjaan selesai jika:

- Implementasi berjalan.
- Typecheck lulus.
- Test relevan lulus.
- Permission positif dan negatif diuji.
- Error state ditangani.
- Loading state ditangani.
- Audit ditambahkan bila perlu.
- Acceptance criteria terkait dipenuhi.
- Dokumentasi diperbarui.
- Tidak ada secret atau debug log sensitif.

## Larangan

- Jangan mengganti stack tanpa keputusan.
- Jangan memasang UI library baru karena satu komponen sederhana.
- Jangan menulis SQL interpolated string.
- Jangan membuat endpoint admin tanpa permission.
- Jangan mengubah migration production yang sudah terpakai.
- Jangan menaruh business rule hanya di UI.
- Jangan mengirim email langsung dari browser.
- Jangan menandai konfirmasi sebagai kehadiran.
- Jangan membuat profil ustadz per event.

## Pola Commit

```text
feat(events): add event day management
fix(attendance): prevent concurrent duplicate check-in
docs(api): document participant replacement
test(rbac): cover event-scoped check-in officer
```

## Instruksi Saat Mengambil Task

1. Nyatakan dokumen dan acceptance criteria yang terkait.
2. Identifikasi tabel dan endpoint.
3. Identifikasi permission.
4. Identifikasi audit requirement.
5. Buat test plan kecil.
6. Implementasikan perubahan paling kecil yang lengkap.
7. Laporkan file berubah, migration, test, dan risiko.
