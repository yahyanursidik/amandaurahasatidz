# Pemetaan Modul dan Matriks Ketergantungan

Dokumen ini memetakan seluruh modul backend dan frontend beserta ketergantungan (dependencies), batas kepemilikan data (data ownership), dan transaksi lintas modul pada **Sistem Informasi Daurah Asatidz YTS**.

---

## 1. Daftar Modul Sistem

| Kode Modul | Nama Modul | Tanggung Jawab Utama |
|---|---|---|
| `MOD-01` | **Auth & Users** | Autentikasi pengguna, kelola akun, session, dan token. |
| `MOD-02` | **RBAC & Permissions** | Evaluasi role global, role event, dan scope akses. |
| `MOD-03` | **Institutions** | Master data lembaga dakwah, kategori, alamat, dan perwakilan. |
| `MOD-04` | **Ustadz Profiles** | Master data profil ustadz, riwayat keahlian, dan duplicate detection. |
| `MOD-05` | **Affiliations** | Hubungan afiliasi antara Ustadz dan Lembaga (multi-afiliasi). |
| `MOD-06` | **Events & Schedule** | Event daurah, hari kegiatan (`event_days`), dan sesi (`event_sessions`). |
| `MOD-07` | **Committees** | Penugasan panitia event dan izin spesifik per kegiatan. |
| `MOD-08` | **Invitations & Links** | Undangan lembaga/individu, nomor undangan, dan token link unik. |
| `MOD-09` | **Registration & Responses**| Form publik perwakilan, pendaftaran delegasi, draft, dan konfirmasi. |
| `MOD-10` | **Participants** | Status peserta event, approval, waitlist, cancellation, dan replacement. |
| `MOD-11` | **Email Engine** | Template email, queue (`email_jobs`), worker, dan delivery tracking. |
| `MOD-12` | **Check-in & QR** | Generator QR opaque, token check-in, dan scanner panitia. |
| `MOD-13` | **Attendance** | Pencatatan kehadiran harian/sesi, late calculation, dan koreksi manual. |
| `MOD-14` | **Announcements** | Pengumuman event dan penargetan audiens peserta. |
| `MOD-15` | **Reports & Export** | Agregasi data, statistik kehadiran, dan ekspor CSV/XLSX. |
| `MOD-16` | **Audit Logs** | Logging Jejak audit untuk seluruh aksi sensitif dan perubahan status. |

---

## 2. Matriks Ketergantungan Modul (Dependency Matrix)

Tabel berikut menunjukkan modul mana saja yang dibutuhkan (*Required Dependencies*) oleh suatu modul agar dapat berjalan dengan benar.

```text
MOD-01 (Auth)        <-- Root
MOD-02 (RBAC)        <-- MOD-01
MOD-03 (Institutions)<-- MOD-16
MOD-04 (Ustadz)      <-- MOD-01, MOD-16
MOD-05 (Affiliations)<-- MOD-03, MOD-04
MOD-06 (Events)      <-- MOD-01, MOD-16
MOD-07 (Committees)  <-- MOD-01, MOD-06
MOD-08 (Invitations) <-- MOD-03, MOD-04, MOD-06
MOD-09 (Registration)<-- MOD-03, MOD-08
MOD-10 (Participants)<-- MOD-03, MOD-04, MOD-06, MOD-08
MOD-11 (Email Engine)<-- MOD-06, MOD-08, MOD-10
MOD-12 (Check-in)    <-- MOD-06, MOD-10
MOD-13 (Attendance)  <-- MOD-06, MOD-10, MOD-12
MOD-14 (Announcement)<-- MOD-06, MOD-10
MOD-15 (Reports)     <-- MOD-03, MOD-04, MOD-06, MOD-10, MOD-13
MOD-16 (Audit Logs)  <-- MOD-01, MOD-06
```

---

## 3. Batas Transaksi Lintas Modul (Transactional Boundaries)

Operasi multi-step berikut **WAJIB** menggunakan Transaksi Basis Data (`db.transaction`) untuk menjaga konsistensi data:

1. **Submit Final Undangan Lembaga (`MOD-09` -> `MOD-10`)**:
   - Memvalidasi kuota undangan.
   - Menyimpan respons final perwakilan lembaga.
   - Membuat/menghubungkan profil ustadz delegasi.
   - Menginsert baris `event_participants` dengan status `SUBMITTED`.
   - Menulis catatan di `audit_logs`.

2. **Merge Profil Ustadz Duplikat (`MOD-04` -> `MOD-05` -> `MOD-10`)**:
   - Memindahkan seluruh afiliasi lembaga ke profil survivor.
   - Memindahkan riwayat partisipasi event (`event_participants`) ke profil survivor.
   - Menandai profil lama sebagai `MERGED` dengan `merged_into_id`.
   - Mengkaji ulang constraint unik agar tidak duplikat di event yang sama.
   - Menulis detail sebelum dan sesudah di `audit_logs`.

3. **Check-in Peserta & Log (`MOD-12` -> `MOD-13`)**:
   - Verifikasi token/kode scan.
   - Pengecekan row `attendance_records` existing (mencegah double-scan).
   - Pengisipan baris `attendance_records` (`PRESENT` atau `LATE`).
   - Pencatatan telemetry scan di `checkin_logs`.

4. **Penggantian Peserta (`replaceParticipant`) (`MOD-10`)**:
   - Menandai peserta lama sebagai `REPLACED`.
   - Memasukkan peserta baru dengan rujukan `replacement_for_participant_id`.
   - Mencatat histori di `participant_status_histories`.

5. **Locking Worker Queue Email (`MOD-11`)**:
   - Batch query `email_jobs` bertanda `QUEUED` dengan `scheduled_at <= now()`.
   - Atomic update status menjadi `PROCESSING` dengan `locked_at` & `locked_by`.
