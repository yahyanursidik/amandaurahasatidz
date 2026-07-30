# Dokumentasi Struktur Frontend dan Alasan Desain

Dokumen ini menjelaskan arsitektur folder frontend, prinsip UI/UX, serta alasan pemilihan komponen pada **Sistem Informasi Daurah Asatidz YTS**.

---

## 1. Struktur Direktori Frontend (`src/`)

```text
src/
├── config/
│   ├── env.ts                   # Konfigurasi environment & URL API
│   ├── permissions.ts           # Definisi permission codes & matriks role RBAC
│   └── designTokens.ts          # Color tokens, typography, dan touch targets
├── lib/
│   ├── refine/
│   │   ├── authProvider.ts      # Provider autentikasi Refine Core
│   │   ├── dataProvider.ts      # Provider REST API data Refine Core
│   │   └── accessControlProvider.ts # Provider evaluasi hak akses Refine
│   └── utils.ts                 # Utility tailwind-merge (cn)
├── components/
│   ├── common/                  # Reusable shared UI primitives
│   │   ├── AppShell.tsx         # Responsive container layout
│   │   ├── Header.tsx           # Sticky topbar navigation
│   │   ├── Sidebar.tsx          # Desktop sidebar navigation
│   │   ├── MobileNavigation.tsx # Mobile bottom navigation bar (<768px)
│   │   ├── PageHeader.tsx       # Standardized page title & actions
│   │   ├── StatusBadge.tsx      # Multi-variant status badge with contrast
│   │   ├── EmptyState.tsx       # Standard empty data state card
│   │   ├── ErrorState.tsx       # Standard error retry state card
│   │   └── LoadingState.tsx     # Spinner & skeleton loader
│   └── layouts/                 # Specialized portal layouts
│       ├── AdminLayout.tsx      # Layout khusus Portal Admin (/admin/*)
│       ├── CommitteeLayout.tsx  # Layout khusus Portal Panitia (/committee/*)
│       ├── PortalLayout.tsx     # Layout khusus Portal Ustadz (/portal/*)
│       └── PublicLayout.tsx     # Layout khusus Halaman Publik (/login, /invitation, /check-in)
├── pages/
│   ├── auth/                    # Halaman autentikasi (LoginPage)
│   ├── admin/                   # Dashboard & fitur Portal Admin
│   ├── committee/               # Dashboard & scanner Portal Panitia
│   ├── portal/                  # Dashboard & QR Portal Ustadz
│   └── public/                  # Halaman publik (InvitationPage, CheckInPublicPage, EventPublicPage)
├── vite-env.d.ts                # TypeScript type declarations untuk Vite
├── index.css                    # Tailwind CSS directives & global CSS variables
├── App.tsx                      # Root component & React Router configuration
└── main.tsx                     # Vite React entrypoint
```

---

## 2. Alasan Desain (Design Rationale)

### A. Tiga Portal dalam Satu Codebase
- **Alasan**: Memudahkan berbagi (*sharing*) komponen UI, penyedia autentikasi Refine, serta type definitions TypeScript antar portal tanpa membuat tiga proyek frontend terpisah yang meningkatkan biaya pemeliharaan.
- **Isolasi**: Setiap portal dipisahkan oleh kelompok rute (`/admin/*`, `/committee/*`, `/portal/*`) dengan layout dan hak akses tersendiri.

### B. Komponen Reusable `AppShell` & Responsive Design
- **Alasan**: Perangkat pengguna bervariasi dari laptop admin (1280px+) hingga smartphone panitia/ustadz (360px).
- **Pendekatan**: `AppShell` secara otomatis menyajikan navigasi `Sidebar` pada layar desktop dan `MobileNavigation` (bottom bar) pada layar ponsel dengan target sentuh minimal 44x44px.

### C. Keamanan Token & Non-Direct Database Access
- **Alasan**: Keamanan data PII (email, telepon, riwayat keikutsertaan) adalah prioritas tertinggi.
- **Pendekatan**: Frontend **TIDAK PERNAH** menyimpan `DATABASE_URL` atau melakukan query ke Neon PostgreSQL secara langsung. Seluruh interaksi data melewati REST API Netlify Functions.

### D. Adopsi Component Baseline (shadcn/ui + Tailwind CSS)
- **Alasan**: Package BeUI dan Hallmark belum terverifikasi registri privat resminya (ditandai *unresolved*).
- **Pendekatan**: Menggunakan **shadcn/ui** dan **Tailwind CSS** sebagai fondasi UI utama yang fleksibel, aksesibel (WCAG compliant), dan mudah di-custom.
