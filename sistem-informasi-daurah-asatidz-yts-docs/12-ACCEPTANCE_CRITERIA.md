# Acceptance Criteria

## 1. Authentication

- Pengguna dapat login menggunakan metode yang disetujui.
- Session bertahan sesuai kebijakan.
- Logout mengakhiri session.
- Pengguna tanpa role tidak dapat masuk portal admin/panitia.
- Session kedaluwarsa diarahkan ke login tanpa kehilangan konteks aman.

## 2. Master Lembaga

- Admin dapat membuat, membaca, memperbarui, dan menonaktifkan lembaga.
- Nama, kontak, dan wilayah dapat dicari.
- Perwakilan dapat ditambahkan.
- Riwayat event lembaga dapat dilihat.
- Lembaga yang memiliki histori tidak dapat hard delete.

## 3. Master Ustadz

- Admin dapat membuat profil.
- Sistem mencari kandidat duplikat berdasarkan email, telepon, dan nama.
- Ustadz dapat terhubung ke beberapa lembaga.
- Hanya satu afiliasi aktif yang dapat ditandai utama.
- Merge tidak menghilangkan histori event.
- Ustadz dapat memperbarui field yang diperbolehkan.

## 4. Event

- Admin dapat membuat event multi-hari.
- Event memiliki timezone.
- Tanggal akhir tidak boleh sebelum tanggal mulai.
- Event dapat memiliki beberapa sesi.
- Status berubah hanya melalui transition valid.
- Panitia hanya melihat event yang ditugaskan.

## 5. Undangan Lembaga

- Admin dapat menentukan lembaga dan kuota.
- Sistem membuat link unik.
- Link tidak menampilkan ID internal.
- Link kedaluwarsa tidak dapat digunakan.
- Link dapat dicabut.
- Perwakilan dapat menyimpan draft.
- Perwakilan dapat menambah peserta sampai kuota.
- Konfirmasi final tersimpan dengan timestamp.
- Admin dapat membuka kembali dengan audit.
- Ucapan terima kasih dibuat setelah final confirmation.

## 6. Undangan Individu

- Ustadz menerima tautan khusus.
- Ustadz dapat memilih hadir atau tidak.
- Respons tersimpan dengan timestamp.
- Respons dapat diubah hanya sampai deadline atau setelah reopened.
- QR diterbitkan hanya untuk peserta yang memenuhi aturan.

## 7. Approval Peserta

- Admin dapat approve, waitlist, decline, cancel, dan replace.
- Aksi memerlukan permission.
- Perubahan status memiliki history.
- Replacement menjaga referensi peserta lama.
- Kapasitas tidak terlampaui tanpa override.

## 8. Email

- Email job memiliki idempotency key.
- Worker tidak mengirim job sama dua kali.
- Pengiriman gagal memiliki retry.
- Hard bounce tidak terus dicoba.
- Webhook dengan signature salah ditolak.
- Status delivery terlihat pada admin.
- Reminder hanya menargetkan segmen yang benar.
- Cron memperhitungkan timezone event.

## 9. Check-in

- QR event lain ditolak.
- Peserta cancelled ditolak.
- Peserta valid tercatat.
- Scan ganda tidak membuat record ganda.
- Check-in di luar waktu ditolak atau membutuhkan override.
- Late dihitung sesuai aturan event.
- Hasil scan menampilkan nama dan lembaga secara ringkas.
- Setiap percobaan tercatat di checkin log.

## 10. Attendance

- Kehadiran dapat dicatat per hari.
- Kehadiran dapat dicatat per sesi.
- Mode mengikuti konfigurasi event.
- Koreksi memerlukan alasan.
- Nilai lama dan baru tersimpan.
- Laporan membedakan hadir penuh dan sebagian.
- Data dapat diekspor sesuai permission.

## 11. Announcement

- Panitia berizin dapat membuat draft.
- Pengumuman dapat ditargetkan.
- Pengumuman yang belum publish tidak terlihat peserta.
- Perubahan jadwal dapat memicu pengumuman/email.
- Ustadz hanya melihat pengumuman relevan.

## 12. Security

- Database URL tidak ada pada bundle frontend.
- Endpoint memeriksa permission dan scope.
- Token disimpan sebagai hash.
- Form publik memiliki rate limit.
- Data pribadi tidak berada dalam QR.
- Export tercatat dalam audit.
- Error tidak membocorkan stack/secret.

## 13. Performance

- Search peserta cukup cepat untuk operasional lokasi.
- List menggunakan pagination.
- Dashboard tidak mengambil seluruh row tanpa batas.
- Check-in simultan menghasilkan satu attendance.
- Email besar diproses melalui queue/background.

## 14. Accessibility dan Mobile

- Portal peserta dapat digunakan pada lebar 360 px.
- Scanner memiliki input kode fallback.
- Form dapat digunakan dengan keyboard.
- Error form terbaca jelas.
- Target sentuh memadai.
- Status tidak hanya menggunakan warna.
