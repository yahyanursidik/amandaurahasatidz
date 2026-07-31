import { hashToken } from "../netlify/functions/lib/utils/token";

export async function getSeedRolesData() {
  return [
    { code: "SUPER_ADMIN", name: "Super Administrator", description: "Akses penuh seluruh sistem" },
    { code: "SECRETARIAT_STAFF", name: "Staf Sekretariat", description: "Manajemen undangan dan verifikasi data" },
    { code: "REGISTRATION_OPERATOR", name: "Operator Pendaftaran", description: "Input dan edit data delegasi" },
    { code: "CHECKIN_OFFICER", name: "Petugas Presensi On-Site", description: "Pemindaian QR dan presensi lokasi" },
    { code: "COMMITTEE_MEMBER", name: "Anggota Panitia Daurah", description: "Akses dashboard panitia dan pengumuman" },
    { code: "USTADZ_PARTICIPANT", name: "Ustadz Peserta", description: "Akses Portal Ustadz, QR badge, dan pengumuman" },
  ];
}

export async function getDemoAccountsData() {
  const dummyPasswordHash = hashToken("DemoAsatidz2026!");

  return [
    {
      username: "admin.demo",
      email: "admin@yts.or.id",
      passwordHash: dummyPasswordHash,
      roleCode: "SUPER_ADMIN",
      fullName: "Administrator Demo YTS",
    },
    {
      username: "sekretariat.demo",
      email: "sekretariat@yts.or.id",
      passwordHash: dummyPasswordHash,
      roleCode: "SECRETARIAT_STAFF",
      fullName: "Ustadz Ahmad Sekretariat, S.Pd.I.",
    },
    {
      username: "panitia.demo",
      email: "panitia@yts.or.id",
      passwordHash: dummyPasswordHash,
      roleCode: "CHECKIN_OFFICER",
      fullName: "Ustadz Ridwan Panitia",
    },
    {
      username: "ustadz.demo",
      email: "ustadz.demo@yts.or.id",
      passwordHash: dummyPasswordHash,
      roleCode: "USTADZ_PARTICIPANT",
      fullName: "Ustadz Abdullah, Lc., M.H.",
    },
  ];
}

export async function getDemoInstitutionsData() {
  return [
    {
      code: "INST-BDG-001",
      name: "Ma'had Ilmu Sunnah Bandung",
      email: "kontak@mahadsunnahbdg.or.id",
      phone: "081200001111",
      provinceCode: "32", // Jawa Barat
      cityCode: "3273", // Kota Bandung
      address: "Jl. Soekarno Hatta No. 456, Bandung",
      status: "ACTIVE",
    },
    {
      code: "INST-JBR-002",
      name: "STDI Imam Syafi'i Jember",
      email: "info@stdiis.ac.id",
      phone: "081200002222",
      provinceCode: "35", // Jawa Timur
      cityCode: "3509", // Jember
      address: "Jl. M.H. Thamrin No. 112, Jember",
      status: "ACTIVE",
    },
    {
      code: "INST-JKT-003",
      name: "Pondok Sunnah Jakarta Pusat",
      email: "sekretariat@pondoksunnahjkt.or.id",
      phone: "081200003333",
      provinceCode: "31", // DKI Jakarta
      cityCode: "3171", // Jakarta Pusat
      address: "Jl. Kramat Raya No. 88, Jakarta Pusat",
      status: "ACTIVE",
    },
  ];
}

export async function getDemoAsatidzData() {
  return [
    {
      fullName: "Ustadz Abdullah, Lc., M.H.",
      normalizedName: "USTADZ ABDULLAH LC MH",
      email: "ustadz.demo@yts.or.id",
      phone: "081299990001",
      provinceCode: "32",
      cityCode: "3273",
      educationSummary: "S1 Universitas Islam Madinah, S2 UI",
    },
    {
      fullName: "Ustadz Hamzah, M.Ag.",
      normalizedName: "USTADZ HAMZAH MAG",
      email: "hamzah.demo@yts.or.id",
      phone: "081299990002",
      provinceCode: "35",
      cityCode: "3509",
      educationSummary: "S1 STDI Imam Syafi'i, S2 UIN Malang",
    },
    {
      fullName: "Ustadz Fauzi Ahmad, B.A.",
      normalizedName: "USTADZ FAUZI AHMAD BA",
      email: "fauzi.demo@yts.or.id",
      phone: "081299990003",
      provinceCode: "31",
      cityCode: "3171",
      educationSummary: "S1 LIPIA Jakarta Fiqih Wa Ushuluh",
    },
  ];
}
