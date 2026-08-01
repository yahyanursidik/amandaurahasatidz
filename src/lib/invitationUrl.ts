export const toInstitutionInvitationSlug = (institutionName: string) => {
  const slug = institutionName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "lembaga";
};

export const buildInstitutionInvitationPath = (institutionName: string, rawToken: string) =>
  `/invitation/institution/${toInstitutionInvitationSlug(institutionName)}/${rawToken}`;
