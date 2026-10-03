import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PortalGreeting } from "../../src/components/portal/PortalGreeting";

describe("warm personalized portal HOME greeting", () => {
  it("welcomes the participant by their safely rendered profile name", () => {
    const html = renderToStaticMarkup(<PortalGreeting fullName="  Abdullah, Lc.  " activeTab="HOME" />);
    expect(html).toContain("Assalamu’alaikum, Abdullah, Lc..");
    expect(html).toContain("Semoga Allah memberkahi ilmu");
    expect(html).toContain('aria-labelledby="portal-greeting-title"');
    expect(html).toContain("[overflow-wrap:anywhere]");
  });
  it("escapes name markup rather than interpreting participant input as HTML", () => {
    const html = renderToStaticMarkup(<PortalGreeting fullName={'<script>alert("name")</script> & Ustadz'} activeTab="HOME" />);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; Ustadz");
  });
  it("uses a respectful fallback for a blank name", () => {
    expect(renderToStaticMarkup(<PortalGreeting fullName=" " activeTab="HOME" />)).toContain("Bapak/Ibu Asatidz");
  });
  it.each(["PROFILE", "INVITATIONS", "ACTIVITIES", "SCHEDULE", "QR", "ANNOUNCEMENTS", "ATTENDANCE"])("does not show the HOME greeting on %s", (activeTab) => {
    expect(renderToStaticMarkup(<PortalGreeting fullName="Abdullah" activeTab={activeTab} />)).toBe("");
  });
});