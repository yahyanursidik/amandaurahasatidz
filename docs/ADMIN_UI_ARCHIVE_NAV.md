# Direktori asatidz dan keterbacaan dashboard

- `DELETE /api/v1/ustadz/:id` mengarsipkan profil (mengisi `deleted_at`) tanpa menghapus peserta, undangan, atau catatan kehadiran. Daftar default hanya menampilkan profil yang belum diarsipkan. Filter **Arsip** menampilkan profil tersimpan; **Pulihkan** memakai `POST /api/v1/ustadz/:id/restore`. Kedua aksi memerlukan izin `ustadz.update` dan dicatat di audit.
- Ringkasan admin kini memisahkan pendaftaran terbuka, profil aktif, profil arsip, peserta menunggu tinjauan, dan antrean email. Modul tautan diarahkan ke pendaftaran event, impor CSV, absensi, pengumuman, BC, dan data induk.
- Menu bawah pada layar sempit menyediakan tombol **Menu** untuk modul yang tidak muat; drawer tetap menyediakan semua modul. Grid dashboard kelima tidak lagi menyusut ke satu kolom kecil. Formulir dan tabel panjang tetap berada di lebar konten; daftar peserta dipadatkan di ukuran layar kecil.
