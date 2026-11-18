export const REGISTRATION_INSTITUTION_NAME_MAX = 180;
export const REGISTRATION_INSTITUTION_SEARCH_MIN = 3;
export const INSTITUTION_APOSTROPHES = "'’‘ʼ`";

export type RegistrationInstitutionSuggestion = {
  id: string;
  name: string;
  region: string | null;
};

export function registrationInstitutionSearchKey(value: string) {
  return value.replace(/['’‘ʼ`]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();
}

export function hasRegistrationInstitutionSearchTerm(key: string) {
  return key.replaceAll(" ", "").length >= REGISTRATION_INSTITUTION_SEARCH_MIN;
}
