# Persetujuan massal peserta event/daurah

## Penggunaan

1. Buka Admin → Event → pilih event → tab Peserta.
2. Pada panel **Persetujuan massal peserta**, pilih peserta satu per satu, semua peserta di halaman saat ini, atau semua hasil filter (termasuk halaman lain).
3. Klik **Setujui terpilih** untuk memproses pilihan. Alternatif: **Setujui semua menunggu** untuk semua peserta `PENDING_REVIEW` aktif pada event, termasuk yang tidak tampil karena filter/pagination.
4. Periksa daftar nama, kode, jumlah peserta, dan cakupan dalam dialog; klik **Ya, setujui peserta**.
5. Lihat progres serta ringkasan berhasil/gagal dan rincian per peserta. Kegagalan parsial tidak membatalkan persetujuan yang sudah tersimpan.

Peserta `WAITLISTED` aktif dapat dipilih secara eksplisit; tombol semua menunggu tidak mencakup daftar tunggu. Peserta yang telah disetujui, dibatalkan, diganti, ditolak, atau konfirmasinya tidak aktif tidak ikut dipilih.

## Aturan dan keamanan

- API memerlukan hak akses `participants.approve` pada event tujuan.
- Persetujuan individual maupun massal memeriksa peserta berada pada event pada URL sebelum menulis data.
- Kapasitas total dan kuota jalur reguler/undangan diperiksa per peserta; kapasitas/kuota nol tidak dianggap tak terbatas.
- Event selesai, dibatalkan, dan diarsipkan tidak dapat diproses.
- Hanya status persetujuan menjadi `APPROVED`. Konfirmasi kesediaan hadir dan presensi/check-in tidak diubah.
- Audit individual dan ringkasan massal tercatat. Tidak ada pengiriman WhatsApp/email otomatis.
- Mode demo tidak menyimpan persetujuan massal ke database.

## API dan penanganan gangguan

`POST /events/:eventId/participants/bulk-approve` menerima `{ participantIds: string[] }`, 1–25 UUID unik per permintaan. Frontend membagi pilihan besar menjadi batch berurutan (misalnya 58 peserta: 25/25/8). Halaman operasional panitia juga memakai batas yang sama.

Respons berisi `summary: { total, succeeded, failed }` dan `results: [{ participantId, status: "SUCCESS" | "FAILED", message }]`.

Jika respons gagal/tidak lengkap, batch tersebut ditandai `UNKNOWN`, peserta pada batch berikutnya `NOT_PROCESSED`, dan tidak dilakukan retry otomatis. Permintaan yang sudah terkirim mungkin telah menulis sebagian data; pindah tab/halaman menghentikan batch berikutnya, bukan membatalkan tulisan server yang sudah berjalan.

Daftar dimuat ulang setelah proses. Jika pemuatan ulang gagal, persetujuan dikunci sampai status terbaru berhasil dimuat ulang. Pilihan di luar permintaan dipertahankan; kegagalan pasti dapat dipilih kembali. Hasil belum pasti harus diperiksa terlebih dahulu.

Pemeriksaan kuota mengikuti pola aplikasi yang sudah ada (baca hitungan lalu update); belum merupakan jaminan atomik terhadap beberapa admin menyetujui bersamaan dari sesi berbeda. Batch di satu proses dieksekusi berurutan.

## Validasi

- `npm run typecheck`
- `npm test -- --maxWorkers=2`
- `npm run build`

Tes fitur mencakup pemilihan halaman/filter, batch 25/25/8, kegagalan parsial, hasil belum pasti, penghentian batch saat pindah halaman, validasi UUID/duplikat/batas batch, hak akses, scope event, status tidak aktif, kapasitas/kuota, dan audit. Pengujian tidak menyetujui peserta database produksi.