# Product Requirements Document

## 1. Identitas Produk

- **Nama kerja:** Sistem Informasi Daurah Asatidz YTS
- **Alternatif nama:** DaurahHub YTS
- **Jenis:** Web application responsif
- **Pemilik:** Yayasan Tarbiyah Sunnah
- **Pengguna utama:** Admin YTS, panitia, ustadz, dan perwakilan lembaga

## 2. Latar Belakang

Pengelolaan daurah asatidz melibatkan data lembaga, profil asatidz, undangan, peserta delegasi, konfirmasi, reminder, jadwal, check-in, dan absensi beberapa hari. Jika proses tersebut dilakukan melalui pesan, formulir umum, dan spreadsheet terpisah, maka akan muncul:

- Duplikasi profil ustadz.
- Sulit mengetahui respons setiap lembaga.
- Peserta lembaga berubah tanpa jejak.
- Status konfirmasi dianggap sama dengan kehadiran.
- Absensi daurah beberapa hari tidak akurat.
- Komunikasi dan reminder tidak terukur.
- Riwayat keterlibatan asatidz tidak tersimpan lintas kegiatan.
- Laporan harus dirapikan ulang secara manual.

## 3. Visi

Membangun pusat pengelolaan daurah dan jejaring asatidz yang akurat, aman, mudah digunakan, dan dapat dikembangkan menjadi CRM pembinaan asatidz dan lembaga dakwah YTS.

## 4. Tujuan Produk

1. Menyediakan master data asatidz dan lembaga.
2. Mengelola banyak daurah dalam satu sistem.
3. Mendukung undangan per lembaga dan individu.
4. Memberikan tautan unik per undangan.
5. Memungkinkan lembaga mendaftarkan delegasinya.
6. Memisahkan status undangan, konfirmasi, persetujuan, dan kehadiran.
7. Mengelola jadwal multi-hari dan multi-sesi.
8. Mempercepat check-in di lokasi.
9. Mengotomasi komunikasi email.
10. Menyediakan laporan lintas kegiatan.

## 5. Bukan Tujuan MVP

MVP belum mencakup:

- Pembayaran kegiatan.
- Hotel dan transportasi.
- Konsumsi terintegrasi.
- Sertifikat otomatis.
- WhatsApp gateway.
- Aplikasi mobile native.
- Learning management system.
- Streaming materi.
- Sistem multi-tenant komersial.

## 6. Persona

### 6.1 Super Admin YTS

Membuat event, mengelola master data, undangan, akses pengguna, laporan, konfigurasi, dan audit.

### 6.2 Admin Event

Mengelola satu atau beberapa event yang diberikan kepadanya.

### 6.3 Ketua Panitia

Mengawasi peserta, jadwal, informasi, check-in, dan pelaporan event tertentu.

### 6.4 Petugas Registrasi

Memindai QR, mencari peserta, memasukkan kode, dan melakukan koreksi terbatas.

### 6.5 Petugas Informasi

Mengelola jadwal dan pengumuman event tertentu.

### 6.6 Ustadz

Melihat undangan, memperbarui profil, melakukan konfirmasi, mengakses jadwal, QR, pengumuman, dan riwayat.

### 6.7 Perwakilan Lembaga

Menerima undangan lembaga, memverifikasi data lembaga, mengisi data perwakilan, dan mendaftarkan delegasi sesuai kuota.

## 7. Model Kegiatan

Nilai `audience_mode`:

- `INSTITUTION_INVITATION`
- `INDIVIDUAL_INVITATION`
- `OPEN_REGISTRATION`
- `HYBRID`

Nilai `attendance_mode`:

- `DAILY`
- `SESSION`
- `DAILY_AND_SESSION`
- `CHECKIN_CHECKOUT`

## 8. Alur Undangan Lembaga

1. Admin membuat event.
2. Admin memilih lembaga.
3. Admin menentukan kuota, PIC, batas konfirmasi, dan template.
4. Sistem membuat undangan serta token unik.
5. Email dikirim kepada perwakilan.
6. Perwakilan membuka tautan.
7. Perwakilan memverifikasi data lembaga.
8. Perwakilan mengisi data dirinya.
9. Perwakilan memilih respons lembaga.
10. Perwakilan menambahkan peserta.
11. Sistem mendeteksi kemungkinan profil duplikat.
12. Perwakilan menyimpan draft atau melakukan konfirmasi final.
13. Admin memeriksa peserta.
14. Peserta disetujui, ditolak, atau masuk daftar tunggu.
15. Peserta menerima email dan QR.
16. Reminder dikirim sesuai kondisi.
17. Kehadiran dicatat per hari atau sesi.
18. Ucapan terima kasih dikirim setelah hadir.

## 9. Alur Undangan Individu

1. Admin memilih profil ustadz.
2. Sistem membuat undangan individu.
3. Ustadz menerima email dan tautan unik.
4. Ustadz melakukan verifikasi.
5. Ustadz memperbarui profil jika diperlukan.
6. Ustadz memilih hadir atau tidak hadir.
7. Admin menyetujui sesuai aturan event.
8. QR dan informasi kegiatan diterbitkan.
9. Kehadiran tercatat saat pelaksanaan.

## 10. Modul Produk

### 10.1 Authentication

- Login Google.
- Magic link atau email OTP.
- Session berbasis secure cookie.
- Logout seluruh perangkat.
- Pemulihan akses.
- Optional MFA untuk admin.

### 10.2 Master Data Lembaga

- Profil lembaga.
- Kategori lembaga.
- Alamat dan wilayah.
- Kontak resmi.
- Status verifikasi.
- Perwakilan.
- Catatan internal.
- Riwayat undangan dan partisipasi.

### 10.3 Master Data Asatidz

- Profil utama.
- Kontak.
- Domisili.
- Pendidikan dan bidang keilmuan.
- Afiliasi satu atau beberapa lembaga.
- Lembaga utama.
- Riwayat event.
- Riwayat konfirmasi dan kehadiran.
- Proses merge data duplikat.

### 10.4 Event

- Identitas kegiatan.
- Deskripsi.
- Tanggal.
- Zona waktu.
- Lokasi dan maps.
- Kapasitas.
- Kuota default lembaga.
- Mode peserta.
- Mode absensi.
- Batas pendaftaran.
- Status.
- Dokumen dan informasi penting.

### 10.5 Hari dan Sesi

- Hari kegiatan.
- Sesi.
- Pemateri.
- Moderator.
- Ruangan.
- Jam mulai dan selesai.
- Sesi wajib atau opsional.
- Check-in diperlukan atau tidak.
- Jendela check-in.

### 10.6 Undangan

- Undangan lembaga.
- Undangan individu.
- Nomor undangan.
- Token unik.
- Batas respons.
- Kuota.
- Status delivery dan respons.
- Pengiriman ulang.
- Pencabutan tautan.

### 10.7 Registrasi dan Konfirmasi

- Simpan draft.
- Konfirmasi final.
- Persetujuan peserta.
- Daftar tunggu.
- Pembatalan.
- Penggantian peserta.
- Riwayat perubahan.
- Verifikasi email.

### 10.8 Komunikasi

- Template email.
- Pengumuman portal.
- Segmentasi penerima.
- Reminder otomatis.
- Notifikasi perubahan jadwal.
- Ucapan terima kasih.

### 10.9 Check-in dan Absensi

- QR peserta.
- QR lokasi dinamis.
- Kode peserta.
- Kode sesi.
- Pencarian manual.
- Pencegahan duplikasi.
- Koreksi dengan alasan.
- Audit log.
- Dashboard real-time.

### 10.10 Laporan

- Rekap lembaga.
- Rekap peserta.
- Respons undangan.
- Kehadiran per hari.
- Kehadiran per sesi.
- No-show.
- Peserta berulang.
- Sebaran wilayah.
- Ekspor XLSX, CSV, dan print-friendly.

## 11. Status Utama

### Event

`DRAFT`, `PUBLISHED`, `REGISTRATION_OPEN`, `REGISTRATION_CLOSED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `ARCHIVED`

### Invitation

`DRAFT`, `SCHEDULED`, `SENT`, `DELIVERED`, `OPENED`, `RESPONDED`, `EXPIRED`, `BOUNCED`, `REVOKED`

### Participant

`INVITED`, `DRAFT`, `SUBMITTED`, `PENDING_REVIEW`, `APPROVED`, `WAITLISTED`, `CONFIRMED`, `DECLINED`, `CANCELLED`, `REPLACED`

### Attendance

`NOT_CHECKED_IN`, `PRESENT`, `LATE`, `EXCUSED`, `ABSENT`, `CHECKED_OUT`, `MANUALLY_CORRECTED`

## 12. Aturan Bisnis Penting

1. Profil ustadz tidak dibuat ulang per event.
2. Afiliasi ustadz dan lembaga menggunakan tabel relasi.
3. Konfirmasi tidak otomatis berarti hadir.
4. Kehadiran dicatat per event day atau event session.
5. Link undangan lembaga hanya dapat mengelola lembaga pada undangan tersebut.
6. Kuota tidak dapat dilampaui tanpa override admin.
7. Penggantian peserta tidak menghapus riwayat peserta lama.
8. Koreksi kehadiran wajib memiliki alasan.
9. Semua endpoint sensitif memeriksa role dan event scope.
10. Status derived tidak diedit langsung jika dapat dihitung dari data sumber.
11. Email job harus idempotent.
12. QR peserta tidak memuat data pribadi terbuka.
13. Token asli tidak disimpan dalam database.
14. Perubahan jadwal yang sudah dipublikasikan dapat memicu notifikasi.
15. Event yang telah diarsipkan menjadi read-only kecuali bagi super admin.

## 13. Metrik Keberhasilan

- Persentase undangan yang merespons.
- Waktu rata-rata lembaga menyelesaikan daftar ulang.
- Persentase profil duplikat.
- Kecepatan rata-rata check-in.
- Persentase check-in yang membutuhkan koreksi.
- Persentase konfirmasi yang menjadi kehadiran.
- Persentase email gagal.
- Waktu penyusunan laporan setelah event.
- Jumlah lembaga dan asatidz yang kembali mengikuti kegiatan.
- Jumlah proses manual di luar sistem.

## 14. Risiko Produk

| Risiko | Mitigasi |
|---|---|
| Data asatidz ganda | Matching email, telepon, nama, lembaga, dan merge workflow |
| Link undangan tersebar | Token acak, expiry, verifikasi email, dan revoke |
| Check-in lambat | Mode scanner, kode fallback, pencarian cepat, dan simulasi |
| Koneksi lokasi buruk | Cache peserta event dan antrean sinkronisasi terbatas |
| Email masuk spam | Domain terverifikasi, SPF, DKIM, DMARC, dan monitoring |
| Panitia melihat event lain | Event-scoped authorization pada backend |
| Salah koreksi kehadiran | Alasan wajib dan audit log |
| Beban email massal | Queue, batch, retry, dan idempotency key |
