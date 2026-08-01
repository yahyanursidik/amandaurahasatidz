import React from "react";
import { InvitationShareActions } from "./InvitationShareActions";

const previewContext = {
  institutionName: "Ma'had Ilmu Sunnah Bandung",
  eventName: "Daurah Asatidz",
  invitationNumber: "INV/2026/BDG/001",
  invitationUrl: "https://example.test/invitation/institution/token",
  responseDeadline: "2026-08-05T16:59:59Z",
};

const states = ["default", "hover", "focus", "active", "disabled", "loading", "error", "success"] as const;

export const InvitationShareActionsPreview: React.FC = () => (
  <main className="invitation-share-preview">
    <h1>Invitation share actions — 8 states</h1>
    {states.map((state) => (
      <section key={state}>
        <h2>{state}</h2>
        <InvitationShareActions context={previewContext} previewState={state} />
      </section>
    ))}
  </main>
);
