# Audit landing page dan layanan BC Asatidz

## Jalur pengguna yang diperiksa

| Kebutuhan | Lokasi | Kondisi |
| --- | --- | --- |
| Melihat program yang diterbitkan | `/` atau `/programs` | Mengambil data dari `/events/public`; ada pencarian, status, loading, retry, dan tautan ke detail event. |
| Mendaftar dan memantau peserta | `/events/:slug` dan `/login/ustadz` | Alur pendaftaran event, portal pribadi, dan QR/kode peserta setelah persetujuan. |
| BC sapaan asatidz | **Admin → BC & Kampanye Email** (`/admin/broadcast`) | Template personal, pratinjau, jumlah email valid, penjadwalan sekali/mingguan/bulanan sampai 12 kali. |
| Uji kirim dan kuota harian BC | `/admin/broadcast` | Satu email uji per permintaan memakai penyedia nyata, tercatat terpisah dari kuota penerima. Batasi email per hari dan sebar antrean menurut WIB. |
| Monitor dan membatalkan BC | `/admin/broadcast` | 30 kampanye terkini, jumlah terkirim/gagal/menunggu/dibatalkan; pembatalan hanya mengubah pekerjaan yang belum diproses. |
| Menangani email gagal | **Admin → BC & Kampanye Email → Antrean & email gagal** (`/admin/email-jobs`) | 50 pekerjaan email terkini, jadwal, status, dan retry individual. |
| Check-in | `/committee/check-in` | QR per event, kode manual case-insensitive, jendela unit, dan penolakan duplikat. |

## Persyaratan operasional pengiriman otomatis

- Halaman BC dapat ditemukan dari menu utama dan dashboard admin. Hak `email.read`, `email.manage_templates`, dan `email.send` saat ini diberikan kepada **SUPER_ADMIN**; akun admin lain akan melihat keterangan kebutuhan akses.
- Penjadwalan membuat email job di database, bukan mengirimnya saat tombol ditekan. Fungsi `emailWorker` terjadwal di Netlify setiap menit dan memproses hanya pekerjaan yang jatuh tempo.
- Batas harian berlaku **per kampanye**, berdasarkan hari WIB; sistem membagi jadwal per penerima dan menunda pekerjaan yang jatuh tempo saat batas kampanye tercapai. Pekerjaan email transaksional di luar kampanye tidak termasuk batas ini. Bila beberapa worker memproses kampanye bersamaan tepat di batas, penjadwalan tetap membatasi alokasi, tetapi pemeriksaan ulang harian bukan penghitung atomik lintas worker.
- Status "diterima penyedia" berarti API Mailketing/SMTP menyetujui pengiriman, belum membuktikan email tiba di kotak masuk. Status "terkonfirmasi terkirim" hanya muncul bila webhook penyedia yang valid diterima. Uji kirim harus dipicu secara eksplisit; indikator konfigurasi saja bukan uji koneksi.
- Untuk memeriksa koneksi Mailketing: isi email penguji pada halaman BC, simpan template, lalu klik **Kirim uji template**; setelah kampanye dibuat gunakan **Uji kampanye** untuk memeriksa snapshot pesan yang dijadwalkan. Email uji bertanda `[UJI BC]`, tersimpan dalam riwayat pengiriman, dan tidak menambah hitungan penerima kampanye atau batas harian. Hasil diterima penyedia harus dilanjutkan dengan pengecekan kotak masuk/spam.
- Pilih **Maksimal email per hari** sebelum menjadwalkan. Kampanye membagi seluruh penerima aktif dengan email valid ke slot hari WIB secara otomatis; bila pengulangan beririsan, slot berikutnya bergeser untuk menjaga kuota kampanye. Halaman **Lihat penerima** menampilkan pekerjaan per status secara bertahap (50/baris halaman).
- Set `EMAIL_WORKER_ENABLED=true` dan konfigurasi `MAILKETING_API_TOKEN` serta `MAILKETING_FROM_EMAIL`, atau gunakan `EMAIL_PROVIDER=SMTP` dan `EMAIL_PASS`. Status konfigurasi tanpa menampilkan rahasia tersedia di halaman BC.
- Server Vite localhost menyediakan API, tetapi tidak menjalankan Netlify scheduled function secara otomatis. Pada localhost, admin dapat menekan **Proses yang jatuh tempo** pada halaman antrean untuk uji terbatas sesudah penyedia email dikonfigurasi.
- Tanggal dan waktu yang dipilih mengikuti zona waktu perangkat admin; kartu antrean menampilkan waktu WIB. Kampanye mingguan/bulanan menyimpan pekerjaan per pengulangan pada saat penjadwalan (maksimal 12 kali). Perubahan template berikutnya tidak mengubah pesan yang telah dijadwalkan.

## Batas cakupan yang masih perlu keputusan produk

- Langganan/berhenti berlangganan email non-transaksional belum memiliki model preferensi per asatidz. Tambahkan pengelolaan persetujuan kontak sebelum menggunakan kampanye untuk audiens luas.
- Pengulangan tak terbatas, pengeditan jadwal yang sudah tersimpan, dan segmentasi penerima menurut event/lembaga belum tersedia. Saat ini gunakan jadwal terbatas dan batalkan pekerjaan yang belum diproses sebelum membuat jadwal baru.
- Daftar email individual menampilkan 50 pekerjaan terbaru; gunakan ringkasan kampanye untuk pemantauan agregat. Ekspor riwayat pengiriman khusus BC belum tersedia.
- Pemindaian kamera mengandalkan `BarcodeDetector` dari browser; browser tanpa dukungan kamera/decoder tetap dapat memakai kode peserta manual.
