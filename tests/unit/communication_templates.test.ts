import { describe, expect, it } from "vitest";
import {
  BUILTIN_COMMUNICATION_TEMPLATES,
  COMMUNICATION_VARIABLES,
  findCommunicationVariables,
  getUnresolvedCommunicationVariables,
  renderCommunicationText,
} from "../../src/lib/communicationTemplates";

const variables = Object.fromEntries(COMMUNICATION_VARIABLES.map(({ key }) => [key, `value-${key}`]));

describe("event communication template library", () => {
  it("provides distinct complete drafts for fifteen operational needs", () => {
    expect(BUILTIN_COMMUNICATION_TEMPLATES).toHaveLength(15);
    expect(new Set(BUILTIN_COMMUNICATION_TEMPLATES.map(({ id }) => id)).size).toBe(15);
    const allowed = COMMUNICATION_VARIABLES.map(({ key }) => key);
    for (const template of BUILTIN_COMMUNICATION_TEMPLATES) {
      expect(template.name.length).toBeGreaterThan(3);
      expect(template.body.length).toBeGreaterThan(100);
      expect(template.emailSubject).toContain("{{eventName}}");
      for (const key of findCommunicationVariables(template.title, template.emailSubject, template.body)) {
        expect(allowed).toContain(key);
      }
    }
  });

  it("replaces whitespace placeholders globally in a single pass", () => {
    expect(renderCommunicationText("{{eventName}} / {{ eventName }} / {{unknown}}", { eventName: "$& {{ustadzName}}", ustadzName: "secret" }))
      .toBe("$& {{ustadzName}} / $& {{ustadzName}} / {{unknown}}");
  });

  it("does not resolve inherited properties", () => {
    expect(renderCommunicationText("{{constructor}} {{toString}}", {})).toBe("{{constructor}} {{toString}}");
    expect(getUnresolvedCommunicationVariables(["{{constructor}}"], {})).toEqual(["constructor"]);
  });

  it("identifies unknown, empty, malformed and unfinished editorial placeholders", () => {
    expect(findCommunicationVariables("{{eventName}} {{ eventName }}", "{{ typo }}")).toEqual(["eventName", "typo"]);
    expect(getUnresolvedCommunicationVariables(["{{eventName}} {{eventVenue}} {{typo}} [ISI: tautan materi] {{unfinished"], { eventName: "Daurah", eventVenue: "  " }))
      .toEqual(["eventVenue", "typo", "[ISI: tautan materi]", "Placeholder tidak lengkap"]);
  });

  it("keeps editorial requirements visible until panitia finishes the message", () => {
    const reminder = BUILTIN_COMMUNICATION_TEMPLATES.find(({ id }) => id === "builtin-reminder")!;
    expect(getUnresolvedCommunicationVariables([reminder.body], variables)).toContain("[ISI: waktu registrasi dan zona waktu]");
    const completed = reminder.body.replace("[ISI: waktu registrasi dan zona waktu]", "07.00 WIB");
    expect(getUnresolvedCommunicationVariables([completed], variables)).toEqual([]);
  });

  it("blocks empty and unclosed editorial instructions as well as complete ones", () => {
    expect(getUnresolvedCommunicationVariables(["Pesan [ISI:]", "Informasi [ISI: belum lengkap"], variables))
      .toEqual(["[ISI:]", "[ISI: belum lengkap"]);
  });
});