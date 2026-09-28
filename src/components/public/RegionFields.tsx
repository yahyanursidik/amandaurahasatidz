import React, { useEffect, useState } from "react";
import { loadIndonesianRegencies, suggestRegencies, type Regency } from "@/lib/indonesiaRegions";

export type RegionValue = { city: string; province: string; cityCode: string; provinceCode: string };

export const RegionFields: React.FC<{ value: RegionValue; onChange: (next: RegionValue) => void; prefix: string }> = ({ value, onChange, prefix }) => {
  const [regions, setRegions] = useState<Regency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadIndonesianRegencies().then((result) => { if (active) setRegions(result); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const suggestions = focused && !value.cityCode ? suggestRegencies(regions, value.city) : [];
  return <div className="grid gap-3 sm:grid-cols-2">
    <div className="relative">
      <label htmlFor={`${prefix}-city`} className="mb-1 block text-sm font-bold">Kabupaten/kota *</label>
      <input id={`${prefix}-city`} value={value.city} onChange={(event) => onChange({ city: event.target.value, province: "", cityCode: "", provinceCode: "" })}
        onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false), 150)} autoComplete="address-level2" required
        placeholder="Ketik beberapa huruf, mis. Bandung" className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
      {suggestions.length > 0 && <ul className="absolute z-10 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-xl" role="listbox" aria-label="Saran kabupaten atau kota">{suggestions.map((region) =>
        <li key={region.id}><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange({ city: region.city, province: region.province, cityCode: region.id, provinceCode: region.provinceId }); setFocused(false); }}
          className="min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-emerald-50">{region.city} · {region.province}</button></li>)}</ul>}
      {loading && <p className="mt-1 text-xs text-slate-500">Memuat saran wilayah…</p>}
      {error && <p className="mt-1 text-xs text-amber-800">Saran wilayah belum tersedia; isi kota dan provinsi secara manual.</p>}
    </div>
    <div><label htmlFor={`${prefix}-province`} className="mb-1 block text-sm font-bold">Provinsi *</label>
      <input id={`${prefix}-province`} value={value.province} onChange={(event) => onChange({ ...value, province: event.target.value, provinceCode: "", cityCode: "" })}
        autoComplete="address-level1" required placeholder="Terisi setelah pilih kabupaten/kota" className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
    </div>
  </div>;
};
