# Evaluasi Modul Pengelolaan Panitia

## Temuan awal

1. Penugasan hanya tersimpan di `event_committee_assignments`, belum otomatis memberi role RBAC per event.
2. Admin harus memasukkan UUID pengguna secara manual dari halaman tim event.
3. Belum ada direktori akun, detail masa tugas, matriks akses, atau penghentian akses yang menjaga riwayat.
4. Portal panitia belum menampilkan event dan kewenangan yang ditugaskan kepada akun yang sedang login.
5. Angka peserta belum hadir pada dashboard panitia masih statis.
6. Event belum memiliki batas respons undangan dan batas konfirmasi kehadiran sebagai kebijakan bersama.
7. Check-in hanya menolak peserta batal/diganti, belum memastikan peserta sudah konfirmasi dan disetujui.

## Pengembangan yang diterapkan

### Akun dan akses

- Direktori akun panitia dengan pencarian, filter event, status akun, dan ringkasan tugas.
- Pembuatan akun email/password dengan penugasan event pertama yang wajib.
- Detail akun untuk menambah tugas, mengubah status, dan mengakhiri tugas.
- Penugasan disinkronkan ke `user_role_assignments`, sehingga RBAC dan catatan tim event tidak lagi berbeda.
- Masa tugas `startsAt`/`endsAt` diterapkan pada akses efektif.
- Penghentian tugas menggunakan tanggal akhir, bukan menghapus riwayat.
- Semua perubahan penting dicatat di audit log.

### Workspace operasional

- Menu utama admin `Pengelolaan Panitia`.
- Submenu ringkasan, akun, penugasan, matriks akses, tenggat, dan tambah akun.
- Halaman tim event memakai pilihan akun/peran, bukan input UUID.
- Portal panitia memiliki halaman `Tugas & Akses Saya`.
- Dashboard panitia memakai event scope dan menghitung no-show dari data kehadiran aktual.

### Batas konfirmasi

- `invitationResponseDeadline`: batas respons undangan default event.
- `attendanceConfirmationDeadline`: batas peserta menyatakan hadir.
- `attendanceConfirmationRequired`: kewajiban konfirmasi sebelum check-in.
- `lateConfirmationPolicy`: `BLOCK`, `REVIEW`, atau `ALLOW`.
- Undangan tanpa tenggat khusus memakai tenggat default event.
- Form undangan publik menampilkan tenggat dan menonaktifkan pengiriman setelah lewat.
- Kebijakan `REVIEW` mengembalikan konfirmasi terlambat ke peninjauan panitia.
- QR, self check-in, dan presensi manual memeriksa konfirmasi serta persetujuan peserta.

## Dampak lintas modul

| Modul | Dampak |
|---|---|
| Event | Form pengaturan dan ringkasan menampilkan seluruh tenggat serta kebijakan terlambat. |
| Undangan | Tenggat default diwariskan, tautan kedaluwarsa ditolak, daftar menandai tenggat lewat. |
| Peserta | Konfirmasi terlambat diblokir atau diarahkan ke review sesuai kebijakan event. |
| Kehadiran | Check-in individual hanya tersedia untuk peserta terkonfirmasi dan disetujui. |
| Portal panitia | Data dibatasi pada event dan masa tugas yang diberikan. |
| Audit | Pembuatan akun, penugasan, perubahan, dan akhir tugas dapat ditelusuri. |
| Dashboard | No-show dihitung dari peserta terkonfirmasi tanpa record hadir/terlambat. |

## Peran dan fokus akses

| Peran | Fokus |
|---|---|
| Admin Event | Konfigurasi dan kendali operasional event. |
| Koordinator Panitia | Jadwal, pengumuman, presensi, dan laporan. |
| Petugas Registrasi | Data peserta dan registrasi kedatangan. |
| Petugas Check-in | Pemindaian dan pencatatan presensi. |
| Petugas Informasi | Jadwal dan pengumuman peserta. |

## Validasi

- Migrasi idempoten memastikan empat kolom tenggat dan indeks unik penugasan tersedia.
- TypeScript typecheck lulus.
- Production build lulus.
- 121 pengujian lulus, termasuk empat skenario tenggat baru.
- Uji localhost memastikan direktori menampilkan akun panitia, form tim event menyediakan akun/peran/masa tugas, dan formulir event memiliki empat input waktu.
- Uji viewport 320 px memastikan input dan filter tetap berada di dalam viewport; navigasi submenu menggunakan scroll horizontal terlokalisasi.
