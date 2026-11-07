import { INDONESIA_REGENCIES } from "@/lib/indonesiaRegionData";

const cityByCode = new Map(INDONESIA_REGENCIES.map((region) => [region.id, region]));
export const institutionProvinces = [...new Map(INDONESIA_REGENCIES.map((region) => [region.provinceId, region.province])).entries()]
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name, "id-ID"));

export const institutionCities = (provinceCode: string) => INDONESIA_REGENCIES
  .filter((region) => region.provinceId === provinceCode)
  .sort((a, b) => a.city.localeCompare(b.city, "id-ID"));

export const institutionRegionLabel = (cityCode?: string | null, provinceCode?: string | null) => {
  const city = cityCode ? cityByCode.get(cityCode) : undefined;
  const province = institutionProvinces.find((item) => item.code === provinceCode);
  return {
    city: city?.city || cityCode || "—",
    province: city?.province || province?.name || provinceCode || "Wilayah belum diisi",
  };
};
