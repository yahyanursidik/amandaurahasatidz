# Pendaftaran reguler langsung dan impor peserta lintas event

- Landing event reguler hanya memuat informasi program dan formulir reguler. Informasi jalur undangan tidak ditampilkan di landing/formulir publik; undangan memakai tautan/kode pribadi pada halaman terpisah.
- Formulir reguler menerima nama, email pribadi, WhatsApp, nama lembaga/komunitas opsional, kabupaten/kota, provinsi, alamat opsional, dan anggota rombongan jika `regularAllowGroup` diaktifkan. Jika dinonaktifkan, satu formulir hanya menerima pendaftar sendiri. Batas rombongan (termasuk pendaftar utama) mengikuti kuota reguler/kapasitas yang tersisa, maksimum 20; kuota awal undangan lembaga tidak membatasi rombongan reguler. Data wilayah terpilih disimpan sebagai kode; ketikan manual tetap dapat dipakai bila layanan saran wilayah tidak tersedia. Lembaga/komunitas baru dicatat di master lembaga sebagai belum terverifikasi. Tidak ada OTP pendaftaran. Data tetap masuk status `PENDING_REVIEW`, setiap email unik per rombongan, satu profil hanya sekali per event, dan API menerapkan batas percobaan per IP. Aktivasi akun portal tetap memerlukan verifikasi email terpisah.
- Impor CSV melakukan preview terlebih dahulu. Profil yang cocok berdasarkan email unik lebih diprioritaskan; untuk nomor bersama, nama yang cocok membedakan asatidz. Nomor lama berformat `08…`, `+62…`, dan tanda pemisah dikenali. Kontak/nama yang masih ambigu atau email yang saling bertentangan tetap ditahan untuk tinjauan manual. Peserta yang sudah tertaut pada event yang sama dapat diperbarui status persetujuan serta konfirmasi kehadirannya **tanpa membuat baris peserta baru**, sehingga presensi yang sudah ada tetap tertaut pada ID lama. Baris yang pernah dibatalkan/diganti tidak diaktifkan otomatis. Preview menunjukkan jumlah event **sebelumnya yang disetujui**. Persetujuan dan konfirmasi menjadi kesiapan check-in, bukan bukti presensi sesi; presensi tetap dicatat saat peserta hadir.
- Tautan undangan lembaga/individu menampilkan formulir langsung dari token unik tanpa langkah OTP/kode tambahan. Kuota undangan membatasi **total peserta termasuk pendaftar utama**; bila kuota lima, hanya empat anggota tambahan yang dapat dimasukkan. Lembaga/komunitas baru disimpan sebagai data induk belum terverifikasi; kabupaten/kota dapat dipilih dari saran wilayah agar provinsi terisi otomatis.
- Impor diproses dalam kelompok 20 baris; indikator memperlihatkan persentase/baris yang selesai setelah setiap respons API. Kode peserta hasil preview dikirim ke tiap kelompok agar unik; baris yang telah diimpor dilewati saat percobaan ulang. Jika kelompok gagal, simpan file CSV yang sama dan ulangi impor setelah masalah diperbaiki.
- Preview CSV boleh berisi campuran baris valid dan invalid: panitia dapat mengonfirmasi untuk **hanya mengimpor baris valid**, sementara baris invalid/ambigu tetap dilewati dan dilaporkan untuk ditinjau secara terpisah. Status peserta lama pada event yang sama diperbarui melalui ID yang sama, sehingga catatan presensi tidak terputus atau dibuat ulang.
- Navigasi `/admin/ustadz` menjaga pencarian dan filter ketika berpindah halaman. Mengubah pencarian/filter memulai kembali dari halaman pertama.

## Mengizinkan atau mematikan rombongan reguler

Pada **Event → Pengaturan → Jadwal & jalur → Pendaftaran reguler**, ubah
**Boleh membawa rombongan pada pendaftaran reguler**, lalu simpan. Pengaturan
tersedia saat membuat maupun mengedit event. Untuk jalur tanpa reguler, kontrol
dinonaktifkan tetapi pilihannya tetap tersimpan bila jalur reguler diaktifkan lagi.
Ringkasan event menampilkan kebijakan tersimpan.

- `regularAllowGroup: true` mengizinkan rombongan sesuai kuota, maksimal 20 orang.
  Nilai bawaan event lama dan baru tetap `true` untuk menjaga perilaku sebelumnya.
- `regularAllowGroup: false` hanya menerima satu orang per pendaftaran reguler
  baru. Ini bukan kuota event satu orang: banyak asatidz tetap boleh mengirim
  formulir pribadi masing-masing sampai kuota reguler/total tercapai.
- Landing event dan URL `/events/:slug/register` memakai aturan yang sama.
  Bagian tambah anggota disembunyikan pada mode pribadi, dan informasi pada
  katalog serta template WhatsApp reguler mengikuti pengaturan event.
- API menolak payload beranggota dengan HTTP 422 dan
  `error.details.reason = REGULAR_GROUP_DISABLED`, termasuk payload dari klien
  lama atau yang mencoba mengirim `regularAllowGroup: true` sendiri.
- Aturan dicek kembali di dalam transaksi setelah lock baris event, yang juga
  digunakan editor event. Jika kebijakan atau kuota berubah sebelum lock didapat,
  seluruh pendaftaran yang melanggar ditolak sebelum profil, akun, peserta,
  lembaga atau antrean email baru ditulis. Pendaftaran yang sudah berhasil lebih
  dahulu tetap menjadi riwayat yang sah.
- Bila formulir rombongan yang terbuka ditolak karena kebijakan baru, isian
  anggota yang belum terkirim dihapus dengan pemberitahuan. Data pendaftar utama
  dipertahankan, persetujuan penggunaan data direset, dan tidak ada pengiriman
  ulang otomatis. Pengguna harus meninjau dan mengirim sendiri.
- Rombongan lama tidak dihapus, dipisah, atau dibatalkan. Akses kepala rombongan,
  bukti pendaftaran, persetujuan, konfirmasi, QR individu, presensi dan laporan
  tetap mengikuti kepesertaan serta izin yang sudah ada.
- Undangan lembaga/individu mempertahankan izin rombongan dan kuotanya sendiri.
  Entri manual dan impor oleh panitia tetap per peserta dengan izin dan validasi
  yang sudah berlaku. Pengaturan baru tidak mengubah kuota, mengaktifkan akun,
  menyetujui peserta, atau memicu pengiriman email.

## Migrasi dan verifikasi

Kolom baru `events.regular_allow_group` adalah `boolean NOT NULL DEFAULT true`.
Migrasi tambahan tidak mengubah baris peserta atau konfigurasi undangan.
Terapkan `drizzle/0017_regular_registration_group_policy.sql` sebelum deploy kode
yang membaca kolom baru. Jurnal Drizzle lama tidak mencatat seluruh migrasi manual.

Untuk instalasi PostgreSQL lokal ini:

```sh
npm run db:migrate:local
```

Untuk Neon, runner khusus mengikuti `DATABASE_MIGRATION_URL` langsung:

```sh
npm run db:migrate:regular-group             # dry-run; tanpa koneksi database
npm run db:migrate:regular-group -- --apply # menerapkan dan memverifikasi kolom
```

Perubahan ini hanya menerapkan migrasi pada database lokal. Pengaturan bisa
dikembalikan ke `true` melalui editor tanpa menghapus riwayat atau kolom.

Validasi mencakup kontrak create/PATCH, payload langsung, pembacaan API publik
dan admin, hak akses pengubahan, pendaftaran pribadi, rombongan lama, undangan
lembaga, serta pengecekan ulang di dalam transaksi. Uji browser
`npm run test:event-registration:browser` mencakup pengubahan opsi, mode pribadi,
pemulihan formulir lama, bukti rombongan lama, dan tampilan seluler/desktop.
