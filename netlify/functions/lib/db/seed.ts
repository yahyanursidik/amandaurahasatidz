import { getDbClient } from "./client";
import {
  roles,
  users,
  userRoleAssignments,
  institutions,
  events,
  eventDays,
  eventSessions,
  ustadzProfiles,
  ustadzInstitutionAffiliations,
  invitations,
  eventParticipants,
  eventAnnouncements,
  announcementRecipients,
} from "./schema";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "../utils/password";

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

  console.log("Seeding role-specific login accounts...");
  const developmentPassword =
    process.env.SEED_DEFAULT_PASSWORD ||
    (process.env.APP_ENV !== "production" ? "DemoAsatidz2026!" : undefined);
  const accountDefinitions = [
    { email: "admin@yts.or.id", name: "Super Admin YTS", roleCode: "SUPER_ADMIN" },
    { email: "panitia@yts.or.id", name: "Koordinator Panitia Daurah", roleCode: "COMMITTEE_LEAD" },
    { email: "ustadz.demo@yts.or.id", name: "Ustadz Peserta Demo", roleCode: "USTADZ" },
  ];

  for (const account of accountDefinitions) {
    let user = (await db.select().from(users).where(eq(users.email, account.email)).limit(1))[0];
    const passwordHash = developmentPassword ? hashPassword(developmentPassword) : null;
    if (!user) {
      const inserted = await db
        .insert(users)
        .values({
          email: account.email,
          name: account.name,
          passwordHash,
          status: "ACTIVE",
        })
        .returning();
      user = inserted[0];
    } else if (passwordHash && !user.passwordHash) {
      const updated = await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      user = updated[0];
    }

    const role = (await db.select().from(roles).where(eq(roles.code, account.roleCode)).limit(1))[0];
    if (user && role) {
      const existingAssignment = await db
        .select()
        .from(userRoleAssignments)
        .where(eq(userRoleAssignments.userId, user.id))
        .limit(1);
      if (existingAssignment.length === 0) {
        await db.insert(userRoleAssignments).values({ userId: user.id, roleId: role.id });
      }
    }
  }

  console.log("Seeding development institutions...");
  const institutionDefinitions = [
    {
      code: "INST-BDG-001",
      name: "Ma'had Ilmu Sunnah Bandung",
      email: "kontak@mahadsunnahbdg.or.id",
      phone: "081200001111",
      provinceCode: "32",
      cityCode: "3273",
      address: "Bandung, Jawa Barat",
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
    },
    {
      code: "INST-JBR-002",
      name: "STDI Imam Syafi'i Jember",
      email: "info@stdiis.ac.id",
      phone: "081200002222",
      provinceCode: "35",
      cityCode: "3509",
      address: "Jember, Jawa Timur",
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
    },
    {
      code: "INST-JKT-003",
      name: "Pondok Sunnah Jakarta Pusat",
      email: "sekretariat@pondoksunnahjkt.or.id",
      phone: "081200003333",
      provinceCode: "31",
      cityCode: "3171",
      address: "Jakarta Pusat, DKI Jakarta",
      status: "ACTIVE",
      verificationStatus: "VERIFIED",
    },
  ];
  for (const institution of institutionDefinitions) {
    const existing = await db
      .select()
      .from(institutions)
      .where(eq(institutions.code, institution.code))
      .limit(1);
    if (existing.length === 0) await db.insert(institutions).values(institution);
  }

  console.log("Seeding UUID-backed development event...");
  const adminUser = (await db.select().from(users).where(eq(users.email, "admin@yts.or.id")).limit(1))[0];
  let developmentEvent = (
    await db.select().from(events).where(eq(events.code, "DAURAH-YTS-1448")).limit(1)
  )[0];
  if (!developmentEvent) {
    const created = await db
      .insert(events)
      .values({
        code: "DAURAH-YTS-1448",
        slug: "daurah-asatidz-yts-1448",
        name: "Daurah Asatidz YTS 1448 H",
        subtitle: "Pengelolaan undangan, delegasi, dan kehadiran asatidz",
        description: "Event operasional untuk menguji alur undangan lembaga hingga check-in individual.",
        audienceMode: "INSTITUTION_INVITATION",
        attendanceMode: "DAILY_AND_SESSION",
        timezone: "Asia/Jakarta",
        startDate: "2026-08-15",
        endDate: "2026-08-17",
        venueName: "Markaz YTS",
        venueAddress: "Lokasi kegiatan akan dilengkapi oleh admin.",
        defaultInstitutionQuota: 3,
        capacity: 300,
        status: "DRAFT",
        createdBy: adminUser?.id || null,
      })
      .returning();
    developmentEvent = created[0];
  }

  const updatedEvents = await db
    .update(events)
    .set({
      subtitle: "Pengelolaan undangan, delegasi, dan kehadiran asatidz",
      description:
        "Data demo terhubung untuk menguji portal peserta, undangan lembaga, jadwal, QR, dan check-in individual.",
      posterUrl: "/images/event-poster-library-interior.png",
      posterAlt: "Interior perpustakaan sebagai poster Daurah Asatidz",
      audienceMode: "INSTITUTION_INVITATION",
      attendanceMode: "DAILY_AND_SESSION",
      timezone: "Asia/Jakarta",
      startDate: "2026-08-15",
      endDate: "2026-08-17",
      venueName: "Markaz YTS Bandung",
      venueAddress: "Bandung, Jawa Barat",
      invitationResponseDeadline: new Date("2026-08-05T16:59:00.000Z"),
      attendanceConfirmationDeadline: new Date("2026-08-10T16:59:00.000Z"),
      attendanceConfirmationRequired: true,
      defaultInstitutionQuota: 3,
      capacity: 300,
      status: "PUBLISHED",
      updatedAt: new Date(),
    })
    .where(eq(events.id, developmentEvent.id))
    .returning();
  developmentEvent = updatedEvents[0] || developmentEvent;

  // Akun uji panitia harus memiliki peran operasional dan lingkup event agar
  // seluruh modul portal panitia dapat diuji tanpa melonggarkan RBAC produksi.
  const committeeUser = (await db.select().from(users).where(eq(users.email, "panitia@yts.or.id")).limit(1))[0];
  const committeeLeadRole = (await db.select().from(roles).where(eq(roles.code, "COMMITTEE_LEAD")).limit(1))[0];
  if (committeeUser && committeeLeadRole) {
    const committeeAssignment = (
      await db.select().from(userRoleAssignments).where(eq(userRoleAssignments.userId, committeeUser.id)).limit(1)
    )[0];
    if (committeeAssignment) {
      await db
        .update(userRoleAssignments)
        .set({ roleId: committeeLeadRole.id, eventId: developmentEvent.id, startsAt: null, endsAt: null })
        .where(eq(userRoleAssignments.id, committeeAssignment.id));
    } else {
      await db.insert(userRoleAssignments).values({
        userId: committeeUser.id,
        roleId: committeeLeadRole.id,
        eventId: developmentEvent.id,
      });
    }
  }

  let firstDay = (
    await db.select().from(eventDays).where(eq(eventDays.eventId, developmentEvent.id)).limit(1)
  )[0];
  if (!firstDay) {
    const created = await db
      .insert(eventDays)
      .values({
        eventId: developmentEvent.id,
        dayNumber: 1,
        date: "2026-08-15",
        title: "Pembukaan dan materi utama",
      })
      .returning();
    firstDay = created[0];
  }
  const existingSession = await db
    .select()
    .from(eventSessions)
    .where(eq(eventSessions.eventDayId, firstDay.id))
    .limit(1);
  if (existingSession.length === 0) {
    await db.insert(eventSessions).values({
      eventDayId: firstDay.id,
      title: "Pembukaan Daurah",
      sessionType: "OPENING",
      startAt: new Date("2026-08-15T01:00:00.000Z"),
      endAt: new Date("2026-08-15T02:00:00.000Z"),
      room: "Ruang utama",
      attendanceRequired: true,
      checkinRequired: true,
    });
  }

  let secondDay = (
    await db
      .select()
      .from(eventDays)
      .where(and(eq(eventDays.eventId, developmentEvent.id), eq(eventDays.dayNumber, 2)))
      .limit(1)
  )[0];
  if (!secondDay) {
    const created = await db
      .insert(eventDays)
      .values({
        eventId: developmentEvent.id,
        dayNumber: 2,
        date: "2026-08-17",
        title: "Pendalaman materi dan penutupan",
      })
      .returning();
    secondDay = created[0];
  }
  const existingSecondSession = await db
    .select()
    .from(eventSessions)
    .where(
      and(
        eq(eventSessions.eventDayId, secondDay.id),
        eq(eventSessions.title, "Pendalaman Materi dan Penutupan"),
      ),
    )
    .limit(1);
  if (existingSecondSession.length === 0) {
    await db.insert(eventSessions).values({
      eventDayId: secondDay.id,
      title: "Pendalaman Materi dan Penutupan",
      sessionType: "CLOSING",
      startAt: new Date("2026-08-17T01:00:00.000Z"),
      endAt: new Date("2026-08-17T05:00:00.000Z"),
      room: "Ruang utama",
      attendanceRequired: true,
      checkinRequired: true,
      sortOrder: 1,
    });
  }

  console.log("Seeding connected participant portal demo...");
  const demoUser = (
    await db.select().from(users).where(eq(users.email, "ustadz.demo@yts.or.id")).limit(1)
  )[0];
  const demoInstitution = (
    await db.select().from(institutions).where(eq(institutions.code, "INST-BDG-001")).limit(1)
  )[0];
  if (!demoUser || !demoInstitution) {
    throw new Error("Akun atau lembaga demo gagal disiapkan.");
  }

  let demoProfile = (
    await db
      .select()
      .from(ustadzProfiles)
      .where(eq(ustadzProfiles.email, "ustadz.demo@yts.or.id"))
      .limit(1)
  )[0];
  if (!demoProfile) {
    const created = await db
      .insert(ustadzProfiles)
      .values({
        userId: demoUser.id,
        fullName: "Abdullah Ahmad",
        normalizedName: "abdullah ahmad",
        titlePrefix: "Ustadz",
        titleSuffix: "Lc.",
        email: "ustadz.demo@yts.or.id",
        phone: "081299990000",
        whatsapp: "6281299990000",
        address: "Bandung, Jawa Barat",
        cityCode: "3273",
        provinceCode: "32",
        educationSummary: "S1 Syariah",
        expertiseSummary: "Fikih muamalah dan pembinaan asatidz",
        profileStatus: "ACTIVE",
      })
      .returning();
    demoProfile = created[0];
  } else {
    const updated = await db
      .update(ustadzProfiles)
      .set({
        userId: demoUser.id,
        fullName: "Abdullah Ahmad",
        normalizedName: "abdullah ahmad",
        phone: "081299990000",
        whatsapp: "6281299990000",
        address: "Bandung, Jawa Barat",
        educationSummary: "S1 Syariah",
        expertiseSummary: "Fikih muamalah dan pembinaan asatidz",
        profileStatus: "ACTIVE",
        updatedAt: new Date(),
      })
      .where(eq(ustadzProfiles.id, demoProfile.id))
      .returning();
    demoProfile = updated[0] || demoProfile;
  }

  const existingAffiliation = await db
    .select()
    .from(ustadzInstitutionAffiliations)
    .where(
      and(
        eq(ustadzInstitutionAffiliations.ustadzId, demoProfile.id),
        eq(ustadzInstitutionAffiliations.institutionId, demoInstitution.id),
      ),
    )
    .limit(1);
  if (existingAffiliation.length === 0) {
    await db.insert(ustadzInstitutionAffiliations).values({
      ustadzId: demoProfile.id,
      institutionId: demoInstitution.id,
      position: "Kepala rombongan",
      isPrimary: true,
      status: "ACTIVE",
      verifiedAt: new Date(),
      verifiedBy: adminUser?.id || null,
    });
  }

  let demoInvitation = (
    await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.eventId, developmentEvent.id),
          eq(invitations.invitationNumber, "UND-DEMO-BDG-001"),
        ),
      )
      .limit(1)
  )[0];
  if (!demoInvitation) {
    const created = await db
      .insert(invitations)
      .values({
        eventId: developmentEvent.id,
        invitationType: "INSTITUTION",
        institutionId: demoInstitution.id,
        invitationNumber: "UND-DEMO-BDG-001",
        quota: 3,
        status: "RESPONDED",
        responseDeadline: new Date("2026-08-05T16:59:00.000Z"),
        sentAt: new Date("2026-07-20T03:00:00.000Z"),
        respondedAt: new Date("2026-07-22T03:30:00.000Z"),
        createdBy: adminUser?.id || null,
      })
      .returning();
    demoInvitation = created[0];
  }

  let demoParticipant = (
    await db
      .select()
      .from(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, developmentEvent.id),
          eq(eventParticipants.ustadzId, demoProfile.id),
        ),
      )
      .limit(1)
  )[0];
  if (!demoParticipant) {
    const created = await db
      .insert(eventParticipants)
      .values({
        eventId: developmentEvent.id,
        ustadzId: demoProfile.id,
        institutionId: demoInstitution.id,
        invitationId: demoInvitation.id,
        registrationSource: "INSTITUTION_DELEGATION",
        participantCode: "ADA-DEMO-001",
        isDelegationLead: true,
        confirmationStatus: "CONFIRMED",
        approvalStatus: "APPROVED",
        confirmedAt: new Date("2026-07-22T03:30:00.000Z"),
        approvedAt: new Date("2026-07-22T04:00:00.000Z"),
        approvedBy: adminUser?.id || null,
        notes: "Data demo portal peserta dan kepala rombongan.",
      })
      .returning();
    demoParticipant = created[0];
  } else {
    const updated = await db
      .update(eventParticipants)
      .set({
        institutionId: demoInstitution.id,
        invitationId: demoInvitation.id,
        isDelegationLead: true,
        confirmationStatus: "CONFIRMED",
        approvalStatus: "APPROVED",
        confirmedAt: demoParticipant.confirmedAt || new Date("2026-07-22T03:30:00.000Z"),
        approvedAt: demoParticipant.approvedAt || new Date("2026-07-22T04:00:00.000Z"),
        approvedBy: adminUser?.id || null,
        updatedAt: new Date(),
      })
      .where(eq(eventParticipants.id, demoParticipant.id))
      .returning();
    demoParticipant = updated[0] || demoParticipant;
  }

  let memberProfile = (
    await db
      .select()
      .from(ustadzProfiles)
      .where(eq(ustadzProfiles.email, "ustadz.ahmad.demo@yts.or.id"))
      .limit(1)
  )[0];
  if (!memberProfile) {
    const created = await db
      .insert(ustadzProfiles)
      .values({
        fullName: "Ahmad Fauzan",
        normalizedName: "ahmad fauzan",
        titlePrefix: "Ustadz",
        email: "ustadz.ahmad.demo@yts.or.id",
        phone: "081288880000",
        whatsapp: "6281288880000",
        address: "Cimahi, Jawa Barat",
        educationSummary: "Pendidikan bahasa Arab dan ilmu syariah",
        expertiseSummary: "Bahasa Arab dan pendidikan keluarga",
        profileStatus: "ACTIVE",
      })
      .returning();
    memberProfile = created[0];
  }
  const existingMemberAffiliation = await db
    .select()
    .from(ustadzInstitutionAffiliations)
    .where(
      and(
        eq(ustadzInstitutionAffiliations.ustadzId, memberProfile.id),
        eq(ustadzInstitutionAffiliations.institutionId, demoInstitution.id),
      ),
    )
    .limit(1);
  if (existingMemberAffiliation.length === 0) {
    await db.insert(ustadzInstitutionAffiliations).values({
      ustadzId: memberProfile.id,
      institutionId: demoInstitution.id,
      position: "Pengajar",
      isPrimary: true,
      status: "ACTIVE",
      verifiedAt: new Date(),
      verifiedBy: adminUser?.id || null,
    });
  }

  let memberParticipant = (
    await db
      .select()
      .from(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, developmentEvent.id),
          eq(eventParticipants.ustadzId, memberProfile.id),
        ),
      )
      .limit(1)
  )[0];
  if (!memberParticipant) {
    const created = await db
      .insert(eventParticipants)
      .values({
        eventId: developmentEvent.id,
        ustadzId: memberProfile.id,
        institutionId: demoInstitution.id,
        invitationId: demoInvitation.id,
        registrationSource: "INSTITUTION_DELEGATION",
        participantCode: "ADA-DEMO-002",
        isDelegationLead: false,
        confirmationStatus: "CONFIRMED",
        approvalStatus: "APPROVED",
        confirmedAt: new Date("2026-07-22T03:45:00.000Z"),
        approvedAt: new Date("2026-07-22T04:00:00.000Z"),
        approvedBy: adminUser?.id || null,
      })
      .returning();
    memberParticipant = created[0];
  }

  let demoAnnouncement = (
    await db
      .select()
      .from(eventAnnouncements)
      .where(
        and(
          eq(eventAnnouncements.eventId, developmentEvent.id),
          eq(eventAnnouncements.title, "Persiapan sebelum berangkat"),
        ),
      )
      .limit(1)
  )[0];
  if (!demoAnnouncement) {
    const created = await db
      .insert(eventAnnouncements)
      .values({
        eventId: developmentEvent.id,
        title: "Persiapan sebelum berangkat",
        body: "Pastikan profil, nomor WhatsApp, jadwal, dan kartu QR sudah dapat dibuka sebelum tiba di lokasi.",
        audienceType: "APPROVED_ONLY",
        status: "PUBLISHED",
        publishedAt: new Date("2026-07-30T03:00:00.000Z"),
        createdBy: adminUser?.id || null,
      })
      .returning();
    demoAnnouncement = created[0];
  }

  for (const participant of [demoParticipant, memberParticipant]) {
    const recipient = await db
      .select()
      .from(announcementRecipients)
      .where(
        and(
          eq(announcementRecipients.announcementId, demoAnnouncement.id),
          eq(announcementRecipients.participantId, participant.id),
        ),
      )
      .limit(1);
    if (recipient.length === 0) {
      await db.insert(announcementRecipients).values({
        announcementId: demoAnnouncement.id,
        participantId: participant.id,
        institutionId: demoInstitution.id,
      });
    }
  }

  console.log("Database seed completed successfully.");
  return {
    eventId: developmentEvent.id,
    eventName: developmentEvent.name,
    demoAccount: "ustadz.demo@yts.or.id",
    demoParticipantId: demoParticipant.id,
    demoParticipantCode: demoParticipant.participantCode,
  };
}
