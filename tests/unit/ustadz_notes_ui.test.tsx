import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { YtsNoteBadge, YtsNoteDirectoryBadge, YtsNoteLegend, YtsNotesPanel } from "../../src/components/admin/ustadz/YtsNotesPanel";
import { canAccessYtsNotes, YTS_NOTE_FLAGS } from "../../src/lib/ustadzNotes";
const render = (node: React.ReactNode) => renderToStaticMarkup(<StaticRouter location="/admin/ustadz/test">{node}</StaticRouter>);
describe("YTS note UI privacy, legend and labels", () => {
  it.each(["BLUE", "YELLOW", "RED", "GREEN"] as const)("flag %s has both visible color and text, never color-only", flag => {
    const html = render(<YtsNoteBadge summary={{ ustadzId: "test", activeCount: 3, flag }} />);
    expect(html).toContain(YTS_NOTE_FLAGS[flag].color); expect(html).toContain(YTS_NOTE_FLAGS[flag].label); expect(html).toContain("3 catatan");
  });
  it("distinguishes no notes from loading and failures", () => {
    expect(render(<YtsNoteBadge summary={{ ustadzId: "test", activeCount: 0, flag: null }} />)).toContain("Tanpa catatan aktif");
    expect(render(<YtsNoteDirectoryBadge id="test" loading />)).toContain("Memuat penanda");
    const error = render(<YtsNoteDirectoryBadge id="test" loading={false} error="failed" />); expect(error).toContain("belum tersedia"); expect(error).not.toContain("Tanpa catatan");
    expect(error).toContain("/admin/ustadz/test?tab=notes");
  });
  it.each(["USTADZ", "DATA_STEWARD", "EVENT_ADMIN", "REPORT_VIEWER"])("does not mount notes panel for %s", roleCode => {
    expect(render(<YtsNotesPanel ustadzId="test" profileName="Uji" assignments={[{ roleCode }]} />)).toBe("");
  });
  it("policy rejects scoped, future, expired and invalid dates", () => {
    for (const extra of [{ eventId: "e" }, { institutionId: "i" }, { startsAt: "2099-01-01" }, { endsAt: "2000-01-01" }, { endsAt: "invalid" }]) expect(canAccessYtsNotes([{ roleCode: "SYSTEM_ADMIN", ...extra }])).toBe(false);
    expect(canAccessYtsNotes([{ roleCode: "SUPER_ADMIN" }])).toBe(true);
  });
  it("does not make sample profile notes look real", () => expect(render(<YtsNotesPanel ustadzId="test" profileName="Uji" assignments={[{ roleCode: "SYSTEM_ADMIN" }]} disabled />)).toContain("Tidak ada catatan nyata"));
  it("describes manual priorities and no automatic sanctions", () => {
    expect(render(<YtsNoteLegend />)).toContain("bukan penilaian atau sanksi otomatis");
    const html = render(<YtsNotesPanel ustadzId="test" profileName="Uji" assignments={[{ roleCode: "SYSTEM_ADMIN" }]} />);
    expect(html).toContain("tidak tampil di portal asatidz"); expect(html).toContain("Tambah catatan YTS"); expect(html).not.toContain("Belum ada catatan aktif");
  });
  it("merged profile points to target rather than creating duplicate notes", () => {
    const html = render(<YtsNotesPanel ustadzId="test" profileName="Uji" mergedIntoId="target" assignments={[{ roleCode: "SUPER_ADMIN" }]} />);
    expect(html).toContain("/admin/ustadz/target?tab=notes"); expect(html).not.toContain("Tambah catatan YTS");
  });
});