# Tinjauan Pasca-Acara & Pengelompokan Umpan Balik (Post-Event Review & Feedback Classification)
**Sistem Informasi Daurah Asatidz YTS**

---

## 1. Pengelompokan Umpan Balik Multi-Stakeholder

Disesuaikan dengan aturan tata kelola produk, masukan pengguna **TIDAK DITAMBAHKAN LANGSUNG** secara *knee-jerk feature creep*, melainkan dikelompokkan berdasarkan peran, tingkat dampak operasional, dan frekuensi kemunculan.

### A. Umpan Balik Executive Admin
- **Masukan**: Diinginkan ringkasan rekapitulasi kehadiran per wilayah provinsi yang dapat di-download dalam format PDF siap cetak.
- **Analisis Dampak**: Dampak Sedang (*Medium Impact*). Saat ini sistem sudah menyediakan export CSV/XLSX dan tabel wilayah terpaginasi.
- **Tindakan**: Dimasukkan ke *backlog* iterasi mendatang (PDF Generation Module).

### B. Umpan Balik Panitia On-Site
- **Masukan**: Saat puncak antrean, bunyi beeper suara (*audio chime*) saat scan sukses sangat membantu petugas tanpa harus selalu menatap layar HP/tablet.
- **Analisis Dampak**: Dampak Tinggi (*High Impact / Low Effort*). Mempercepat konfirmasi presensi petugas di lapangan.
- **Tindakan**: Dijadwalkan untuk penambahan komponen Audio Feedback Chime pada iterasi berikutnya.

### C. Umpan Balik Ustadz Peserta
- **Masukan**: Keinginan untuk mengunduh berkas materi daurah (PDF slide presentasi) langsung dari Portal Ustadz.
- **Analisis Dampak**: Dampak Tinggi (*High Impact* untuk *user engagement*).
- **Tindakan**: Dimasukkan ke modul Materi & Modul Daurah di Portal Ustadz pada peta jalan iterasi mendatang.

### D. Umpan Balik Perwakilan Lembaga
- **Masukan**: Kemudahan mengganti ustadz utusan (*replacement*) saat ada ustadz yang berhalangan mendadak sangat membantu sekretariat lembaga.
- **Analisis Dampak**: Terverifikasi sangat positif (*Success Confirmation*). Workflow replacement tanpa penghapusan data lama berjalan presisi.

---

## 2. Root Cause Analysis (RCA) Kendala Operasional Minor

| Kendala Lapangan | Dampak Operasional | Akar Masalah (Root Cause) | Tindakan Korektif & Mitigasi |
|---|---|---|---|
| 3 Email Bounced | Kontak email tidak terjangkau | Perwakilan lembaga memasukkan salah ketik domain email (misal: `@gmial.com`) | Ditambahkan skema Zod regex validator domain email populer di formulir pendaftaran. |
| Layar HP Peserta Redup | Scanner butuh 2x percobaan | Tingkat kecerahan (*brightness*) layar HP ustadz terlalu rendah | Fitur Kode Fallback (`PAR-2026-XXXX`) langsung digunakan petugas (< 7 detik). |

---

## 3. Hal-Hal Yang Berjalan Sangat Baik (What Went Well)

1. **Zero Duplicate Attendance**: Transaksi atomis PostgreSQL mencegah 100% presensi ganda.
2. **Dynamic Location QR**: Layar proyektor lokasi dinamis yang berotasi 30 detik berhasil mencegah pembagian foto QR statis dari luar lokasi acara.
3. **Decoupled Email Architecture**: Pengiriman email yang bersifat asinkron memastikan sistem konfirmasi DB tidak pernah lambat atau tergagal oleh kendala mail server.
