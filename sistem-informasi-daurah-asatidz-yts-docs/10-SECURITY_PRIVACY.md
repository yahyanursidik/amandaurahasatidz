# Security, Privacy, dan Tata Kelola Data

## 1. Prinsip

- Least privilege.
- Defense in depth.
- Privacy by design.
- Secure by default.
- Auditability.
- Data minimization.

## 2. Data Sensitif

Contoh:

- Email.
- Nomor telepon/WhatsApp.
- Alamat.
- Tanggal lahir.
- Riwayat keikutsertaan.
- Kehadiran.
- Catatan internal.
- Informasi afiliasi.

Data tidak boleh ditampilkan hanya karena tersedia.

## 3. Authentication

- Cookie `HttpOnly`, `Secure`, dan `SameSite`.
- Session rotation setelah login.
- Logout dan revoke session.
- OAuth state dan PKCE bila berlaku.
- Magic link/OTP berumur pendek.
- Rate limit request OTP.
- Admin dianjurkan MFA.
- Tidak menyimpan token autentikasi pada localStorage jika dapat dihindari.

## 4. Authorization

- Backend memeriksa permission.
- Backend memeriksa event scope.
- Backend memeriksa institution scope.
- Resource yang tidak berada dalam scope dikembalikan sebagai `404` bila tepat.
- Export memerlukan permission khusus.
- Audit log tidak dapat diubah pengguna biasa.

## 5. Token Undangan

- Minimal 128-bit entropy.
- Disimpan sebagai hash.
- Expiry.
- Revoke.
- Optional max uses.
- Email verification.
- Tidak menggunakan sequential ID.
- Tidak dimasukkan ke log aplikasi secara utuh.

## 6. QR dan Kode

- QR berisi token opaque.
- Kode peserta sulit ditebak.
- QR lokasi memiliki expiry.
- Token event A tidak berlaku untuk event B.
- Token dapat dirotasi.
- Check-in diberi rate limit.

## 7. Input Security

- Validasi Zod pada server.
- Parameterized query/ORM.
- Sanitasi rich text.
- MIME type dan file signature validation.
- Batas ukuran file.
- Tidak mempercayai nama file.
- URL eksternal divalidasi.
- Captcha pada form publik berisiko.

## 8. Secrets

- Hanya pada environment Netlify.
- Tidak disimpan di repository.
- Tidak dicetak ke log.
- Rotasi berkala.
- Secret terpisah per environment.
- Akses production dibatasi.

## 9. Audit Log

Audit wajib untuk:

- Login admin berisiko.
- Perubahan role.
- Merge profil.
- Export.
- Revoke/reopen invitation.
- Approval peserta.
- Pembatalan/penggantian.
- Koreksi attendance.
- Perubahan template.
- Pengaturan sistem.

## 10. Retensi

Kebijakan awal perlu disetujui YTS:

| Data | Rekomendasi Awal |
|---|---|
| Master asatidz/lembaga | Selama hubungan program masih relevan |
| Invitation link | Token dinonaktifkan setelah expiry |
| Email delivery payload | 12–24 bulan, minimalkan isi |
| Check-in log teknis | 12 bulan |
| Attendance | Sesuai kebutuhan kelembagaan |
| Audit log kritis | Minimal 24 bulan |
| File sementara | Hapus otomatis 30–90 hari |

## 11. Hak Subjek Data

Sediakan proses untuk:

- Meminta koreksi.
- Memperbarui profil.
- Mengetahui penggunaan data.
- Meminta penghapusan bila memenuhi kebijakan.
- Menonaktifkan komunikasi non-transaksional.

## 12. Backup dan Restore

- Backup database sesuai fasilitas Neon dan kebutuhan internal.
- Uji restore, bukan hanya mengandalkan backup tersedia.
- Dokumentasikan RPO dan RTO.
- Export kritis sebelum event besar.
- Object storage memiliki versioning bila memungkinkan.

## 13. Incident Response

1. Identifikasi.
2. Batasi dampak.
3. Rotasi secret jika perlu.
4. Simpan bukti log.
5. Nilai data terdampak.
6. Pulihkan layanan.
7. Informasikan pihak terkait sesuai kebijakan.
8. Post-incident review.
9. Tambahkan pencegahan.

## 14. Security Checklist Sebelum Launch

- Tidak ada secret di bundle frontend.
- Semua permission diuji negatif.
- Token expiry diuji.
- Rate limit aktif.
- Captcha aktif pada form publik.
- Webhook signature diverifikasi.
- Export dibatasi.
- File upload divalidasi.
- Dependency audit.
- Error production tidak menampilkan stack sensitif.
- Database production tidak memakai role owner untuk request aplikasi bila RLS dipakai.
