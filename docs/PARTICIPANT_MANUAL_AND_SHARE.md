# Tambah peserta manual dan bagikan kode/QR

## Penggunaan

1. Buka Admin → Event → pilih event/daurah → tab **Peserta**.
2. Klik **Tambah peserta manual** di bagian tambah/upload peserta.
3. Isi nama lengkap, email, dan WhatsApp. Telepon opsional memakai WhatsApp bila kosong. Alamat, lembaga, dan catatan opsional.
4. Centang konfirmasi kesediaan hadir hanya jika peserta sudah menyatakan akan hadir. Ini bukan persetujuan atau presensi.
5. Simpan. Peserta memperoleh kode unik dan status `PENDING_REVIEW`; daftar dimuat ulang.
6. Pada baris peserta, klik **Bagikan QR / kode**, lalu **WhatsApp** atau **Email**, atau salin pesan.

WhatsApp memakai `wa.me` dan email memakai `mailto:`. Pesan disiapkan di aplikasi pengguna, bukan dikirim otomatis oleh server. Pesan berisi nama, event, tanggal, lokasi, status, dan kode pendaftaran. Untuk peserta yang disetujui, pesan juga berisi tautan kartu QR pribadi. Kartu dapat ditampilkan/diunduh sebagai PNG; tautan berbagi tidak melampirkan PNG otomatis.

## Perilaku dan keamanan

- Fitur berlaku untuk setiap ID event, tidak khusus LIQAA10.
- QR presensi tersedia hanya untuk peserta `APPROVED`. Peserta pending/waitlist hanya memperoleh pesan kode dengan keterangan belum berlaku untuk presensi.
- Pendaftaran batal, diganti, atau ditolak tidak dapat dibagikan.
- Kartu menggunakan token signed terikat ID peserta, event, dan versi QR. Tidak merotasi token saat membuka dialog; rotasi yang sudah ada tetap mencabut tautan lama.
- Tautan kartu bersifat pribadi. Bagikan hanya kepada peserta yang bersangkutan.
- Data/token hanya dimuat saat dialog berbagi dibuka; endpoint mengirim `Cache-Control: no-store`.
- Kedua endpoint baru khusus akun internal dengan izin sesuai event. Assignment peserta/perwakilan lembaga tidak memberi akses ke fitur admin ini.
- Nomor manual menerima format seluler Indonesia `08…`, `8…`, `62…`, `+62…`, disimpan dengan awalan `62`.
- Profil induk digunakan kembali hanya jika identitas tidak ambigu dan nama/kontak cocok. Tidak menimpa profil induk, termasuk alamat/kontak yang diisi pada formulir ketika profil lama digunakan kembali. Jika perlu memperbarui profil, gunakan halaman profil master.
- Profil berkonflik/tidak aktif dan peserta yang sudah terdaftar di event yang sama ditolak sebelum penulisan utama.
- Program selesai, dibatalkan, atau diarsipkan menolak penambahan manual. Admin dapat memasukkan peserta di program nonterminal meskipun pendaftaran publik ditutup.
- Sumber `ADMIN_ENTRY` dihitung sebagai jalur reguler ketika peserta disetujui, mengikuti kapasitas/kuota yang sudah ada. Formulir tidak menyetujui peserta otomatis.
- Mode demo tidak menulis database atau menerbitkan QR.

## API

- `POST /api/v1/events/:eventId/participants/manual`: login + izin `participants.create` pada event. Body: `fullName`, `email`, `whatsapp`, opsional `phone`, `address`, `institutionName`, `notes`, `attendanceConfirmed` (boolean). Respons `201` berisi ID/kode, sumber/status, dan penanda profil digunakan kembali.
- `GET /api/v1/events/:eventId/participants/:participantId/share`: login + izin `participants.read` pada event. Pencarian peserta wajib cocok dengan **kedua ID**. Respons berisi data pesan dan `qrToken`/`cardUrl` hanya saat disetujui.

Tidak memerlukan migrasi atau paket baru. Belum melakukan deploy; frontend dan function API harus dirilis bersama.

## Batasan transaksi bawaan

Implementasi mengikuti helper `withTransaction` yang sudah dipakai aplikasi. Driver Neon HTTP menggunakan fallback tanpa transaksi interaktif. Constraint unik `(event_id, ustadz_id)` tetap mencegah pendaftaran ulang profil yang sama, tetapi profil baru dengan kontak sama yang dibuat benar-benar bersamaan dapat menjadi profil induk terpisah karena tabel profil belum memiliki constraint unik kontak. Kegagalan di tengah beberapa penulisan pada fallback juga tidak dijamin rollback. Ini bukan jaminan deduplikasi global lintas event.

## Pengujian

Tes memakai database tiruan; tidak membuat peserta di produksi. Jalankan `npm test`, `npm run typecheck`, dan `npm run build`. Tes baru mencakup validasi, konflik profil, pendaftaran ulang, status program, audit, fallback transaksi, scope event, batas QR approval, tautan pesan terenkode, dan markup dialog aksesibel.