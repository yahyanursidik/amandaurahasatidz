import { config } from "dotenv";
config({ path: ".env" });
import { getDbClient } from "./netlify/functions/lib/db/client";
import { saveInstitutionDelegationRepository } from "./netlify/functions/lib/repositories/invitationRepository";
import { invitations } from "./netlify/functions/lib/db/schema";
import { isNotNull } from "drizzle-orm";

async function main() {
  const db = getDbClient();
  
  // Find a valid institution invitation
  const rows = await db.select().from(invitations).where(isNotNull(invitations.institutionId)).limit(1);
  if (rows.length === 0) {
    console.log("No invitation found");
    return;
  }
  const invitation = rows[0];

  const payload = {
    responseStatus: "ACCEPTED" as const,
    notes: "",
    isFinal: true,
    delegates: [
      {
        fullName: "Ustadz Abdullah, Lc.",
        phone: "081299990000",
        whatsapp: "081299990000",
        email: "abdullah@example.org",
        address: "Bandung, Jawa Barat",
        isLead: true
      }
    ]
  };

  try {
    console.log("Saving delegation for invitation:", invitation.id);
    const result = await saveInstitutionDelegationRepository(invitation.id, payload);
    console.log("SUCCESS:", result);
  } catch (e) {
    console.error("ERROR IN SAVE:", e);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
