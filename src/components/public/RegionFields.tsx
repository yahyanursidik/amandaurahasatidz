import React, { useEffect, useState } from "react";
import { loadIndonesianRegencies, suggestRegencies, type Regency } from "@/lib/indonesiaRegions";

export type RegionValue = { city: string; province: string; cityCode: string; provinceCode: string };

export const RegionFields: React.FC<{ value: RegionValue; onChange: (next: RegionValue) => void; prefix: string;
  disabled?: boolean; required?: boolean; requireSelection?: boolean; readOnlyProvince?: boolean;
}> = ({ value, onChange, prefix, disabled = false, required = true, requireSelection = false, readOnlyProvince = false }) => {
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

  const suggestions = focused && !disabled && !value.cityCode ? suggestRegencies(regions, value.city) : [];
  const select = (region: Regency) => {
    onChange({ city: region.city, province: region.province, cityCode: region.id, provinceCode: region.provinceId });
    setFocused(false);
  };
  return <div className="grid gap-3 sm:grid-cols-2">
    <div className="relative">
      <label htmlFor={`${prefix}-city`} className="mb-1 block text-sm font-bold">Kabupaten/kota{required ? " *" : ""}</label>
      <input id={`${prefix}-city`} disabled={disabled} value={value.city} onChange={(event) => onChange({ city: event.target.value, province: "", cityCode: "", provinceCode: "" })}
        onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => { if (document.activeElement?.id !== `${prefix}-city` && !document.activeElement?.closest(`#${prefix}-suggestions`)) setFocused(false); }, 150)} autoComplete="off" required={required}
        role="combobox" aria-autocomplete="list" aria-expanded={suggestions.length > 0} aria-controls={`${prefix}-suggestions`}
        aria-describedby={`${prefix}-region-help`} aria-invalid={requireSelection && !!value.city && !value.cityCode}
        onKeyDown={(event) => { if (event.key === "Escape") setFocused(false); if (event.key === "ArrowDown" && suggestions.length) { event.preventDefault(); document.getElementById(`${prefix}-option-0`)?.focus(); } }}
        placeholder="Ketik kota atau kabupaten, mis. bandung barat" className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm disabled:bg-slate-100" />
      {suggestions.length > 0 && <ul id={`${prefix}-suggestions`} className="absolute z-10 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-xl" role="listbox" aria-label="Saran kabupaten atau kota">{suggestions.map((region, index) =>
        <li key={region.id} role="option" aria-selected={false}><button id={`${prefix}-option-${index}`} type="button" onMouseDown={(event) => event.preventDefault()} onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => { if (document.activeElement?.id !== `${prefix}-city` && !document.activeElement?.closest(`#${prefix}-suggestions`)) setFocused(false); }, 150)} onClick={() => select(region)}
          onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); document.getElementById(`${prefix}-option-${(index + (event.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length}`)?.focus(); } if (event.key === "Escape") { setFocused(false); document.getElementById(`${prefix}-city`)?.focus(); } }}
          className="min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-emerald-50">{region.city} · {region.province}</button></li>)}</ul>}
      {loading && <p className="mt-1 text-xs text-slate-500">Memuat saran wilayah…</p>}
      {error && <p className="mt-1 text-xs text-amber-800">{requireSelection ? "Data wilayah belum tersedia. Muat ulang halaman sebelum memilih domisili." : "Saran wilayah belum tersedia; isi kota dan provinsi secara manual."}</p>}
      <p id={`${prefix}-region-help`} className="mt-1 text-xs text-slate-500">{requireSelection && value.city && !value.cityCode ? "Pilih salah satu kabupaten/kota dari saran sebelum menyimpan." : "Cari dengan beberapa kata; pilih wilayah yang sesuai."}</p>
    </div>
    <div><label htmlFor={`${prefix}-province`} className="mb-1 block text-sm font-bold">Provinsi{required ? " *" : ""}</label>
      <input id={`${prefix}-province`} disabled={disabled} readOnly={readOnlyProvince} value={value.province} onChange={(event) => onChange({ ...value, province: event.target.value, provinceCode: "", cityCode: "" })}
        autoComplete="address-level1" required={required} placeholder="Terisi setelah pilih kabupaten/kota" className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm read-only:bg-slate-50 disabled:bg-slate-100" />
    </div>
  </div>;
};
