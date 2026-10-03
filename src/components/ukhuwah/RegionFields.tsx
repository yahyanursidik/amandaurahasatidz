import { UKHUWAH_REGIONS, UKHUWAH_SUMEDANG_DISTRICTS } from "@/lib/ukhuwah";
import { field, Label } from "./ui";
export function RegionFields({ cityCode, district, onChange }: { cityCode: string; district: string; onChange: (fields: { cityCode?: string; district?: string }) => void }) {
  return <div className="grid gap-4 sm:grid-cols-3">
    <Label name="Provinsi"><input className={field} value="Jawa Barat" readOnly /></Label>
    <Label name="Kabupaten/kota"><select className={field} value={cityCode} onChange={e => onChange({ cityCode: e.target.value, district: "" })}>{UKHUWAH_REGIONS.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select></Label>
    <Label name="Kecamatan">{cityCode === "3211" ? <select className={field} required value={district} onChange={e => onChange({ district: e.target.value })}><option value="">Pilih kecamatan</option>{UKHUWAH_SUMEDANG_DISTRICTS.map(d => <option key={d}>{d}</option>)}</select> : <input className={field} maxLength={120} value={district} onChange={e => onChange({ district: e.target.value })} />}</Label>
  </div>;
}