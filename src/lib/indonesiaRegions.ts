export type Regency = { id: string; provinceId: string; city: string; province: string };
type ProvinceResponse = { id: string; name: string };
type RegencyResponse = { id: string; province_id: string; name: string };

const DATA_BASE = "https://www.emsifa.com/api-wilayah-indonesia/api";
let regionPromise: Promise<Regency[]> | null = null;

/** Load public region data once per page visit; retries are possible after a network failure. */
export function loadIndonesianRegencies(): Promise<Regency[]> {
  if (!regionPromise) regionPromise = (async () => {
    const response = await fetch(`${DATA_BASE}/provinces.json`);
    if (!response.ok) throw new Error("Data provinsi belum tersedia.");
    const provinces = await response.json() as ProvinceResponse[];
    const results: Regency[] = [];
    // Bound concurrent requests instead of opening 34 connections at once.
    for (let offset = 0; offset < provinces.length; offset += 6) {
      const group = provinces.slice(offset, offset + 6);
      const regions = await Promise.all(group.map(async (province) => {
        const res = await fetch(`${DATA_BASE}/regencies/${province.id}.json`);
        if (!res.ok) throw new Error("Data kabupaten/kota belum tersedia.");
        const cities = await res.json() as RegencyResponse[];
        return cities.map((city) => ({ id: city.id, provinceId: province.id, city: city.name, province: province.name }));
      }));
      results.push(...regions.flat());
    }
    return results;
  })().catch((error) => {
    regionPromise = null;
    throw error;
  });
  return regionPromise;
}

export function suggestRegencies(regions: Regency[], query: string, max = 8) {
  const normalized = query.trim().toLocaleLowerCase("id-ID");
  if (normalized.length < 2) return [];
  return regions.filter((region) => `${region.city} ${region.province}`.toLocaleLowerCase("id-ID").includes(normalized)).slice(0, max);
}
