# Peta Ukhuwah Bandung Raya

Tanggal rancangan: 3 Oktober 2026.
Status: implementasi tahap pertama selesai di kode lokal. Bagian 1–16 menyimpan rancangan lengkap, termasuk fitur tahap lanjut; jangan menganggap seluruh rancangan sebagai fitur yang telah tersedia. Tidak ada migrasi produksi, data lembaga asli, pengiriman otomatis, atau dependency baru pada tahap ini.

## Implementasi tahap pertama

- Admin: `/admin/peta-ukhuwah`, `/lembaga`, `/laporan`, `/laporan-saya`, `/moderasi`, `/tindak-lanjut`, `/laporan/baru`, dan `/laporan/:id` di bawah rute tersebut. Memerlukan penugasan SUPER_ADMIN/SYSTEM_ADMIN global, tidak dibatasi event/lembaga, dan masih aktif.
- Portal: `/portal/peta-ukhuwah`, `/laporan`, `/laporan-saya`, `/laporan/baru`, dan `/laporan/:id`. Memerlukan peran USTADZ aktif. Tidak ada peta atau laporan ukhuwah anonim/publik.
- Peta raster native React: pin, pan/zoom dengan tombol/keyboard/pointer, pemilihan koordinat di editor lokasi, dan daftar alternatif. Tidak menggunakan CDN JavaScript atau geocoder eksternal. Peta menampilkan hasil pada halaman direktori saat ini, bukan seluruh database sekaligus.
- Latar OpenStreetMap hanya diaktifkan atas tindakan pengguna. Browser mengirim IP, asal situs (Referer origin), dan area tile; bukan kontak, judul atau isi laporan. Atribusi tetap terlihat. Permintaan memakai cache browser bawaan, tanpa bulk download/prefetch/offline. Pan/resize menunggu 160 ms untuk mengurangi permintaan sementara. Kebijakan tile resmi diperiksa pada 3 Oktober 2026; layanan best-effort tanpa SLA.
- Direktori lokasi tersendiri dapat dihubungkan ke lembaga master melalui pencarian/pilihan. Tidak mengimpor nomor pribadi atau afiliasi secara otomatis. Admin mengisi alamat, kategori, program/kebutuhan, verifikasi, koordinat opsional, serta kontak resmi/PIC. Rentang koordinat kasar -7,5 hingga -6,3 / 106,9 hingga 108,3 merupakan pengaman input operasional, bukan polygon atau batas wilayah resmi.
- Izin kontak default tertutup. Nomor yang dibagikan memerlukan konfirmasi dan sumber persetujuan. Server menyaring kontak tanpa izin dari respons portal; metadata persetujuan hanya untuk pengelola.
- Delapan template laporan, teks biasa yang di-escape React, simpan/edit draf, duplikasi, pratinjau revisi tersimpan, dan konfirmasi sebelum pengajuan. Placeholder yang belum diisi ditolak saat pengajuan, tetapi boleh tersimpan di draf.
- Moderasi eksplisit dengan alasan; laporan khusus pengelola tidak menjadi bersama hanya karena disetujui. Admin tidak boleh menyetujui laporannya sendiri. Revisi usang ditolak agar perubahan orang lain tidak tertimpa.
- Tindak lanjut manual: status pekerjaan, nama koordinator, tenggat, dan ringkasan. Ringkasan pada laporan bersama ikut terlihat bagi anggota, bukan tempat catatan internal.
- Pencarian, filter wilayah/kategori/status, paging, loading/error/retry, serta pengaman perubahan editor belum tersimpan.

**Belum disediakan:** pengajuan lokasi oleh asatidz, komentar/tawaran bantuan, lampiran, pengingat otomatis, ekspor, pengaturan wilayah dinamis, polygon, heatmap, dan analisis/dashboard agregat. Profil lokasi ditampilkan inline di direktori; tidak ada rute detail lembaga terpisah pada tahap pertama.

Migrasi tersedia melalui `npm run db:migrate:ukhuwah` (dry-run offline, 5 pernyataan). `npm run db:migrate:ukhuwah -- --apply` mengubah database yang dipilih DATABASE_MIGRATION_URL atau DATABASE_URL, secara atomik. Dua tabel, 49 kolom, 3 indeks; CREATE IF NOT EXISTS tidak mengubah tabel yang sudah ada dan bukan pengganti pemeriksaan skema/backup. Peran memakai ROLE_PERMISSIONS yang sudah tersedia; tidak ada akun/peran contoh yang ditambahkan. Rollback aplikasi tidak perlu menghapus tabel/data.

Validasi lokal: suite unit/API/SSR, typecheck/build dan `npm run test:ukhuwah:browser` (Chromium dengan API/tile simulasi; telemetry tes dinonaktifkan dan jaringan eksternal diblokir). Uji browser mencakup lokasi baru, kontak PIC privat, peta opt-in/opt-out, navigasi draf, simpan-pratinjau-konfirmasi-pengajuan, moderasi oleh pengelola lain, tindak lanjut, papan bersama, mobile, error/retry dan akses peran yang ditolak. Dry-run migrasi dan kesesuaian nama kolom/indeks diuji offline; migrasi belum dijalankan pada database nyata dan provider tile nyata belum diuji. Belum commit/push/deploy pada tahap implementasi ini.

**Sebelum rilis:** lakukan dry-run migrasi, verifikasi target dan cadangan, terapkan serta uji ulang di staging, kemudian migrasi produksi atas instruksi eksplisit. Unit/API dengan mock dan browser simulasi bukan bukti database atau hosting produksi telah bekerja.

## 1. Tujuan dan prinsip

Ruang kerja admin/YTS dan asatidz untuk mengenali lembaga, menghubungi penanggung jawab dengan izin, melaporkan kondisi dan kebutuhan dakwah, menemukan potensi kolaborasi, serta mencatat tindak lanjut. Bukan daftar penilaian kualitas agama individu/lembaga, kanal tuduhan, atau layanan darurat.

- Peta membantu menemukan lokasi; daftar yang dapat dicari tetap berfungsi bila layanan peta gagal.
- Setiap informasi mencantumkan sumber, tanggal, status verifikasi dan cakupan akses.
- Tidak ada laporan bukan berarti tidak ada kebutuhan. Rekap tidak mewakili survei seluruh wilayah.
- Nomor kontak, lokasi pribadi dan identitas pelapor tidak otomatis dibagikan.
- Laporan pengamatan tidak diperlakukan sebagai fakta terverifikasi.
- Tanggapan, persetujuan publikasi dan penyelesaian masalah adalah proses terpisah.
- Modul lintas-event: asatidz tidak harus mengikuti satu daurah tertentu untuk berkontribusi.

## 2. Temuan aplikasi saat ini

- React 18, React Router 6, TypeScript, Vite, Tailwind dan lucide-react tersedia.
- Backend memakai Netlify functions, Drizzle, Neon dan Zod.
- `netlify/functions/lib/db/schema/master_data.ts`: institutions memiliki alamat, kode kota/provinsi, district, phone, whatsapp, website, status dan verificationStatus. Belum memiliki koordinat, pengaturan berbagi kontak atau lokasi cabang.
- Tersedia ustadz_profiles, institution_representatives dan ustadz_institution_affiliations. Afiliasi bukan otomatis izin membuka kontak pribadi.
- `src/lib/indonesiaRegionData.ts` dapat digunakan untuk validasi kabupaten/kota dan penurunan provinsi. Belum cukup untuk polygon/kode kecamatan.
- Rute dilindungi ProtectedRoute. Pembatasan modul harus dilakukan lagi di backend, bukan hanya menyembunyikan menu.
- Ruang Asatidz dapat menjadi referensi pola laporan/pesan, tetapi laporan wilayah tidak boleh mengambil atau membuka percakapan pribadi Ruang Asatidz.
- Belum ada dependency Leaflet, React-Leaflet atau MapLibre. Pemilihan/adopsi library peta merupakan keputusan implementasi tersendiri; tidak mengandalkan CDN tanpa pin versi.

## 3. Cakupan wilayah

Usulan cakupan operasional awal:

1. Kota Bandung.
2. Kota Cimahi.
3. Kabupaten Bandung.
4. Kabupaten Bandung Barat.
5. Kecamatan terpilih di Kabupaten Sumedang: Jatinangor, Cimanggung, Sukasari, Tanjungsari dan Pamulihan, sebagai opsi cakupan Cekungan Bandung.

Referensi pemerintah: Perpres 45 Tahun 2018 tentang Rencana Tata Ruang Kawasan Perkotaan Cekungan Bandung dan E-Kiprah DPRD Sumedang edisi Oktober 2021, pembahasan kawasan Jatinangor. Istilah Bandung Raya dan definisi metropolitan lain tidak diasumsikan identik; label aplikasi menjelaskan cakupan operasional yang dipilih. Pada pemeriksaan ini metadata Perpres dan cuplikan terindeks publikasi Sumedang tersedia; PDF penuh gagal diambil. Karena itu cakupan di atas tetap usulan operasional, bukan hasil verifikasi pasal/batas hukum terkini.

Daftar kecamatan perlu dinormalisasi dan diverifikasi sebelum dijadikan filter wajib. Kabupaten Sumedang tidak boleh diterima seluruhnya hanya karena kode kabupaten cocok. Jika kecamatan belum dapat diverifikasi, tandai lokasi 'cakupan perlu verifikasi', bukan otomatis masuk cakupan.

Simpan konfigurasi wilayah beserta sumber, versi dan tanggal verifikasi. Jangan menggambar polygon perkiraan sebagai batas resmi. Polygon dari sumber berlisensi harus diperiksa cakupan, versi, atribusi dan hak distribusinya sebelum ditampilkan.

## 4. Navigasi dan layar yang diusulkan

### Admin

- `/admin/peta-ukhuwah`: ringkasan + peta dan daftar.
- `/admin/peta-ukhuwah/lembaga`: titik/lokasi lembaga, verifikasi koordinat dan izin kontak.
- `/admin/peta-ukhuwah/laporan`: laporan, pencarian dan filter.
- `/admin/peta-ukhuwah/moderasi`: pengajuan lembaga, perubahan kontak, laporan dan komentar menunggu review.
- `/admin/peta-ukhuwah/tindak-lanjut`: penugasan, tenggat dan hasil.
- `/admin/peta-ukhuwah/pengaturan`: cakupan, kategori, koordinator dan aturan berbagi.

### Portal Asatidz

- `/portal/peta-ukhuwah`: peta/daftar yang disetujui untuk anggota.
- `/portal/peta-ukhuwah/lembaga/:id`: profil lokasi dan kontak yang diizinkan.
- `/portal/peta-ukhuwah/laporan`: papan laporan bersama yang disetujui.
- `/portal/peta-ukhuwah/laporan/baru`: formulir bertemplate + pratinjau.
- `/portal/peta-ukhuwah/laporan-saya`: draft, status moderasi dan permintaan koreksi milik sendiri.
- `/portal/peta-ukhuwah/laporan/:id`: detail sesuai akses, tanggapan dan tindak lanjut.

Tidak ada rute publik tanpa login dalam versi awal. Jangan menambahkan tautan publik baru ke menu portal. Semua halaman memiliki loading, empty, error/retry, akses ditolak dan tampilan mobile.

## 5. Peta dan direktori lembaga

### Data lokasi

- Hubungkan titik ke institutionId yang sudah ada; satu lembaga dapat memiliki beberapa lokasi/cabang.
- Nama lokasi, jenis (pesantren, masjid, yayasan, majelis, pusat pendidikan, lainnya), alamat, kabupaten/kota, kecamatan, kelurahan bila tersedia.
- Latitude/longitude, ketelitian lokasi, sumber koordinat, waktu pengecekan, pemeriksa.
- Koordinat bisa dipilih dengan pin atau diisi manual; alamat tidak otomatis dianggap menghasilkan koordinat yang benar.
- Label 'belum dipetakan' untuk lembaga tanpa koordinat; tetap tampil di direktori.
- Fasilitas, program aktif, sasaran pembinaan, jadwal umum dan potensi kontribusi. Hindari biodata jamaah per individu.
- Verifikasi data dan aktivitas operasional terpisah. 'Terverifikasi' hanya berarti informasi telah diperiksa, bukan endorsement.

### Interaksi peta

- Zoom/pan, kelompok titik saat padat, klik pin membuka kartu detail yang juga dapat diakses melalui daftar.
- Filter wilayah, jenis lembaga, program, kategori kebutuhan, status verifikasi dan tanggal pembaruan.
- Pilihan lapisan lembaga/kebutuhan/kolaborasi; jangan membuat heatmap sensitif per rumah/individu.
- Legenda membedakan verifikasi dan kategori, bukan warna 'lembaga baik/buruk'.
- Tautan arah perjalanan merupakan tindakan pengguna; jangan mengirim identitas/laporan ke penyedia peta.
- Lokasi saya opsional dengan persetujuan browser, tidak disimpan dan tidak ditampilkan ke anggota lain.
- Kebutuhan sensitif hanya ditampilkan sebagai agregat wilayah yang cukup besar, atau tidak ditampilkan sama sekali bila berisiko mengidentifikasi pihak tertentu.

### Penyedia dan teknis

Evaluasi Leaflet sebagai kandidat library peta interaktif; belum dipasang dan belum ditetapkan sebagai dependency aplikasi. Dokumentasi resminya mencakup marker, popup, polygon dan event klik; data pengguna tidak boleh dimasukkan sebagai HTML popup mentah.

Penyedia tile terpisah dari library. Jika memakai tile standar OSM: atribusi terlihat, HTTPS, Referer sesuai kebijakan, hormati caching dan tanpa bulk/offline prefetch. Layanan tile publik tidak memiliki SLA; penyedia produksi harus ditentukan sesuai kebutuhan beban, biaya dan privasi.

Jangan memanggil geocoder pihak ketiga pada setiap ketikan tanpa memeriksa ketentuan/autocomplete. Versi awal dapat memakai pencarian wilayah lokal dan pemilihan pin manual. Tile hanya menerima koordinat viewport, bukan nama ustadz, nomor kontak, atau isi laporan. Browser tetap mengungkapkan metadata jaringan kepada penyedia; jelaskan sebelum peta eksternal dimuat dan sediakan alternatif daftar.

Lazy-load halaman/peta; dependency peta tidak masuk bundle login/beranda. Data marker berasal dari endpoint tersaring, bukan seluruh basis data lembaga. Batas jumlah marker dan cluster menghindari browser kewalahan; server melakukan pagination/filter/bounding-box bila diperlukan.

## 6. Kontak dan penanggung jawab

- Pisahkan telepon/WhatsApp resmi lembaga dari kontak pribadi ustadz PIC.
- PIC dapat ditautkan ke profil asatidz yang sudah ada; tanggung jawab ditetapkan/disetujui, tidak dapat diklaim sendiri tanpa verifikasi.
- Simpan nama, jabatan/peran, masa penugasan, kontak khusus koordinasi dan jam kontak bila disetujui.
- Izin terpisah untuk menampilkan nama dan nomor, cakupan anggota/admin, pemberi izin, tanggal, sumber konfirmasi, masa berlaku serta pencabutan.
- Checkbox pelapor saja bukan bukti persetujuan pemilik nomor. Usulan kontak menunggu konfirmasi pemilik/lembaga.
- Kontak existing tidak otomatis diekspor ke modul baru. Jangan menyalin nomor profil ke respons bersama bila izin belum ada.
- Tombol WhatsApp/telepon hanya muncul jika nomor valid dan diizinkan; pesan awal sopan tidak membawa laporan sensitif.
- Nomor tersembunyi dapat diganti tindakan 'minta dihubungkan melalui koordinator'; implementasi tidak memerlukan pengiriman otomatis tahap awal.
- Pencabutan izin harus langsung menghilangkan nomor dari API bersama, marker, hasil pencarian, ekspor dan cache. Cache respons privat no-store.

## 7. Laporan kebutuhan, kondisi dan peluang dakwah

### Kategori konstruktif

Kebutuhan pengajar, pembinaan remaja, pembelajaran Al-Quran, kelas keluarga, sarana/prasarana, materi/literasi, akses/transportasi, kaderisasi, program baru, kolaborasi, sosial/kemanusiaan, perkembangan kegiatan dan lainnya.

Jangan menyediakan kategori yang menstigma orang/kelompok berdasarkan agama atau keyakinan. Laporan perilaku/keselamatan serius bersifat admin-only dan memerlukan penanganan manusia, bukan papan tuduhan bersama.

### Kolom laporan

- Judul, kategori, lokasi/area dan opsional lembaga terkait.
- Tanggal pengamatan dan sumber (pengamatan langsung, informasi PIC, perkiraan, lainnya).
- Kondisi faktual, hambatan/kebutuhan, potensi yang tersedia dan usulan bantuan.
- Sasaran, perkiraan jumlah penerima manfaat dalam bentuk agregat dan alasan urgensi.
- Tingkat prioritas pengusul terpisah dari hasil penilaian admin.
- Keterangan verifikasi, keterbatasan informasi dan tanggal pembaruan.
- Pilihan audience: SHARED (anggota setelah moderasi) atau ADMIN_ONLY.
- Identitas pelapor diketahui sistem/admin. Opsi tidak menampilkan nama kepada anggota bukan anonim terhadap pengelola.
- Pratinjau persis field yang akan dibagikan, ringkasan izin, simpan draft, buka/edit/duplikasi, lalu konfirmasi pengajuan.
- Lampiran opsional hanya tahap lanjutan setelah storage privat, validasi file, batas ukuran, scanning dan izin download siap. Jangan menjanjikan upload tahap awal.

### Template laporan

1. Pemetaan awal wilayah: lokasi, sumber, kegiatan tersedia, kebutuhan dan kontak koordinasi.
2. Permintaan pengajar: tema, sasaran, waktu, frekuensi, fasilitas dan PIC.
3. Kunjungan/silaturahmi: tanggal, pihak yang mengizinkan, hasil, peluang dan tindak lanjut.
4. Sarana/perlengkapan: kondisi, kebutuhan spesifik, prioritas dan dukungan yang ada.
5. Pembinaan remaja/keluarga: sasaran agregat, tantangan teramati, program usulan dan ukuran keberhasilan.
6. Kolaborasi kegiatan: mitra, peran, lokasi, jadwal, kontribusi yang dibutuhkan.
7. Evaluasi/perkembangan: baseline, tindakan, hasil, kendala dan kebutuhan berikutnya.
8. Informasi sensitif kepada admin: fakta terbatas, konteks, kebutuhan bantuan dan pihak pengelola; ADMIN_ONLY terkunci.

Template tidak mengarang kondisi. Placeholder [ISI: ...] dan variabel belum lengkap menghalangi pengajuan sampai diperbaiki; draft tetap boleh disimpan.

## 8. Alur laporan bersama dan moderasi

Publikasi: DRAFT -> PENDING -> APPROVED / REJECTED; APPROVED dapat menjadi HIDDEN oleh moderator. Status tindak lanjut terpisah: OPEN, IN_PROGRESS, RESOLVED, ARCHIVED.

- Admin dan ustadz sama-sama dapat membuat laporan. Bahkan laporan admin harus dipratinjau dan dipublikasikan eksplisit, tidak terbuka otomatis karena role.
- Asatidz dapat membaca hanya APPROVED+SHARED; draft/pending/rejected milik sendiri tetap dapat dilihat/diperbaiki.
- ADMIN_ONLY hanya penulis dan pengelola berizin, termasuk judul, koordinat, komentar dan hitungan. Tidak masuk statistik bersama.
- Moderator boleh menyetujui, meminta koreksi/menolak dengan alasan, menyembunyikan, mencabut publikasi dan mengelola akses.
- Versi awal: edit isi laporan yang sudah approved menariknya dari papan dan mengembalikan ke PENDING. Jika kelak mempertahankan versi published, wajib model revisi terpisah, bukan membuka draft baru.
- Perubahan audience ADMIN_ONLY -> SHARED wajib review baru; SHARED -> ADMIN_ONLY segera menutup akses anggota. Tidak ada peningkatan akses otomatis.
- Semua pembacaan detail/komentar mengecek audience dan status, tidak hanya query daftar.
- Komentar/penawaran bantuan anggota juga dimoderasi sebelum terlihat bersama; komentar pribadi dan catatan moderator tidak dicampur dalam respons bersama.
- Riwayat perubahan mencatat actor, waktu, revisi, keputusan dan alasan; log tidak menyimpan nomor/isi laporan sensitif yang tidak diperlukan.
- Laporkan konten/koreksi data tersedia. Tidak ada like/dislike atau peringkat personal sebagai ukuran validitas.
- Optimistic concurrency: revisi expectedUpdatedAt/version; backend menolak update/publikasi usang dengan 409.

## 9. Tindak lanjut dan kolaborasi

- Admin menetapkan koordinator/PIC, target tanggal dan rencana kerja; PIC harus pengguna terverifikasi dan menyetujui penugasan bila diperlukan.
- Anggota mengajukan tawaran: keahlian, waktu, bentuk kontribusi; tawaran bukan otomatis assignment atau pembukaan kontak.
- Admin mempertemukan kebutuhan dan tawaran secara manual; tidak ada profil kecocokan otomatis berdasarkan keyakinan/sifat pribadi.
- Catatan kemajuan, hambatan, hasil terukur, penyelesaian dengan ringkasan, buka kembali bila masih relevan.
- Bedakan tindakan internal dengan update bersama; hanya ringkasan yang disetujui masuk papan anggota.
- Pengingat awal dalam dashboard; email/WhatsApp otomatis baru setelah template, consent, queue dan konfigurasi provider diuji.

## 10. Hak akses yang diusulkan

Permission baru: ukhuwah.access, ukhuwah.contribute, ukhuwah.manage, ukhuwah.moderate, ukhuwah.assign, ukhuwah.export, ukhuwah.view_sensitive.

- USTADZ aktif: akses shared, membuat/edit draft milik sendiri, mengajukan laporan dan komentar. Tidak dapat mengubah master lembaga atau izin kontak orang lain.
- SUPER_ADMIN / SYSTEM_ADMIN dengan assignment global aktif: pengelolaan dan moderasi; sensitif dan ekspor tetap dicatat.
- DATA_STEWARD: hanya bila diberi permission pengelolaan lokasi/kualitas data; tidak otomatis melihat laporan sensitif.
- Koordinator wilayah: rencana role/assignment wilayah tersendiri; jangan meminjam eventId untuk membatasi kecamatan.
- REPORT_VIEWER / EVENT_ADMIN / panitia: tidak otomatis memperoleh akses semua laporan atau nomor kontak karena memiliki akses portal admin.
- Backend mengecek role assignment aktif, scope, status account dan ownership setiap operasi. UI mencerminkan izin, bukan menggantikannya.
- Tidak ada data modul untuk anonymous visitor. Ekspor terbatas, tercatat, berizin dan disaring sesuai field; cegah CSV formula injection.

## 11. Model data usulan (belum dibuat)

- ukhuwah_locations: institution FK, label/type, region/district, koordinat, ketelitian, sumber, verifikasi, visibility, metadata actor/version/archive.
- ukhuwah_contacts: location/institution FK, opsional ustadz FK, kontak koordinasi, consent/visibility/verified/revoked, masa tugas. Batasi salinan field sensitif.
- ukhuwah_location_proposals: pengajuan anggota untuk lokasi/kontak, status, reviewer, koreksi dan revisi. Master hanya berubah setelah persetujuan.
- ukhuwah_reports: owner user FK, optional location FK, region, category, title, structured/plain text, observation/source, audience, publicationStatus, workStatus, version, timestamps.
- ukhuwah_report_comments: author FK, report FK, body, audience dan status moderasi.
- ukhuwah_followups: report FK, assignee FK, due date, progress, internal/shared approved summary, status/version.
- ukhuwah_region_settings: daftar area, kode kecamatan terverifikasi, sumber/versi, aktif/tidak aktif.
- Gunakan audit_logs existing dengan action khusus. Template awal dapat berupa shared typed constants; template custom database tahap berikutnya bila diperlukan.

Indeks region/status/date, report owner/date dan relation ID. Foreign key dan soft archive menjaga riwayat. Latitude [-90,90] dan longitude [-180,180] harus berpasangan; pemeriksaan cakupan administratif berbeda dari validasi angka. Endpoint shared menggunakan allowlist DTO field, bukan select seluruh row dan menghapus field di browser.

## 12. Kontrak API usulan

Shared authenticated `/ukhuwah`: GET locations + filters/bbox/pagination, GET location detail, GET shared reports + paging, GET my-reports, POST/PATCH my draft, POST report submit, GET report detail, POST comment/offer/proposal.

Admin `/admin/ukhuwah`: lokasi/contacts CRUD terscope, proposals review, laporan moderation, followup assignment/update, pengaturan, rekap dan restricted export. Identifier UUID tervalidasi, body Zod strict, parameter filter diizinkan terbatas.

Respons daftar/detail/rekap/ekspor konsisten privasinya; 404 untuk resource yang tidak dapat diakses tanpa membocorkan keberadaan; no-store untuk data privat; rate limit kontribusi dan ekspor. Uji URL langsung tidak boleh melewati akses.

## 13. Dashboard dan indikator

- Lembaga/lokasi terverifikasi, belum ada koordinat, kontak perlu konfirmasi, data perlu diperbarui.
- Laporan shared per kategori/wilayah/status dan periode, kebutuhan belum ditindaklanjuti, tindak lanjut lewat tenggat.
- Potensi kontribusi dan kolaborasi selesai, bukan ranking kualitas lembaga/ustadz.
- Tampilkan jumlah sumber/laporan dan rentang tanggal, jangan menyimpulkan prevalensi masalah dari jumlah laporan saja.
- Versi awal rekap tanpa nomor personal/identitas pelapor. Ekspor sensitif dan heatmap ditunda.
- Usulan masa tinjau data 90 hari dapat diatur admin, bukan diasumsikan fakta tentang validitas kontak.

## 14. Tahap implementasi

### Tahap 1: dasar siap pakai

Rute admin/portal + permission baru; peta/daftar lembaga dengan pin tervalidasi; kontak resmi/PIC dengan persetujuan; 8 template laporan; draft/edit/pratinjau/submit; moderasi shared/admin-only; pencarian/filter; tindak lanjut manual; indikator dasar; tests unit/API/UI/browser. Tidak ada data lembaga contoh dianggap nyata, pengiriman otomatis, ekspor sensitif atau halaman publik.

### Tahap 2: kolaborasi

Komentar/tawaran bantuan dimoderasi, koordinator wilayah, import pratinjau/duplikasi, jadwal kegiatan, pengingat opt-in, dashboard agregat dan ekspor terbatas.

### Tahap 3: analisis

Polygon terverifikasi, agregasi kebutuhan wilayah, perubahan periodik, pencocokan manual potensi bantuan dan evaluasi dampak. Tidak ada inference keyakinan/penilaian personal otomatis.

## 15. Kriteria penerimaan dan rilis

- API anonymous ditolak; event-scoped admin tidak boleh mengelola modul lintas-event tanpa permission baru.
- Shared list/detail/map/count/search/comment/export tidak mengungkap admin-only, draft, kontak revoked atau identitas pelapor tersembunyi.
- Pemilik dapat menyimpan draft dan mengajukan, tetapi tidak dapat menyetujui sendiri lewat manipulasi body/API.
- Nomor yang dipublikasikan harus valid, terkonfirmasi, masih berizin; URL WhatsApp tidak mengandung informasi privat.
- Wilayah/provinsi canonical, Sumedang dipilih kecamatan bukan seluruh kabupaten, titik koordinat terverifikasi atau berlabel belum verifikasi.
- Sanitasi HTML/popup, link aman, length limits, placeholder guard dan concurrent update guard diuji.
- Mobile, keyboard, daftar alternatif peta, jaringan lambat, error provider, loading/retry dan navigasi draft aman diuji.
- Library peta lazy-loaded, no production secrets browser, provider attribution/caching sesuai kontrak.
- Unit/API/SSR + browser mocked API; integration opt-in DB staging dengan actor/reports sensitif dan cleanup; tidak menghubungi kontak/lembaga asli.
- Sebelum produksi: permission/seed migration ditinjau, backup target diverifikasi, staging migration+idempotency tested, verifikasi schema/index dan DTO privacy, apply produksi eksplisit, deploy, smoke akun uji berizin, rollback tanpa menghapus data.
- Semua fitur ditandai jelas selesai/ditunda. Sukses build bukan bukti peta provider/DB produksi telah teruji.

## 16. Referensi eksternal yang diperiksa

- Perpres Nomor 45 Tahun 2018, Rencana Tata Ruang Kawasan Perkotaan Cekungan Bandung (BPK/JDIH pemerintah).
- DPRD Kabupaten Sumedang, E-Kiprah Oktober 2021, pembahasan kawasan Jatinangor (cuplikan terindeks; PDF penuh belum dapat diperiksa).
- Leaflet official Quick Start Guide: interaksi, marker, popup, provider independence, peringatan untrusted HTML.
- OpenStreetMap Foundation, Tile Usage Policy: atribusi, Referer, caching, best-effort tanpa SLA, larangan bulk/offline prefetch dan privasi.

Dokumen ini bukan pendapat hukum. Sumber wilayah dan syarat provider harus diverifikasi ulang saat implementasi/rilis; konfigurasi internal ukhuwah bukan penetapan batas administratif resmi.