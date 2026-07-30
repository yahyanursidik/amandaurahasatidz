# Check-in dan Attendance

## 1. Tujuan

- Mempercepat registrasi peserta.
- Mendukung daurah beberapa hari.
- Mendukung absensi per sesi.
- Mencegah pencatatan ganda.
- Menyimpan jejak koreksi.

## 2. Metode

```text
PARTICIPANT_QR
LOCATION_QR
PARTICIPANT_CODE
SESSION_CODE
MANUAL_SEARCH
ADMIN_OVERRIDE
```

## 3. QR Peserta

QR memuat token opaque, bukan:

- Nama lengkap.
- Email.
- Nomor telepon.
- ID database langsung.
- Nama lembaga lengkap bila tidak diperlukan.

Token dapat menunjuk:

```text
participant_id
event_id
version
expires_at
```

Data sebenarnya diambil dari backend setelah token diverifikasi.

## 4. QR Lokasi

QR lokasi:

- Terikat event/day/session.
- Memiliki `valid_from` dan `valid_until`.
- Dapat dirotasi.
- Dapat dicabut.
- Memerlukan login atau kode peserta.
- Tidak menggunakan token statis sepanjang acara bila self check-in dibuka.

## 5. Validasi Check-in

Urutan:

1. Verifikasi token/kode.
2. Pastikan participant aktif.
3. Pastikan event sesuai.
4. Pastikan participant disetujui.
5. Pastikan tidak cancelled/replaced.
6. Tentukan day/session aktif.
7. Periksa jendela check-in.
8. Periksa attendance existing.
9. Tentukan `PRESENT` atau `LATE`.
10. Simpan attendance dan checkin log.
11. Kembalikan hasil ringkas.

## 6. Duplicate Handling

Jika sudah tercatat:

```json
{
  "result": "ALREADY_CHECKED_IN",
  "previousCheckinAt": "2026-08-01T01:04:00Z",
  "sessionName": "Pembukaan"
}
```

Tidak membuat row baru.

## 7. Keterlambatan

Aturan event:

```text
late_after_minutes = 15
```

Perhitungan:

```text
checkin_at > session.start_at + late_after_minutes
```

Panitia dapat override dengan alasan.

## 8. Check-out

Bila diaktifkan:

- Scan kedua dapat dianggap check-out.
- Atau tersedia action khusus.
- Durasi tidak otomatis membuktikan peserta mengikuti materi.
- Check-out yang salah dapat dikoreksi.

## 9. Daurah Multi-hari

Contoh:

- Hari 1: absensi harian.
- Hari 2: absensi harian.
- Sesi wajib tertentu: absensi sesi tambahan.

Laporan membedakan:

- Hadir penuh.
- Hadir sebagian.
- Tidak hadir.
- Izin.
- Terlambat.

## 10. Mode On-site

Halaman petugas menampilkan:

- Sesi aktif.
- Scanner besar.
- Input kode.
- Search nama/lembaga.
- Hasil scan dengan kontras tinggi.
- Riwayat 10 check-in terbaru.
- Status jaringan.
- Jumlah hadir real-time.
- Tombol koreksi sesuai permission.

## 11. Dukungan Koneksi Tidak Stabil

MVP aman:

- Cache daftar peserta event untuk pencarian read-only.
- Tidak menganggap cache sebagai sumber kebenaran attendance.
- Check-in tetap dikirim ke server.
- Jika offline total, gunakan daftar darurat/CSV dan lakukan rekonsiliasi.

Fase berikutnya dapat menambahkan offline queue dengan:

- Device ID.
- Local timestamp.
- Server timestamp.
- Conflict resolution.
- Signed session package.

## 12. Koreksi Attendance

Wajib:

- Permission.
- Reason.
- Nilai sebelum dan sesudah.
- Actor.
- Timestamp.
- Request ID.
- Audit log.

Tidak menghapus record asli secara diam-diam.

## 13. Pengujian Beban

Simulasikan:

- 10 petugas.
- 300 peserta tiba dalam 20 menit.
- Scan ganda.
- Kode salah.
- Token event lain.
- Session belum dibuka.
- Network latency.
- Retry browser.
- Dua petugas memindai peserta yang sama bersamaan.

Unique constraint dan transaction harus menghasilkan satu attendance valid.
