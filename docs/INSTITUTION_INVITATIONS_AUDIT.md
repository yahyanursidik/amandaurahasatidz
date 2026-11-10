# Audit & pengembangan undangan lembaga

Tanggal: 10 November 2026.

## Ringkasan

Fokus implementasi: **Event → Undangan lembaga → Konfirmasi → Peserta → Portal/QR**. Sistem yang ditinjau adalah manajemen Daurah Asatidz, bukan aplikasi administrasi RT. Perubahan tidak memodifikasi database produksi, mengirim email, atau mengirim WhatsApp.

## Fitur yang diterapkan

| Bagian | Hasil |
| --- | --- |
| Edit undangan | PATCH nomor, lembaga, izin rombongan, kuota, serta tanggal dan jam respons. |
| Data master | Picker lembaga aktif, pencarian nama/kode, kontak resmi atau fallback PIC utama. Tidak membuat salinan lembaga. |
| Hak akses picker | Endpoint khusus event; EVENT_ADMIN tidak perlu diberi akses seluruh direktori dan riwayat lembaga global. Tautan ke master hanya ditampilkan jika pengguna mempunyai hak baca master. |
| Identitas formulir publik | Nama/kode lembaga ditampilkan sebagai identitas, bukan input yang harus diisi ulang; `institutionId` tetap bersumber dari undangan di server. |
| Izin rombongan admin | Tidak dicentang berarti satu perwakilan. Dicentang berarti kuota minimal dua, termasuk peserta utama. |
| Pilihan penerima | Jika diizinkan, penerima dapat mencentang “Saya membawa rombongan”. Tidak dicentang berarti hanya satu peserta; mematikannya menghapus isian anggota dari state dan payload. |
| Kuota | Divalidasi di UI, service dan dibaca ulang di repository. Kuota tidak boleh di bawah jumlah peserta yang sudah tertaut. |
| Pergantian penerima | Hanya sebelum ada respons/peserta. Tautan lama dicabut, status kirim kembali menjadi draf, lalu tautan baru harus dibagikan. |
| Respons final | Perubahan metadata tidak membuka respons final kembali dan tidak menghapus peserta, profil, afiliasi, QR, atau presensi. |
| Navigasi | Undangan terhubung ke master lembaga dan daftar peserta terfilter `invitationId`; relasi riwayat pada profil lembaga tetap digunakan. |
| Komunikasi | Pesan WhatsApp/email mencantumkan izin dan batas rombongan. Kode verifikasi lama yang tidak dipakai tidak lagi memenuhi UI admin. |
| Status | Label Indonesia, filter dicabut/berhalangan, status dibuka dicatat setelah akses publik yang valid, catatan respons terlihat di kartu. |
| UX | Ringkasan berwarna, editor buat/edit yang sama, kontak master ringkas, feedback di dekat formulir, konfirmasi aksi pencabutan/rotasi tautan, target kontrol ≥44 px. |
| Kelola peserta | Dialog daftar tunggu, tolak, batalkan, dan ganti peserta dengan alasan wajib dan izin sesuai role/event. Pencarian pengganti tidak meminta UUID manual. |
| Transaksi | Write multi-langkah berjalan dengan transaksi WebSocket dan rollback; fallback HTTP tanpa transaksi dihapus. Pembacaan satu kali tetap memakai HTTP. |

### Penyimpanan tanpa migrasi

`quota = 1` menjadi kebijakan tanpa rombongan; `quota >= 2` mengizinkan rombongan. API mengekspos `allowGroup` yang diturunkan dari kuota. Payload `allowGroup: false` selalu dinormalisasi menjadi kuota satu, walaupun klien mengirim kuota lebih besar. Ini kompatibel dengan undangan lama dan menghindari dua pengaturan database yang dapat bertentangan.

Kebijakan lama umur tautan 14 hari ketika tidak ada tenggat tetap dipertahankan. Mengedit tenggat juga memperbarui expiry tautan aktif; mengganti batas waktu tidak perlu memutar token.

## Bug/integrasi yang diperbaiki

- Aksi kirim, cabut, dan rotasi sebelumnya menerima ID undangan tanpa memastikan bahwa undangan itu milik ID event pada URL. Sekarang seluruh aksi tersebut serta edit memeriksa kepemilikan event.
- Daftar undangan admin tidak lagi dapat dibaca hanya dengan role perwakilan lembaga. Pengguna dengan role ganda tetap dapat memakai penugasan staf yang sah.
- Admin event sebelumnya memerlukan `/institutions` global untuk memuat halaman, padahal rolenya tidak memiliki `institutions.read`. Picker event mengatasi ketergantungan tersebut tanpa memperluas akses global.
- Kuota pecahan, tanggal rusak, perubahan status/type/event yang disisipkan melalui PATCH, nomor duplikat, serta lembaga penerima baru yang nonaktif ditolak.
- Editor menjaga presisi waktu yang tidak diubah, termasuk detik pada tenggat lama, dan memakai zona waktu event.
- Revisi lama pada formulir edit ditolak melalui `expectedUpdatedAt`. Repository juga menggunakan kondisi revisi/status untuk mengurangi konflik penyimpanan bersamaan.
- Peserta yang sudah terdaftar lewat jalur reguler atau undangan lain tidak lagi diambil alih melalui upsert undangan. Riwayat dan sumber pendaftaran lama tidak ditimpa.
- Status final tidak dapat dibuka kembali melalui “tandai terkirim”, pencabutan, atau rotasi tautan.
- Token lembaga tidak dapat digunakan pada endpoint individu, begitu pula sebaliknya. Event draf/dibatalkan/selesai/diarsipkan tidak menerima respons publik.
- Data kontak PIC tidak dimasukkan ke respons publik. Nama lembaga palsu dari browser tidak dapat mengganti relasi lembaga undangan.
- State form/tautan dibersihkan saat berpindah event; kontak pilihan master dimuat ulang ketika kembali dari tab profil lembaga.
- Command peserta, daftar staf, dan pencarian pengganti memeriksa role dan lingkup event. PATCH umum tidak dapat dipakai untuk menyisipkan persetujuan atau penggantian.
- QR peserta dibatalkan/diganti dinonaktifkan melalui versi token. Pengganti mempertahankan sumber, lembaga, undangan, dan rombongan asal tetapi membutuhkan persetujuan baru. Profil, riwayat dan presensi lama tidak dialihkan.

## Cakupan integrasi yang ditelusuri

| Modul/subfitur | Kondisi |
| --- | --- |
| Master lembaga dan PIC | CRUD dan riwayat tersedia. Picker baru memakai lembaga aktif dan fallback PIC utama. |
| Profil/afiliasi asatidz | Pendaftaran delegasi menautkan profil, lembaga, dan afiliasi; tidak boleh mengambil alih profil dari ID yang disisipkan browser. |
| Peserta undangan | Relasi `eventId`, `invitationId`, `institutionId`, dan `ustadzId` tetap digunakan. Filter peserta per undangan ditambahkan. |
| Portal, QR dan email kartu | Alur yang ada dipertahankan. Respons berhasil tetap mengembalikan kartu serta akses portal; email gagal diantrikan tidak boleh membatalkan hasil pendaftaran yang sudah tersimpan. |
| Kehadiran dan laporan | Menggunakan peserta event yang sama; edit undangan tidak memodifikasi tabel presensi. Penggantian ditolak bila sudah memiliki presensi; pembatalan mempertahankan riwayat. |
| Jadwal/panitia/komunikasi | Navigasi ruang kerja tetap membawa ID event. Fitur-fitur ini tidak dirombak dalam patch ini. |

## Temuan yang masih perlu pengembangan

Ini bukan pernyataan bahwa seluruh sistem sudah bebas bug atau siap produksi penuh.

### P1 — Konsistensi transaksi pendaftaran: diperbaiki

`withTransaction` sekarang menggunakan `Pool` WebSocket Neon dan Drizzle `neon-serverless` pada koneksi lokal per operasi. Pool ditutup setelah transaksi, dan callback tidak pernah diulang di luar transaksi. `ws` ditambahkan sebagai dependency runtime agar tidak bergantung pada WebSocket bawaan versi Node. Query biasa tetap memakai Neon HTTP.

Pendaftaran undangan/reguler, persetujuan peserta, impor, penggantian dan edit kuota mengunci row event yang sama sebelum membaca kapasitas dan menulis. Respons undangan membaca ulang status, kuota, tenggat dan tautan di dalam transaksi. Dua respons final bersamaan hanya menghasilkan satu respons dan satu kelompok peserta, tanpa menerbitkan ulang sandi pada respons kedua.

Rollback seluruh rombongan, persaingan kursi terakhir (undangan vs undangan, undangan vs reguler, undangan vs approval), penggantian/status/QR, tautan dicabut, dan edit/rotasi diuji langsung pada branch Neon **terisolasi** `qa-institution-invitations-20261110` (`br-solitary-tree-azr2uewb`). Branch memiliki expiry otomatis 11 November 2026, 16:00 UTC. `.env` dan endpoint produksi tidak diubah. Tidak ada perubahan schema/migrasi untuk fitur ini.

Operasional: izin egress WebSocket dari runtime Netlify menuju Neon harus tersedia; kegagalan koneksi ditolak tanpa menyimpan sebagian data. Retry setelah respons final memberikan konflik, bukan mengembalikan ulang kredensial; pemulihan lintas perangkat tetap menjadi pengembangan terpisah.

### P2 — Kelengkapan UI dan skala

- UI command peserta kini tersedia. Pengganti menggunakan profil aktif yang sudah ada; pembuatan profil baru tetap melalui pengelola master asatidz. Pembatalan peserta tetap dipisahkan dari pencabutan undangan.
- Pembuatan undangan individu tersedia di backend, tetapi editor baru ini khusus lembaga; jangan menganggap kedua editor sudah lengkap.
- Daftar undangan/peserta masih banyak dimuat sekaligus dan difilter di browser. Picker master sudah dibatasi per request 100, tetapi frontend masih mengambil seluruh halaman. Untuk skala besar perlu pagination/pencarian server.
- Memuat bukti respons final di perangkat lain belum menjadi alur pemulihan yang lengkap; session proof browser bukan histori lintas perangkat. Pemulihan akses harus memakai autentikasi pemilik/PIC, bukan membuka ulang respons final atau menampilkan sandi lama.
- Kode akses/OTP legacy masih memiliki endpoint backend untuk kompatibilitas; perlu keputusan penghentian terpisah sebelum dihapus.
- Expiry tautan tanpa tenggat masih memakai kebijakan 14 hari; penampilan expiry yang terpisah dari tenggat respons dapat ditingkatkan.
- `exportService.ts` menerima enum XLSX/PRINT tetapi masih membentuk data CSV. Perlu implementasi format sebenarnya atau pembatasan format yang jujur; di luar cakupan undangan.

## Pengujian

Perintah regresi khusus:

```sh
npx vitest run institution_invitation --maxWorkers=2 --testTimeout=30000
npx vitest run participant_management_commands participant_management_ui transaction --maxWorkers=2 --testTimeout=30000
npm run test:institution-invitations:browser
npm run typecheck
npm run build
```

Pengujian khusus mencakup schema, service, repository, handler API + RBAC, render form, serta interaksi browser admin/publik. Browser memakai API fixture terisolasi dan memeriksa lebar 320, 390, 768, dan 1280 px, edit kuota, ketepatan tenggat, pembuatan tautan, penghapusan data anggota, payload satu peserta, serta respons berhalangan tanpa peserta.

Script opsional `scripts/check-event-transactions-live.mjs` memerlukan endpoint dan ID branch terisolasi secara eksplisit. Script menolak endpoint yang sama dengan `.env`, memakai kredensial hanya di memori, tidak mencetak sandi, dan tidak menghapus data induk. Pengiriman email/WhatsApp sebenarnya serta pengujian beban besar di produksi tidak dijalankan.

### Hasil eksekusi

- **51 pengujian khusus undangan** lulus (schema/service/repository/API/RBAC/UI), ditambah regresi transaksi serta command peserta.
- **Browser terisolasi** lulus pada seluruh lebar yang disebutkan di atas.
- **Typecheck dan build produksi** lulus.
- Suite luas terakhir: **1.049 lulus, 1 dilewati**. Timeout cold import shell Windows diperbaiki dengan pre-transform App di setup; assertion lazy-route dan batas 15 detik per test tetap dipertahankan.
- Uji live pada branch terisolasi membuktikan rollback, perlindungan konkurensi kapasitas dan integritas command peserta; fixture browser juga menguji refresh yang melepas row agar lock aksi panitia tidak tertinggal.
