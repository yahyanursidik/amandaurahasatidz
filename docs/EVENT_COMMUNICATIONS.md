# Komunikasi peserta daurah

## Lokasi dan alur

Admin → Event & Daurah → pilih event → **Komunikasi** (`/admin/events/:id/communications`). Modul bekerja per event, bukan broadcast seluruh direktori asatidz.

Panitia memakai editor yang sama melalui **Pengumuman** (`/committee/announcements`), setelah memilih event penugasannya. Petugas informasi dapat menyusun draf/template tetapi tidak mempublikasikan; publikasi memerlukan izin `announcements.publish`. Peserta membaca pesan yang ditujukan kepadanya melalui `/portal/announcements`, bukan daftar draf admin.

1. Pilih template bawaan, template tersimpan, atau buat pesan kosong.
2. Edit **judul pengumuman portal**, **subjek email**, isi pesan, segmen penerima, dan opsi email.
3. Lengkapi setiap instruksi `[ISI: ...]`. Instruksi tersebut sengaja bukan variabel otomatis dan tidak boleh ikut terkirim.
4. Simpan sebagai draf. Draf belum tampil pada portal peserta dan belum membuat antrean email.
5. Buka pratinjau server untuk memeriksa isi final, contoh personalisasi, serta jumlah penerima.
6. Periksa peringatan, konfirmasi peninjauan, kemudian publikasikan draf yang sudah disimpan. Perubahan isi setelah pratinjau memerlukan pratinjau ulang.

**Diantrekan bukan berarti terkirim.** Email diproses worker yang sudah ada. Periksa Antrean & email gagal untuk mengetahui hasil pengiriman. Menarik pengumuman dari portal tidak menarik email yang sudah dikirim.

## Template

Tersedia 15 template bawaan: undangan, pengingat konfirmasi, informasi peserta disetujui, pengingat daurah, perlengkapan/tata tertib, registrasi kedatangan/QR, perubahan jadwal, perubahan lokasi, transportasi/akomodasi, pemberitahuan penting, materi/rekaman, evaluasi, sertifikat, terima kasih, dan koordinasi lembaga.

Template adalah titik awal yang harus ditinjau panitia; menerapkan template tidak mengubah status peserta, membuat sertifikat, atau mengonfirmasi kehadiran. Template bawaan tetap tersedia dan tidak diubah secara global. Simpan versi sendiri untuk kebutuhan event; template tersimpan dapat diperbarui dan diarsipkan tanpa mengubah pesan yang sudah diterbitkan.

## Variabel

| Variabel | Sumber |
|---|---|
| `{{eventName}}` | Nama event |
| `{{eventDates}}` | Tanggal event |
| `{{eventVenue}}` | Lokasi event |
| `{{portalLink}}` | Portal peserta aplikasi |
| `{{ustadzName}}` | Nama pribadi penerima |
| `{{participantCode}}` | Kode pribadi peserta |
| `{{institutionName}}` | Lembaga peserta |

Variabel diproses satu kali, tanpa ekspresi atau kode yang dapat dieksekusi. Nama variabel tidak dikenal, data wajib yang belum tersedia, placeholder tidak lengkap, dan instruksi `[ISI: ...]` harus diselesaikan sebelum publikasi. Isi pesan menggunakan teks biasa; pratinjau email dibatasi dalam iframe sandbox.

## Segmentasi dan batas fitur

- Semua peserta event.
- Peserta disetujui.
- Peserta berstatus diundang/belum konfirmasi.
- Peserta yang pernah tercatat hadir. Ini **bukan** pemilihan tanggal kehadiran tertentu.
- Peserta dari lembaga yang dipilih.
- Panitia dengan penugasan event aktif dan akun aktif (notifikasi email; bukan inbox peserta).

Peserta tanpa email tetap dapat menerima pengumuman portal. Alamat email yang sama dideduplikasi untuk pengiriman; email bersama tidak cocok untuk informasi rahasia per individu. Periksa hitungan dan peringatan pada pratinjau sebelum mengirim.

Modul ini menggunakan portal peserta dan antrean email yang sudah ada. Tidak menyediakan pengiriman WhatsApp otomatis, lampiran, penjadwalan kampanye baru, perubahan kredensial pengirim, atau jaminan bahwa email diterima/dibaca. Tidak menjalankan pengiriman atau migrasi produksi secara otomatis.

## Pengujian dan rilis

### Penerapan migrasi 3 Oktober 2026

Migrasi `0010_event_communications.sql` telah diterapkan ke proyek Neon **DaurahAsatidz** (`weathered-mode-74673540`), branch **production** (`br-still-star-azoho3h9`), database **neondb**, setelah host koneksi dicocokkan dengan endpoint proyek. Branch cadangan **event-communications-backup-2026-10-03T09-09-34-973Z** (`br-crimson-star-aza11oi4`) dipertahankan. Staging terisolasi berhasil menjalankan apply dua kali (idempoten) sebelum produksi. Verifikasi produksi menemukan 18 kolom terkait yang diharapkan. Migrasi tidak menjalankan worker atau mengirim email.

Penerapan skema bukan bukti bahwa versi kode lokal sudah terdeploy. Perubahan profil/portal pada sesi ini harus dirilis terpisah setelah validasi.

Setelah pengujian API nyata selesai, fixture staging diverifikasi bersih (0 akun/event/email uji tersisa) dan branch staging sementara dihapus. Branch cadangan sebelum migrasi tetap dipertahankan; produksi juga diverifikasi memiliki ketiga indeks komunikasi yang diharapkan.

Jalankan `npm run typecheck`, `npm test -- --maxWorkers=2`, serta `npm run build`. Tes memakai database/transport mock, sehingga tidak mengirim pesan kepada peserta asli. Validasi database nyata dan provider email harus dilakukan terpisah pada lingkungan yang disetujui.

Perubahan ini memerlukan migrasi database untuk pengaturan draf, personalisasi penerima, dan template komunikasi. Terapkan migrasi sebelum merilis frontend/API. Cadangkan dan periksa target database; gunakan dry-run lebih dahulu:

```sh
npm run db:migrate:event-communications
# Hanya setelah cadangan dan target DATABASE_MIGRATION_URL / DATABASE_URL diverifikasi:
npm run db:migrate:event-communications -- --apply
```

Runner membaca `drizzle/0010_event_communications.sql`. Dry-run tidak memuat kredensial atau mengakses database. Mode apply menggunakan transaksi dan memeriksa 18 kolom skema terkait. Migrasi menambah kolom/table dan indeks unik penerima; entri penerima duplikat lama digabung dengan mempertahankan penanda baca. Jangan menjalankan SQL ini tanpa cadangan. Runner terpisah ini tidak memperbarui jurnal migrasi Drizzle secara otomatis.

Uji browser terisolasi memakai Chromium/Edge/Chrome yang terpasang; bila perlu tentukan executable lewat `CHROME_PATH`:

```sh
npm run test:communications:browser
```

Semua permintaan API pada uji browser dilayani fixture lokal, tanpa database atau provider email. Screenshot hasil disimpan di direktori sementara sistem.

## Kontrak API dan pengaman

Semua endpoint berikut berawalan `/api/v1/events/:eventId` dan dibatasi akun staf beserta lingkup event aktif:

| Metode | Endpoint | Kegunaan |
|---|---|---|
| GET / POST | `/announcements` | Daftar pesan / buat draf |
| GET | `/announcements/institutions` | Lembaga yang memiliki peserta di event ini, tanpa akses direktori global |
| PATCH | `/announcements/:id` | Edit draf atau pesan ditarik |
| POST | `/announcements/preview` | Pratinjau isi belum disimpan; belum boleh publikasi |
| POST | `/announcements/:id/preview` | Pratinjau draf tersimpan dan revisi `expectedUpdatedAt` |
| POST | `/announcements/:id/publish` | Publikasi dengan `expectedUpdatedAt` dari pratinjau tersimpan |
| POST | `/announcements/:id/unpublish` | Tarik pesan portal; tidak membatalkan email |
| GET / POST | `/communication-templates` | Daftar / simpan template khusus event |
| PATCH / DELETE | `/communication-templates/:id` | Perbarui / arsipkan template |

Isi draf mencakup `title`, `body`, `emailSubject`, `audienceType`, `targetInstitutionId` (khusus audiens lembaga), dan `sendEmailNotification`. Template memakai isi serupa ditambah `name` dan `category`, tanpa menyimpan lembaga tujuan agar pilihan lembaga ditinjau ulang saat digunakan.

Pengumuman baru menggunakan teks biasa; pesan lama diberi format `LEGACY_HTML` dan dikonversi menjadi teks inert untuk pratinjau/portal. Publikasi menolak variabel/instruksi belum terisi, audiens kosong, revisi draf usang, dan perubahan opsi email yang belum disimpan. Judul dan isi personalisasi disimpan per penerima; HTML email dan subjek final yang sama dengan renderer pratinjau dimasukkan ke antrean.

Status `PUBLISHING` diklaim secara atomik untuk mencegah dua proses menyebarkan pesan yang sama. Jika proses database terputus setelah klaim, status dapat tetap `PUBLISHING`; jangan mengulang dengan mengubah status secara manual tanpa memeriksa penerima dan antrean. Pemulihan otomatis belum tersedia. Kegagalan enqueue email dilaporkan terpisah dari publikasi portal. Email yang sudah ada untuk pasangan pengumuman/alamat tidak diantrekan ulang ketika pesan ditarik lalu dipublikasikan lagi; gunakan duplikasi menjadi draf baru bila ingin mengirim versi baru.

Revisi pratinjau melindungi isi/pengaturan draf, bukan membekukan data event dan daftar peserta: keduanya dihitung ulang saat publikasi. Tinjau pratinjau sedekat mungkin dengan waktu publikasi. Pengiriman dalam jumlah besar masih berjalan sinkron pada permintaan publikasi, sehingga perlu memantau batas durasi hosting; fitur fan-out background belum disertakan.

Revisi waktu dibandingkan pada presisi milidetik yang sama dengan `Date` JavaScript, termasuk pengumuman lama dengan timestamp PostgreSQL yang lebih presisi. Setiap mutasi memajukan revisi sedikitnya satu milidetik. Setelah penarikan publikasi, editor menggunakan revisi baru dari server sehingga pratinjau ulang tidak perlu memuat ulang halaman.