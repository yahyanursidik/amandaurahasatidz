# Pemuatan halaman dan peringatan pengujian

## Pemisahan bundle

Halaman pada `src/App.tsx` menggunakan import dinamis literal melalui `React.lazy`, dideklarasikan di tingkat modul. Setiap halaman dimuat ketika rutenya dirender, bukan seluruh portal sekaligus. `CommitteeLayout` untuk halaman check-in juga dipisahkan. Guard autentikasi/role tetap berada di luar halaman lazy; akses ditolak tidak memuat modul halaman terlarang.

`RouteLoadingBoundary` menyediakan fallback dengan `role="status"` dan pengumuman sopan saat chunk dimuat. Error boundary menampilkan pemulihan manual jika pemuatan gagal. Tidak ada reload/retry otomatis, agar tidak terjadi loop atau kehilangan input tanpa tindakan pengguna. Navigasi berikutnya mereset error boundary tanpa meremount halaman sehat. Tombol reload mengingatkan bahwa input yang belum disimpan mungkin hilang.

Pengukuran build lokal 2 Oktober 2026:

| Metrik | Sebelum | Sesudah |
| --- | ---: | ---: |
| JavaScript entry utama | 979,36 kB | 348,21 kB |
| Gzip entry utama | 259,14 kB | 111,13 kB |
| Chunk halaman terbesar | — | 71,39 kB |

Ini mengurangi unduhan awal, bukan mengurangi seluruh kode fitur menjadi 348 kB. Chunk tambahan dimuat sesuai kebutuhan. Batas peringatan bundle bawaan tidak dinaikkan; tidak ada chunk JavaScript yang melewati 500 kB pada build tersebut. Build dapat memberi diagnostik waktu plugin yang terpisah dari ukuran bundle.

## Peringatan Neon dan SSR

- `client.ts` dan `migrationClient.ts` tidak lagi menyetel `neonConfig.fetchConnectionCache`; opsi deprecated sudah selalu aktif pada driver yang dipakai. Tidak ada perubahan dependency.
- Tes render server memakai `StaticRouter`, bukan router klien `MemoryRouter`. Tes UI mengawasi `console.error`, dan tes lazy routing juga mengawasi `console.warn`, tanpa menonaktifkan konsol secara global.
- Tes lazy routing mengubah komponen redirect klien menjadi marker tujuan dalam harness SSR. Guard tetap asli; tes memeriksa tujuan login/portal serta memastikan modul halaman admin tidak diimpor ketika akses ditolak. Ini bukan simulasi navigasi browser.

## Validasi

```powershell
npm run typecheck
npm test -- --maxWorkers=2
npm run build
```

Tes regresi `route_loading.test.tsx` mencakup rute publik/admin/panitia/portal, props mode halaman, guard, fallback pemuatan, dan pemulihan manual. Tes integrasi database Ruang Asatidz bersifat opt-in; lihat `RUANG_ASATIDZ.md`.