import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeleteParticipantDialog } from "../../src/components/participants/DeleteParticipantDialog";
import { participantStaffPermissions } from "../../src/lib/participantManagement";

const eventId = "event-a";
const participant = { id: "participant-a", name: "Ustadz Ahmad", participantCode: "P-001" };
const render = (roleCode: string, assignmentEvent = eventId, demoMode = false) => renderToStaticMarkup(
  <DeleteParticipantDialog eventId={eventId} participant={participant} demoMode={demoMode}
    permissions={participantStaffPermissions([{ roleCode, eventId: assignmentEvent }], eventId)} onDeleted={() => true} />,
);

describe("penghapusan peserta pada event", () => {
  it.each(["SUPER_ADMIN", "EVENT_ADMIN", "COMMITTEE_ADMIN", "COMMITTEE_ORGANIZER"])("menampilkan konfirmasi penghapusan untuk %s", (roleCode) => {
    const html = render(roleCode);
    expect(html).toContain('aria-label="Hapus peserta Ustadz Ahmad"');
    expect(html).toContain("P-001");
    expect(html).toContain("Data induk asatidz dan kepesertaan di event lain tetap tersimpan.");
    expect(html).toContain('type="checkbox" required=""');
    expect(html).toMatch(/minlength="3"/i);
    expect(html).toMatch(/type="submit" disabled=""/);
    expect(html).toContain("Hapus permanen");
  });
  it.each(["REPORT_VIEWER", "REGISTRATION_OFFICER", "CHECKIN_OFFICER", "COMMITTEE_LEAD", "INSTITUTION_REPRESENTATIVE", "USTADZ"])("tidak memberikan tombol hapus kepada %s", (roleCode) => {
    expect(render(roleCode)).toBe("");
  });
  it("tidak memberikan hak hapus admin event lain", () => {
    expect(render("EVENT_ADMIN", "event-b")).toBe("");
  });
  it("menonaktifkan penghapusan pada mode demo", () => {
    const html = render("EVENT_ADMIN", eventId, true);
    expect(html).toContain("penghapusan dinonaktifkan");
    expect(html).toContain('<fieldset disabled=""');
  });
});
