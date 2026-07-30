# UI/UX Guide

## 1. Prinsip

- Tenang dan profesional.
- Tidak berlebihan secara dekoratif.
- Informasi padat tetapi terstruktur.
- Aksi utama selalu jelas.
- Cocok bagi panitia non-teknis.
- Mobile-first untuk portal ustadz dan check-in.
- Desktop-efficient untuk admin.

## 2. Design Tokens

Token wajib:

```text
background
foreground
card
muted
border
primary
primary-foreground
secondary
success
warning
danger
info
focus-ring
```

Semua komponen dari shadcn, BeUI, atau Hallmark harus memetakan warna ke token tersebut.

## 3. Tipografi

- Maksimal 2 keluarga font.
- Body minimal 14–16 px.
- Tombol on-site minimal 16 px.
- Data penting tidak hanya dibedakan dengan warna.
- Angka statistik menggunakan tabular numbers bila tersedia.

## 4. Layout Portal Admin

Navigasi:

```text
Dashboard
Kegiatan
Kalender
Undangan
Konfirmasi
Asatidz
Lembaga
Komunikasi
Laporan
Pengguna & Akses
Pengaturan
Audit Log
```

Dashboard:

- Event aktif.
- Lembaga terundang.
- Respons lembaga.
- Peserta disetujui.
- Hadir saat ini.
- Email gagal.
- Deadline terdekat.
- Action required.

## 5. Layout Portal Panitia

```text
Ringkasan
Peserta
Konfirmasi
Check-in
Kehadiran
Jadwal
Pengumuman
Laporan
```

Portal panitia selalu memperlihatkan event aktif pada header dan menyediakan event switcher hanya jika pengguna ditugaskan pada beberapa event.

## 6. Layout Portal Ustadz

```text
Beranda
Undangan Saya
Kegiatan Saya
Jadwal
QR Peserta
Pengumuman
Profil
Riwayat
```

Beranda mobile:

1. Status kegiatan terdekat.
2. QR atau kode peserta.
3. Jadwal hari ini.
4. Pengumuman terbaru.
5. Lokasi dan maps.
6. Action konfirmasi jika belum selesai.

## 7. Form Undangan Lembaga

Stepper:

```text
1. Verifikasi Undangan
2. Data Lembaga
3. Data Perwakilan
4. Daftar Peserta
5. Periksa dan Konfirmasi
```

Fitur:

- Autosave draft.
- Indikator tersimpan.
- Sisa kuota.
- Duplicate candidate warning.
- Ringkasan error di atas form.
- Error inline.
- Tombol kembali tidak menghapus data.
- Konfirmasi final menggunakan dialog ringkas.

## 8. Data Table

Desktop:

- Search.
- Filter.
- Saved view.
- Column visibility.
- Bulk action.
- Sticky header.
- Pagination.
- Export sesuai permission.

Mobile:

- Card list.
- Filter sheet.
- Sort menu.
- Detail drawer.
- Aksi utama per kartu.

## 9. Status Badge

Status selalu memiliki:

- Label.
- Warna.
- Ikon opsional.
- Tooltip/deskripsi.

Jangan mengandalkan warna saja.

Contoh:

- Menunggu respons.
- Konfirmasi hadir.
- Tidak hadir.
- Disetujui.
- Daftar tunggu.
- Sudah check-in.
- Terlambat.

## 10. Empty State

Empty state harus menjelaskan:

- Mengapa kosong.
- Tindakan berikutnya.
- Apakah filter menyebabkan kosong.
- Link bantuan jika diperlukan.

## 11. Loading dan Error

- Skeleton untuk list.
- Spinner hanya untuk aksi singkat.
- Disable tombol setelah submit.
- Retry untuk error jaringan.
- Request ID pada error support.
- Jangan menghapus input form setelah gagal.

## 12. Accessibility

- Navigasi keyboard.
- Focus visible.
- Label form eksplisit.
- Error terhubung dengan input.
- Dialog memiliki focus trap.
- Kontras memadai.
- Target sentuh minimal 44x44.
- Scanner memiliki fallback input kode.
- Tabel memiliki heading yang benar.

## 13. Copywriting

Gunakan bahasa:

- Jelas.
- Sopan.
- Tidak terlalu teknis.
- Tidak menyalahkan pengguna.

Contoh:

Buruk:

> Error 409.

Baik:

> Peserta ini sudah terdaftar pada daurah yang sama. Periksa profil yang ditemukan sebelum membuat data baru.

## 14. Responsive Breakpoint

- Mobile: 360–767.
- Tablet: 768–1023.
- Desktop: 1024+.
- Wide dashboard: 1440+.

Uji pada ponsel kelas menengah dan tablet yang umum dipakai panitia.
