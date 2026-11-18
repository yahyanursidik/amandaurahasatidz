export const REGISTRATION_INSTITUTION_NAME_MAX = 180;
export const REGISTRATION_INSTITUTION_PAGE_SIZE = 20;

export type RegistrationInstitutionSuggestion = {
  id: string;
  name: string;
  region: string | null;
};

export type RegistrationInstitutionPage = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export type RegistrationInstitutionProposal = {
  name: string;
  provinceCode?: string | null;
  cityCode?: string | null;
};

export function registrationInstitutionSearchKey(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").replace(/['’‘ʼ`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();
}
