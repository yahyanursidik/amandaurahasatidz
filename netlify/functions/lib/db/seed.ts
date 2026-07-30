import { getDbClient } from "./client";
import { roles, users, userRoleAssignments } from "./schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  const db = getDbClient();

  const roleDefinitions = [
    { code: "SUPER_ADMIN", name: "Super Admin YTS", description: "Akses penuh seluruh sistem dan event" },
    { code: "SYSTEM_ADMIN", name: "System Admin", description: "Pengelola infrastruktur dan user" },
    { code: "DATA_STEWARD", name: "Data Steward", description: "Pengelola master data lembaga dan asatidz" },
    { code: "REPORT_VIEWER", name: "Report Viewer", description: "Akses melihat laporan lintas event" },
    { code: "EVENT_ADMIN", name: "Event Admin", description: "Admin pengelola event tertentu" },
    { code: "COMMITTEE_LEAD", name: "Ketua Panitia", description: "Pengawas event dan operasional" },
    { code: "REGISTRATION_OFFICER", name: "Petugas Registrasi", description: "Petugas pendaftaran lokasi" },
    { code: "CHECKIN_OFFICER", name: "Petugas Check-in", description: "Petugas scanner QR dan kode" },
    { code: "INFORMATION_OFFICER", name: "Petugas Informasi", description: "Pengelola jadwal dan pengumuman" },
    { code: "EVENT_VIEWER", name: "Event Viewer", description: "Melihat data event tertentu" },
    { code: "USTADZ", name: "Ustadz Peserta", description: "Profil peserta ustadz" },
    { code: "INSTITUTION_REPRESENTATIVE", name: "Perwakilan Lembaga", description: "PIC perwakilan lembaga" },
  ];

  console.log("Seeding roles...");
  for (const r of roleDefinitions) {
    const existing = await db.select().from(roles).where(eq(roles.code, r.code)).limit(1);
    if (existing.length === 0) {
      await db.insert(roles).values(r);
    }
  }

  console.log("Seeding default super admin user...");
  const adminEmail = "admin@yts.or.id";
  let adminUser = (await db.select().from(users).where(eq(users.email, adminEmail)).limit(1))[0];

  if (!adminUser) {
    const inserted = await db.insert(users).values({
      email: adminEmail,
      name: "Super Admin YTS",
      status: "ACTIVE",
    }).returning();
    adminUser = inserted[0];
  }

  const superAdminRole = (await db.select().from(roles).where(eq(roles.code, "SUPER_ADMIN")).limit(1))[0];
  if (adminUser && superAdminRole) {
    const existingAssignment = await db
      .select()
      .from(userRoleAssignments)
      .where(eq(userRoleAssignments.userId, adminUser.id))
      .limit(1);

    if (existingAssignment.length === 0) {
      await db.insert(userRoleAssignments).values({
        userId: adminUser.id,
        roleId: superAdminRole.id,
      });
    }
  }

  console.log("Database seed completed successfully.");
}
