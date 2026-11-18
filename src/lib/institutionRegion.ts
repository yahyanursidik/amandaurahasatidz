import { INDONESIA_REGENCIES } from "./indonesiaRegionData";

const cityByCode = new Map(INDONESIA_REGENCIES.map((region) => [region.id, region]));
export const institutionProvinces = [...new Map(INDONESIA_REGENCIES.map((region) => [region.provinceId, region.province])).entries()]
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name, "id-ID"));

export const institutionCities = (provinceCode: string) => INDONESIA_REGENCIES
  .filter((region) => region.provinceId === provinceCode)
  .sort((a, b) => a.city.localeCompare(b.city, "id-ID"));

export function knownInstitutionRegion(cityCode?: string | null, provinceCode?: string | null) {
  const city = cityCode ? cityByCode.get(cityCode) : undefined;
  const province = institutionProvinces.find((item) => item.code === provinceCode);
  return { city: city?.city, province: city?.province || province?.name };
}

export function isValidInstitutionRegion(provinceCode?: string | null, cityCode?: string | null) {
  if (!provinceCode) return !cityCode;
  if (!institutionProvinces.some((province) => province.code === provinceCode)) return false;
  return !cityCode || cityByCode.get(cityCode)?.provinceId === provinceCode;
}

export const institutionRegionLabel = (cityCode?: string | null, provinceCode?: string | null) => {
  const region = knownInstitutionRegion(cityCode, provinceCode);
  return {
    city: region.city || cityCode || "—",
    province: region.province || provinceCode || "Wilayah belum diisi",
  };
};
