import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  COMMUNICATION_AUDIENCES, emptyCommunication, validateCommunication,
} from "../../src/lib/eventCommunications";

// The existing test setup is node/SSR-only. Inspect the page's JSX wiring
// without running context effects, contacting the API, or adding a DOM dependency.
const source = readFileSync(new URL("../../src/pages/committee/CommitteeOperationsPage.tsx", import.meta.url), "utf8");
const page = ts.createSourceFile("CommitteeOperationsPage.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function findNodes<T extends ts.Node>(guard: (node: ts.Node) => node is T): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node) => {
    if (guard(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(page);
  return found;
}

describe("committee announcements shared editor integration", () => {
  it("mounts the shared center only in the announcements branch, scoped and keyed to the selected event", () => {
    const imports = findNodes(ts.isImportDeclaration).filter((node) =>
      ts.isStringLiteral(node.moduleSpecifier)
      && node.moduleSpecifier.text === "@/components/admin/events/EventCommunicationCenter");
    expect(imports).toHaveLength(1);
    expect(imports[0].importClause?.namedBindings?.getText(page)).toContain("EventCommunicationCenter");

    const centers = findNodes(ts.isJsxSelfClosingElement).filter((node) => node.tagName.getText(page) === "EventCommunicationCenter");
    expect(centers).toHaveLength(1);
    const center = centers[0];
    const props = Object.fromEntries(center.attributes.properties.map((attribute) => {
      if (!ts.isJsxAttribute(attribute)) throw new Error("Expected explicit center props");
      return [attribute.name.getText(page), attribute.initializer?.getText(page)];
    }));
    expect(props).toMatchObject({ key: "{eventId}", eventId: "{eventId}", previewMode: "{preview}", onUnsavedChange: "{setCommunicationNavigation}" });

    let ancestor: ts.Node | undefined = center.parent;
    while (ancestor && !ts.isConditionalExpression(ancestor)) ancestor = ancestor.parent;
    if (!ancestor || !ts.isConditionalExpression(ancestor)) throw new Error("Missing mode branch");
    expect(ancestor.condition.getText(page)).toBe("attendanceMode");
    expect(ancestor.whenFalse.getText(page)).toContain(center.getText(page));
    expect(ancestor.whenFalse.getText(page)).toMatch(/eventId\s*&&/);
    expect(ancestor.whenTrue.getText(page)).not.toContain("EventCommunicationCenter");
    expect(ancestor.whenTrue.getText(page)).toContain("attendance-search");
    expect(ancestor.whenTrue.getText(page)).toContain("Matriks harian dan sesi");
  });

  it("delegates announcement API/publish handling while retaining attendance loading and dev fallback", () => {
    expect(source).not.toMatch(/createAnnouncement|publishAnnouncement|previewAnnouncements|composerOpen|type Announcement\b/);
    expect(source).not.toMatch(/\/announcements(?:[\x60/])/);
    expect(source).toContain("if (!attendanceMode || !eventId) return;");
    expect(source).toContain("/attendance/recap");
    expect(source).toContain("setPreview(import.meta.env.DEV)");
    expect(source).toContain('id="committee-operation-event"');
    expect(source).toContain("setEventId(nextEvent)");
  });

  it("guards event changes before remounting the editor and disables switching during requests", () => {
    const selectors = findNodes(ts.isJsxOpeningElement).filter((node) => node.tagName.getText(page) === "select"
      && node.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute)
        && attribute.name.getText(page) === "id" && attribute.initializer?.getText(page) === '"committee-operation-event"'));
    expect(selectors).toHaveLength(1);
    const props = Object.fromEntries(selectors[0].attributes.properties.map((attribute) => {
      if (!ts.isJsxAttribute(attribute)) throw new Error("Expected explicit selector props");
      return [attribute.name.getText(page), attribute.initializer?.getText(page)];
    }));
    expect(props.disabled).toBe("{!attendanceMode && communicationNavigation.pending}");
    expect(props.onChange).toContain("canSwitchCommunicationEvent(communicationNavigation, eventId, nextEvent");
    expect(props.onChange).toContain("window.confirm");
    expect(props.onChange).toContain("return;");
    expect(props.onChange!.indexOf("canSwitchCommunicationEvent")).toBeLessThan(props.onChange!.indexOf("setEventId(nextEvent)"));
    expect(props.onChange).toContain("setCommunicationNavigation({ hasUnsavedChanges: false, pending: false })");
  });

  it("preserves the backend-supported committee-only audience in the shared editor", () => {
    expect(COMMUNICATION_AUDIENCES).toContainEqual({ value: "COMMITTEE_ONLY", label: "Panitia" });
    expect(validateCommunication({
      ...emptyCommunication(),
      title: "Informasi panitia",
      body: "Persiapkan meja registrasi sebelum peserta tiba.",
      audienceType: "COMMITTEE_ONLY",
    })).toEqual([]);
  });
});
