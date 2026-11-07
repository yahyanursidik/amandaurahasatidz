import { getDbClient } from "../db/client";
import { withTransaction } from "../db/transaction";
import {
  ustadzProfiles,
  ustadzInstitutionAffiliations,
  institutions,
  eventParticipants,
  events,
  attendanceRecords,
  auditLogs,
  eventDays,
  eventSessions,
  participantStatusHistories,
} from "../db/schema";
import { eq, ilike, and, or, isNull, isNotNull, count, countDistinct, desc, inArray } from "drizzle-orm";
import { normalizeName, normalizeEmail, normalizePhone } from "../utils/normalization";
import {
  AttendanceMode,
  buildRequiredAttendanceUnits,
  summarizeParticipantAttendance,
} from "../services/attendanceModel";

export interface UstadzQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  cityCode?: string;
  provinceCode?: string;
  profileStatus?: string;
  institutionId?: string;
  quality?: "incomplete";
  duplicate?: "true";
  participation?: "attended";
}

type CompletenessProfile = Pick<typeof ustadzProfiles.$inferSelect,
  "email" | "phone" | "whatsapp" | "address" | "cityCode" | "provinceCode" | "educationSummary" | "expertiseSummary">;

export function getUstadzCompletenessPercent(profile: CompletenessProfile) {
  const fields = [profile.email, profile.whatsapp || profile.phone, profile.address,
    profile.cityCode, profile.provinceCode, profile.educationSummary, profile.expertiseSummary];
  return Math.round(fields.filter((value) => Boolean(String(value || "").trim())).length / fields.length * 100);
}

export async function findUstadzProfilesRepository(params: UstadzQueryParams) {
  const db = getDbClient();
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;
  const offset = (page - 1) * pageSize;

  const [activeProfiles, [archivedRow], [attendedRow]] = await Promise.all([
    db.select({
      id: ustadzProfiles.id,
      normalizedName: ustadzProfiles.normalizedName,
      email: ustadzProfiles.email,
      phone: ustadzProfiles.phone,
      whatsapp: ustadzProfiles.whatsapp,
      address: ustadzProfiles.address,
      cityCode: ustadzProfiles.cityCode,
      provinceCode: ustadzProfiles.provinceCode,
      educationSummary: ustadzProfiles.educationSummary,
      expertiseSummary: ustadzProfiles.expertiseSummary,
      profileStatus: ustadzProfiles.profileStatus,
    }).from(ustadzProfiles).where(isNull(ustadzProfiles.deletedAt)),
    db.select({ total: count() }).from(ustadzProfiles).where(isNotNull(ustadzProfiles.deletedAt)),
    db.select({ total: countDistinct(eventParticipants.ustadzId) })
      .from(eventParticipants)
      .innerJoin(attendanceRecords, eq(attendanceRecords.participantId, eventParticipants.id))
      .innerJoin(ustadzProfiles, eq(eventParticipants.ustadzId, ustadzProfiles.id))
      .where(and(isNull(ustadzProfiles.deletedAt), inArray(attendanceRecords.attendanceStatus, ["PRESENT", "LATE"]))),
  ]);
  const duplicateKeys = new Map<string, Set<string>>();
  for (const profile of activeProfiles) {
    if (profile.profileStatus !== "ACTIVE") continue;
    for (const key of [profile.normalizedName && `name:${profile.normalizedName}`,
      profile.email && `email:${profile.email}`, profile.phone && `phone:${profile.phone}`]) {
      if (!key) continue;
      const ids = duplicateKeys.get(key) || new Set<string>();
      ids.add(profile.id);
      duplicateKeys.set(key, ids);
    }
  }
  const hasDuplicate = (profile: Pick<typeof activeProfiles[number], "id" | "normalizedName" | "email" | "phone">) =>
    [profile.normalizedName && `name:${profile.normalizedName}`,
      profile.email && `email:${profile.email}`, profile.phone && `phone:${profile.phone}`]
      .some((key) => key && [...(duplicateKeys.get(key) || [])].some((id) => id !== profile.id));

  const conditions = [params.profileStatus === "ARCHIVED"
    ? isNotNull(ustadzProfiles.deletedAt) : isNull(ustadzProfiles.deletedAt)];

  if (params.search && params.search.trim() !== "") {
    const searchPattern = `%${params.search.trim()}%`;
    const normSearch = `%${normalizeName(params.search)}%`;
    conditions.push(
      or(
        ilike(ustadzProfiles.fullName, searchPattern),
        ilike(ustadzProfiles.normalizedName, normSearch),
        ilike(ustadzProfiles.email, searchPattern),
        ilike(ustadzProfiles.phone, searchPattern)
      )!
    );
  }

  if (params.cityCode) {
    conditions.push(eq(ustadzProfiles.cityCode, params.cityCode));
  }

  if (params.provinceCode) {
    conditions.push(eq(ustadzProfiles.provinceCode, params.provinceCode));
  }

  if (params.profileStatus && params.profileStatus !== "ARCHIVED") {
    conditions.push(eq(ustadzProfiles.profileStatus, params.profileStatus));
  }

  if (params.institutionId) {
    conditions.push(inArray(ustadzProfiles.id, db.select({ id: ustadzInstitutionAffiliations.ustadzId })
      .from(ustadzInstitutionAffiliations)
      .where(and(eq(ustadzInstitutionAffiliations.institutionId, params.institutionId),
        eq(ustadzInstitutionAffiliations.status, "ACTIVE")))));
  }

  if (params.quality || params.duplicate) {
    const matchingIds = activeProfiles.filter((profile) =>
      (!params.quality || getUstadzCompletenessPercent(profile) < 70) &&
      (!params.duplicate || hasDuplicate(profile))).map((profile) => profile.id);
    conditions.push(inArray(ustadzProfiles.id, matchingIds));
  }

  if (params.participation === "attended") {
    conditions.push(inArray(ustadzProfiles.id, db.select({ id: eventParticipants.ustadzId })
      .from(eventParticipants)
      .innerJoin(attendanceRecords, eq(attendanceRecords.participantId, eventParticipants.id))
      .where(inArray(attendanceRecords.attendanceStatus, ["PRESENT", "LATE"]))));
  }

  const whereClause = and(...conditions);

  const [dataResult, countResult] = await Promise.all([
    db
      .select()
      .from(ustadzProfiles)
      .where(whereClause)
      .orderBy(desc(ustadzProfiles.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(ustadzProfiles)
      .where(whereClause),
  ]);

  const total = countResult[0]?.total || 0;
  const pageCount = Math.ceil(total / pageSize);
  const profileIds = dataResult.map((profile) => profile.id);
  const affiliationRows = await (
    profileIds.length
      ? db
          .select({
            ustadzId: ustadzInstitutionAffiliations.ustadzId,
            institutionId: institutions.id,
            institutionName: institutions.name,
            institutionCode: institutions.code,
            position: ustadzInstitutionAffiliations.position,
            isPrimary: ustadzInstitutionAffiliations.isPrimary,
            status: ustadzInstitutionAffiliations.status,
          })
          .from(ustadzInstitutionAffiliations)
          .innerJoin(institutions, eq(ustadzInstitutionAffiliations.institutionId, institutions.id))
          .where(
            and(
              inArray(ustadzInstitutionAffiliations.ustadzId, profileIds),
              eq(ustadzInstitutionAffiliations.status, "ACTIVE"),
            ),
          )
      : Promise.resolve([])
  );

  const data = dataResult.map((profile) => {
    const affiliations = affiliationRows.filter((row) => row.ustadzId === profile.id);
    const primaryInstitution = affiliations.find((row) => row.isPrimary) || affiliations[0] || null;
    const hasDuplicateAlert = hasDuplicate(profile);
    return {
      ...profile,
      primaryInstitution,
      affiliationCount: affiliations.length,
      hasDuplicateAlert,
      completenessPercent: getUstadzCompletenessPercent(profile),
    };
  });

  const summary = {
    total: activeProfiles.length,
    active: activeProfiles.filter((profile) => profile.profileStatus === "ACTIVE").length,
    inactive: activeProfiles.filter((profile) => profile.profileStatus === "INACTIVE").length,
    merged: activeProfiles.filter((profile) => profile.profileStatus === "MERGED").length,
    incomplete: activeProfiles.filter((profile) => getUstadzCompletenessPercent(profile) < 70).length,
    duplicateCandidates: activeProfiles.filter((profile) => profile.profileStatus === "ACTIVE" && hasDuplicate(profile)).length,
    archived: archivedRow?.total || 0,
    attended: attendedRow?.total || 0,
  };

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      pageCount,
      summary,
    },
  };
}

export async function findUstadzByIdRepository(id: string) {
  const db = getDbClient();
  const profile = await db
    .select()
    .from(ustadzProfiles)
    .where(eq(ustadzProfiles.id, id))
    .limit(1);

  if (profile.length === 0) return null;

  const affiliations = await db
    .select({
      id: ustadzInstitutionAffiliations.id,
      institutionId: ustadzInstitutionAffiliations.institutionId,
      institutionName: institutions.name,
      institutionCode: institutions.code,
      position: ustadzInstitutionAffiliations.position,
      isPrimary: ustadzInstitutionAffiliations.isPrimary,
      startDate: ustadzInstitutionAffiliations.startDate,
      endDate: ustadzInstitutionAffiliations.endDate,
      status: ustadzInstitutionAffiliations.status,
    })
    .from(ustadzInstitutionAffiliations)
    .innerJoin(institutions, eq(ustadzInstitutionAffiliations.institutionId, institutions.id))
    .where(eq(ustadzInstitutionAffiliations.ustadzId, id));

  const eventHistory = await db
    .select({
      participantId: eventParticipants.id,
      participantCode: eventParticipants.participantCode,
      confirmationStatus: eventParticipants.confirmationStatus,
      approvalStatus: eventParticipants.approvalStatus,
      registrationSource: eventParticipants.registrationSource,
      institutionId: eventParticipants.institutionId,
      institutionName: institutions.name,
      institutionCode: institutions.code,
      eventId: events.id,
      eventCode: events.code,
      eventName: events.name,
      eventStatus: events.status,
      eventStartDate: events.startDate,
      eventEndDate: events.endDate,
      attendanceMode: events.attendanceMode,
      timezone: events.timezone,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .leftJoin(institutions, eq(eventParticipants.institutionId, institutions.id))
    .where(eq(eventParticipants.ustadzId, id))
    .orderBy(desc(events.startDate));

  const eventIds = [...new Set(eventHistory.map((item) => item.eventId))];
  const [attendanceRows, eventDayRows, eventSessionRows, statusRows] = eventHistory.length
    ? await Promise.all([
        db.select({
          participantId: attendanceRecords.participantId,
          eventDayId: attendanceRecords.eventDayId,
          eventSessionId: attendanceRecords.eventSessionId,
          attendanceStatus: attendanceRecords.attendanceStatus,
        }).from(attendanceRecords).where(inArray(attendanceRecords.participantId, eventHistory.map((item) => item.participantId))),
        db.select().from(eventDays).where(inArray(eventDays.eventId, eventIds)),
        db.select({
          id: eventSessions.id,
          eventId: eventDays.eventId,
          eventDayId: eventSessions.eventDayId,
          title: eventSessions.title,
          startAt: eventSessions.startAt,
          endAt: eventSessions.endAt,
          attendanceRequired: eventSessions.attendanceRequired,
          checkinCloseAt: eventSessions.checkinCloseAt,
        }).from(eventSessions).innerJoin(eventDays, eq(eventSessions.eventDayId, eventDays.id)).where(inArray(eventDays.eventId, eventIds)),
        db.select({ participantId: participantStatusHistories.participantId, statusType: participantStatusHistories.statusType,
          toStatus: participantStatusHistories.toStatus, reason: participantStatusHistories.reason,
          changedAt: participantStatusHistories.changedAt }).from(participantStatusHistories)
          .where(inArray(participantStatusHistories.participantId, eventHistory.map((item) => item.participantId)))
          .orderBy(desc(participantStatusHistories.changedAt)),
      ])
    : [[], [], [], []];

  const activeAffiliations = affiliations.filter((affiliation) => affiliation.status === "ACTIVE");
  const primaryInstitution =
    activeAffiliations.find((affiliation) => affiliation.isPrimary) || activeAffiliations[0] || null;

  return {
    ...profile[0],
    affiliations,
    primaryInstitution,
    affiliationCount: activeAffiliations.length,
    completenessPercent: getUstadzCompletenessPercent(profile[0]),
    participationStats: {
      totalEvents: eventHistory.length,
      approved: eventHistory.filter((item) => item.approvalStatus === "APPROVED").length,
      attended: new Set(attendanceRows.filter((row) => ["PRESENT", "LATE"].includes(row.attendanceStatus)).map((row) => row.participantId)).size,
      rejected: eventHistory.filter((item) => ["REJECTED", "DECLINED"].includes(item.approvalStatus)).length,
      flagged: eventHistory.filter((item) => ["WAITLISTED", "PENDING_REVIEW"].includes(item.approvalStatus)).length,
    },
    eventHistory: eventHistory.map((item) => {
      const units = buildRequiredAttendanceUnits(
        item.attendanceMode as AttendanceMode,
        eventDayRows.filter((day) => day.eventId === item.eventId),
        eventSessionRows.filter((session) => session.eventId === item.eventId),
        item.timezone,
      );
      const participantAttendance = attendanceRows.filter((row) => row.participantId === item.participantId);
      const summary = summarizeParticipantAttendance(units, participantAttendance);
      return {
        ...item,
        statusReason: statusRows.find((history) => history.participantId === item.participantId &&
          history.toStatus === item.approvalStatus && history.statusType === "APPROVAL_STATUS")?.reason || null,
        attendanceCount: participantAttendance.length,
        attendedUnits: summary.attended,
        requiredUnits: summary.required,
        completionPercentage: summary.completionPercentage,
        attendanceStatus: summary.statusCategory,
      };
    }),
  };
}

export async function createUstadzRepository(data: typeof ustadzProfiles.$inferInsert) {
  const db = getDbClient();
  const created = await db.insert(ustadzProfiles).values(data).returning();
  return created[0];
}

export async function updateUstadzRepository(id: string, data: Partial<typeof ustadzProfiles.$inferInsert>) {
  const db = getDbClient();
  const updated = await db
    .update(ustadzProfiles)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(ustadzProfiles.id, id), isNull(ustadzProfiles.deletedAt)))
    .returning();
  return updated[0] || null;
}

export async function setUstadzArchivedRepository(id: string, archived: boolean) {
  const db = getDbClient();
  const [updated] = await db.update(ustadzProfiles)
    .set({ deletedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(ustadzProfiles.id, id), archived ? isNull(ustadzProfiles.deletedAt) : isNotNull(ustadzProfiles.deletedAt)))
    .returning();
  return updated || null;
}

export async function findDuplicateCandidatesRepository(fullName: string, email?: string | null, phone?: string | null) {
  const db = getDbClient();
  const normName = normalizeName(fullName);
  const normEmail = normalizeEmail(email);
  const normPhone = normalizePhone(phone);

  const conditions = [isNull(ustadzProfiles.deletedAt), eq(ustadzProfiles.profileStatus, "ACTIVE")];
  const orConditions = [eq(ustadzProfiles.normalizedName, normName)];

  if (normEmail) {
    orConditions.push(eq(ustadzProfiles.email, normEmail));
  }
  if (normPhone) {
    orConditions.push(eq(ustadzProfiles.phone, normPhone));
  }

  conditions.push(or(...orConditions)!);

  return await db.select().from(ustadzProfiles).where(and(...conditions));
}

export async function addAffiliationRepository(ustadzId: string, institutionId: string, position?: string | null, isPrimary = false) {
  const db = getDbClient();

  if (isPrimary) {
    // Reset all other active affiliations to isPrimary = false
    await db
      .update(ustadzInstitutionAffiliations)
      .set({ isPrimary: false })
      .where(eq(ustadzInstitutionAffiliations.ustadzId, ustadzId));
  }

  const created = await db
    .insert(ustadzInstitutionAffiliations)
    .values({
      ustadzId,
      institutionId,
      position: position || null,
      isPrimary,
      status: "ACTIVE",
    })
    .returning();

  return created[0];
}

export async function updateAffiliationRepository(
  ustadzId: string,
  affiliationId: string,
  data: {
    position?: string | null;
    isPrimary?: boolean;
    startDate?: string | null;
    endDate?: string | null;
    status?: string;
  },
) {
  const db = getDbClient();
  if (data.isPrimary) {
    await db
      .update(ustadzInstitutionAffiliations)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(ustadzInstitutionAffiliations.ustadzId, ustadzId));
  }
  const updated = await db
    .update(ustadzInstitutionAffiliations)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(ustadzInstitutionAffiliations.id, affiliationId),
        eq(ustadzInstitutionAffiliations.ustadzId, ustadzId),
      ),
    )
    .returning();
  return updated[0] || null;
}

export async function mergeUstadzProfilesTxRepository(
  sourceId: string,
  targetId: string,
  actorUserId: string,
  requestId: string,
  notes: string,
) {
  return await withTransaction(async (tx) => {
    // 1. Re-link affiliations to target Ustadz
    await tx
      .update(ustadzInstitutionAffiliations)
      .set({ ustadzId: targetId })
      .where(eq(ustadzInstitutionAffiliations.ustadzId, sourceId));

    // 2. Re-link event participants to target Ustadz
    await tx
      .update(eventParticipants)
      .set({ ustadzId: targetId })
      .where(eq(eventParticipants.ustadzId, sourceId));

    // 3. Mark source Ustadz as MERGED
    const updatedSource = await tx
      .update(ustadzProfiles)
      .set({
        profileStatus: "MERGED",
        mergedIntoId: targetId,
        updatedAt: new Date(),
      })
      .where(eq(ustadzProfiles.id, sourceId))
      .returning();

    // 4. Write audit log entry
    await tx.insert(auditLogs).values({
      actorUserId,
      action: "USTADZ_PROFILES_MERGED",
      resourceType: "USTADZ_PROFILE",
      resourceId: targetId,
      reason: `${notes} (Profil sumber ${sourceId} digabungkan ke ${targetId}.)`,
      requestId,
    });

    return updatedSource[0];
  });
}
