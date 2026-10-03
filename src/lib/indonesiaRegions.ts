import { INDONESIA_REGENCIES, type Regency } from "./indonesiaRegionData";
export type { Regency } from "./indonesiaRegionData";

/** Bundled data: no third-party browser requests. */
export function loadIndonesianRegencies(): Promise<Regency[]> {
  return Promise.resolve(INDONESIA_REGENCIES);
}

function searchWords(text: string) {
  return text.toLocaleLowerCase("id-ID").replace(/\bkab\.?\s/g, "kabupaten ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean);
}

export function suggestRegencies(regions: Regency[], query: string, max = 8) {
  const words = searchWords(query);
  if (words.join("").length < 2) return [];
  return regions.filter((region) => {
    const haystack = searchWords(`${region.city} ${region.province}`).join(" ");
    return words.every((word) => haystack.includes(word));
  }).slice(0, max);
}
