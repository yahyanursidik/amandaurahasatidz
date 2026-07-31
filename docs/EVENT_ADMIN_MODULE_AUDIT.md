# Evaluasi Modul Admin Event

Tanggal: 31 Juli 2026

## Arsitektur menu

Ruang kerja sebuah event kini memakai sembilan submodul:

1. Ringkasan dan kesiapan.
2. Jadwal dan sesi.
3. Undangan lembaga/individu.
4. Peserta dan persetujuan individual.
5. Penugasan panitia.
6. Kehadiran.
7. Komunikasi dan pengumuman.
8. Laporan dan ekspor.
9. Pengaturan event.

Submenu selalu membawa `eventId`, sehingga admin tidak kehilangan konteks event saat berpindah pekerjaan.

## Perubahan yang diterapkan

| Area | Perubahan |
| --- | --- |
| Shell admin | Sidebar menempel di sisi kiri; mode ikon pada layar menengah dan label penuh pada layar besar. |
| Daftar event | Ringkasan status, pencarian, filter status, create, detail, edit, dan halaman publik. |
| CRUD event | Endpoint create, detail, update, dan command transition diaktifkan. |
| Form event | Identitas, periode, audience, presensi, kapasitas, quota lembaga, lokasi, dan deskripsi. |
| Ringkasan | Status, kesiapan lokasi/jadwal/sesi/panitia, serta transisi status yang legal. |
| Jadwal | Daftar hari/sesi, tambah hari, dan tambah sesi. |
| Undangan | Tautan lembaga, quota, deadline, send, revoke, status respons, serta wakil yang didaftarkan. |
| Peserta | Tampilan individual lintas sumber, filter, persetujuan satuan, dan bulk approve. |
| Panitia | Daftar anggota dan penugasan role event. |
| Kehadiran | Rekap hadir penuh/sebagian, terlambat, izin, absen, dan rincian peserta. |
| Komunikasi | Daftar pengumuman, pembuatan draft, segmentasi, dan publish. |
| Laporan | Tujuh tipe laporan, preview tabel, filter per event, dan ekspor CSV. |
| Integritas | Sesi hanya dapat ditambahkan ke hari milik event yang sama. |

## Temuan lanjutan

### Prioritas tinggi

- Tambahkan edit, hapus, dan drag-sort hari/sesi dengan audit trail.
- Ganti input UUID panitia dengan pencarian pengguna yang memiliki role sesuai.
- Lengkapi aksi peserta: waitlist, decline, cancel, replacement, dan alasan wajib.
- Tambahkan laporan no-show yang benar-benar mengecualikan peserta dengan attendance record.
- Persistenkan sesi login dan rate limit untuk lingkungan serverless.

### Prioritas menengah

- Tambahkan pagination server untuk peserta, undangan, kehadiran, dan laporan.
- Simpan filter pada URL agar halaman dapat dibagikan.
- Tambahkan preview penerima sebelum pengumuman dipublikasikan.
- Tambahkan status pengiriman email per pengumuman dan tindakan retry.
- Tambahkan bulk import peserta/lembaga dengan dry-run UI.

### Kriteria siap produksi

- Migrasi password sudah diterapkan.
- Seluruh endpoint diuji dengan role SUPER_ADMIN dan EVENT_ADMIN.
- Tidak ada tindakan utama yang masih memakai data contoh atau `alert`.
- QR check-in kamera, koreksi kehadiran, dan ekspor telah diuji end-to-end.
- Audit log mencatat create/update/transition/approval/publish/export.
