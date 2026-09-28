# Pembersihan data demo YTS — 28 September 2026

Setelah konfirmasi pengguna, database Neon **DaurahAsatidz / production / neondb** dibersihkan secara permanen dan terbatas:

- Event `DAURAH-YTS-1448` beserta **9 pendaftar**, **4 undangan**, jadwal dan relasi event demo dihapus.
- Tiga lembaga seed `INST-BDG-001`, `INST-JBR-002`, `INST-JKT-003` beserta afiliasi demo dihapus. Pemeriksaan sebelum transaksi memastikan tidak ada peserta atau undangan dari event lain yang memakai lembaga-lembaga tersebut.
- Assignment peran yang scoped ke event/lembaga demo dan penerima pengumuman terkait dihapus agar tidak meninggalkan referensi yatim. Catatan audit historis tetap tersimpan.
- Event `DAURAH-SAM-2026` dan **158 pesertanya tidak diubah**.
- **9 profil asatidz** yang tadinya ikut event demo (termasuk 4 yang terkait akun) tetap tersimpan sesuai cakupan pilihan pengguna. Tinjau profil tersebut secara terpisah sebelum impor asatidz asli jika direktori induk juga ingin dibersihkan.

Snapshot pemulihan sebelum transaksi: `snap-divine-scene-azp5t5s7` pada proyek `weathered-mode-74673540`. Transaksi memiliki guard jumlah baris/relasi, lalu hasil akhir diverifikasi: 0 event demo, 0 lembaga seed dan 158 peserta event lain tetap tersedia.

Fitur **Hapus dari daftar** pada katalog event sekarang memakai pengarsipan (soft delete) agar event produksi yang punya peserta tidak kehilangan riwayat. **Nonaktifkan** di direktori lembaga memakai endpoint soft delete yang sudah ada. Keduanya berbeda dari pembersihan permanen demo yang disetujui di atas.
