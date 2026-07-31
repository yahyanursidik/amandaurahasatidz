# Peta Jalan Iterasi Mendatang (Next Iteration Roadmap)
**Sistem Informasi Daurah Asatidz YTS**

---

## 1. Matriks Prioritas Fitur (Impact vs Effort Matrix)

Seluruh usulan fitur baru dikelompokkan dan diprioritaskan menggunakan **Impact vs Effort Matrix** untuk menghindari penambahan fitur tanpa arah yang jelas (*unplanned feature creep*).

```text
       HIGH IMPACT
            |
   [P1]     |     [P2]
Audio Chime | PDF Material Portal
Email Validator | PDF Executive Summary
------------+------------
   [P4]     |     [P3]
            | Distributed Redis Rate Limiter
            |
        LOW IMPACT
     LOW EFFORT  ---> HIGH EFFORT
```

---

## 2. Rincian Peta Jalan Iterasi (Prioritized Roadmap)

### Prioritas 1: Quick Wins (High Impact, Low Effort) - Sprint 1 Mendatang
1. **Audio Feedback Chime Scanner**: Penambahan efek suara beep (*success/warning audio chime*) pada halaman [OnSiteCheckinPage.tsx](file:///c:/Users/P%20R%20E%20D%20A%20T%20O%20R/Documents/amandaurahasatidz/src/pages/committee/OnSiteCheckinPage.tsx) untuk mempercepat konfirmasi petugas tanpa menatap layar.
2. **Domain Email Typos Standardizer**: Penambahan validasi Zod untuk mendeteksi salah ketik domain email umum (misal: `@gmai.com`, `@yaho.com`).

### Prioritas 2: Major Enhancements (High Impact, High Effort) - Sprint 2 Mendatang
1. **Modul Berkas & Materi Daurah**: Fitur pengunduhan slide presentasi dan materi daurah dalam bentuk PDF langsung di Portal Ustadz.
2. **PDF Executive Report Generator**: Generator laporan eksekutif berformat PDF dengan grafik visualisasi partisipasi per provinsi/lembaga.

### Prioritas 3: Infrastructure Scaling (Low Impact Now, High Effort) - Phase 2 Skala Besar
1. **Distributed Redis Rate Limiter**: Imigrasi dari memory rate limiter ke Redis/Upstash apabila peserta acara melonjak melebihi 10.000 ustadz secara simultan.

---

## 3. Manajemen Utang Teknis (Technical Debt Inventory)

| Item Utang Teknis | Lokasi Komponen | Rencana Pelunasan |
|---|---|---|
| Native Config Loader Warning Vite | `vite.config.ts` | Refactor `__dirname` ke `import.meta.dirname` pada iterasi upgrade Vite minor berikutnya. |
| React Babel Plugin Warning | `vite.config.ts` | Evaluasi migrasi dari `@vitejs/plugin-react-babel` ke `@vitejs/plugin-react-oxc` untuk kompilasi lebih cepat. |
