import { pgTable, uuid, text, timestamp, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./foundation";
import { institutions, ustadzProfiles } from "./master_data";
import { events } from "./events";
import { invitations } from "./invitations";

// 16. event_participants
export const eventParticipants = pgTable(
  "event_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    ustadzId: uuid("ustadz_id").notNull().references(() => ustadzProfiles.id),
    institutionId: uuid("institution_id").references(() => institutions.id),
    invitationId: uuid("invitation_id").references(() => invitations.id),
    registrationSource: text("registration_source").notNull().default("INSTITUTION_DELEGATION"),
    participantCode: text("participant_code").notNull(),
    isDelegationLead: boolean("is_delegation_lead").notNull().default(false),
    confirmationStatus: text("confirmation_status").notNull().default("INVITED"),
    approvalStatus: text("approval_status").notNull().default("PENDING_REVIEW"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    replacementForParticipantId: uuid("replacement_for_participant_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_participant_event_ustadz").on(table.eventId, table.ustadzId),
    uniqueIndex("uniq_participant_event_code").on(table.eventId, table.participantCode),
    index("idx_participants_approval").on(table.eventId, table.approvalStatus),
    index("idx_participants_inst").on(table.eventId, table.institutionId),
  ]
);

// 17. participant_status_histories
export const participantStatusHistories = pgTable(
  "participant_status_histories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id").notNull().references(() => eventParticipants.id, { onDelete: "cascade" }),
    statusType: text("status_type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    changedBy: uuid("changed_by").references(() => users.id),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  }
);
