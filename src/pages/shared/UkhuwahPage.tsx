import { useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { MapPin, ShieldCheck, FileText, Plus } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { UkhuwahMap } from "@/components/ukhuwah/UkhuwahMap";
import { LocationEditor } from "@/components/ukhuwah/LocationEditor";
import { ReportEditor } from "@/components/ukhuwah/ReportEditor";
import { ReportDetail } from "@/components/ukhuwah/ReportDetail";
import { button, card, field, Label, Notice, primary, ResourceState, TextBody, useResource } from "@/components/ukhuwah/ui";
import { UKHUWAH_REGIONS, UKHUWAH_SUMEDANG_DISTRICTS, canManageUkhuwah, categoryLabels, locationTypeLabels, publicationLabels, regionLabel, ukhuwahPhoneUrl, workStatusLabels, type UkhuwahLocation, type UkhuwahPageResult, type UkhuwahReport } from "@/lib/ukhuwah";
import type { AuthIdentity } from "@/lib/refine/authProvider";

type Assignment = AuthIdentity["assignments"][number] & { isActive?: boolean; status?: string; startsAt?: string; endsAt?: string };
export function canAccessUkhuwah(assignments: Assignment[], admin: boolean, now = new Date()) {
  const active = assignments.filter(a => a.isActive !== false && (!a.status || a.status === "ACTIVE") && (!a.startsAt || new Date(a.startsAt) <= now) && (!a.endsAt || new Date(a.endsAt) >= now));
  return admin ? canManageUkhuwah(active, now) : active.some(a => a.roleCode === "USTADZ");
}
function useFilters() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = [10, 20, 50].includes(Number(params.get("pageSize"))) ? Number(params.get("pageSize")) : 20;
  const [search, setSearch] = useState(params.get("search") ?? "");
  const change = (key: string, value: string) => setParams(current => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); if (key !== "page") next.set("page", "1"); if (key === "cityCode") next.delete("district"); return next; });
  const query = new URLSearchParams(); query.set("page", String(page)); query.set("pageSize", String(pageSize));
  ["search", "cityCode", "district", "category", "publicationStatus", "workStatus"].forEach(key => { if (params.get(key)) query.set(key, params.get(key)!); });
  return { params, page, pageSize, search, setSearch, change, query };
}
type Filters = ReturnType<typeof useFilters>;
function FilterBar({ filters: f, reports, admin }: { filters: Filters; reports: boolean; admin: boolean }) {
  return <form className={`${card} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`} onSubmit={e => { e.preventDefault(); f.change("search", f.search.trim()); }} aria-label="Filter pencarian">
    <Label name="Cari"><div className="flex gap-2"><input className={field} value={f.search} maxLength={120} onChange={e => f.setSearch(e.target.value)} placeholder={reports ? "Judul atau isi laporan" : "Nama atau alamat lokasi"} /><button className={button} type="submit">Cari</button></div></Label>
    <Label name="Wilayah"><select className={field} value={f.params.get("cityCode") ?? ""} onChange={e => f.change("cityCode", e.target.value)}><option value="">Semua wilayah cakupan</option>{UKHUWAH_REGIONS.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}</select></Label>
    {f.params.get("cityCode") === "3211" && <Label name="Kecamatan Sumedang"><select className={field} value={f.params.get("district") ?? ""} onChange={e => f.change("district", e.target.value)}><option value="">Lima kecamatan cakupan</option>{UKHUWAH_SUMEDANG_DISTRICTS.map(d => <option key={d}>{d}</option>)}</select></Label>}
    {reports && <Label name="Kategori"><select className={field} value={f.params.get("category") ?? ""} onChange={e => f.change("category", e.target.value)}><option value="">Semua kategori</option>{Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Label>}
    {reports && admin && <Label name="Publikasi"><select className={field} value={f.params.get("publicationStatus") ?? ""} onChange={e => f.change("publicationStatus", e.target.value)}><option value="">Semua status</option>{Object.entries(publicationLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Label>}
    {reports && <Label name="Tindak lanjut"><select className={field} value={f.params.get("workStatus") ?? ""} onChange={e => f.change("workStatus", e.target.value)}><option value="">Semua status pekerjaan</option>{Object.entries(workStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Label>}
  </form>;
}
function Pager({ meta, filters: f, loading }: { meta?: UkhuwahPageResult<unknown>["meta"]; filters: Filters; loading: boolean }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4"><Label name="Per halaman"><select className={field} value={f.pageSize} onChange={e => f.change("pageSize", e.target.value)}>{[10, 20, 50].map(n => <option key={n}>{n}</option>)}</select></Label><p className="text-sm text-slate-600">{meta ? `${meta.total} item yang dapat diakses · Halaman ${meta.page} dari ${Math.max(1, meta.totalPages)}` : "Memuat halaman…"}</p><div className="flex gap-2"><button className={button} disabled={loading || !meta || meta.page <= 1} onClick={() => f.change("page", String(f.page - 1))}>Sebelumnya</button><button className={button} disabled={loading || !meta || meta.page >= meta.totalPages} onClick={() => f.change("page", String(f.page + 1))}>Berikutnya</button></div></div>;
}
function LocationInfo({ location: l, admin, onEdit }: { location: UkhuwahLocation; admin: boolean; onEdit: () => void }) {
  function contact(phone: string | null | undefined, label: string) {
    if (!phone) return null; const url = ukhuwahPhoneUrl(phone);
    const whatsapp = ukhuwahPhoneUrl(phone, true);
    return <p className="text-sm">{label}: {url ? <a className="font-semibold text-emerald-800 underline" href={url}>{phone}</a> : phone}{whatsapp && <> · <a className="font-semibold text-emerald-800 underline" href={whatsapp} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">WhatsApp</a></>}</p>;
  }
  return <article className={`${card} space-y-3`} aria-label="Detail lokasi"><h2 className="text-xl font-bold">{l.name}</h2><p className="text-sm text-slate-600">{locationTypeLabels[l.type]} · {regionLabel(l.cityCode)} · {l.district || "Kecamatan belum dicatat"}</p><TextBody>{l.address}</TextBody><p className="text-sm">{l.isVerified ? "Lokasi terverifikasi" : "Belum terverifikasi"} · {l.latitude === null || l.longitude === null ? "Belum memiliki pin" : `Koordinat ${l.latitude}, ${l.longitude}`}</p><h3 className="font-semibold">Program</h3><TextBody>{l.programs || "Belum dicatat"}</TextBody><h3 className="font-semibold">Kebutuhan</h3><TextBody>{l.needs || "Belum dicatat"}</TextBody>
    {(admin || l.officialContactShared !== false) && contact(l.officialPhone, "Kontak resmi")}{(admin || l.picContactShared !== false) && <>{l.picName && <p className="text-sm">PIC: {l.picName}</p>}{contact(l.picPhone, "Kontak PIC")}</>}
    <p className="text-xs text-slate-500">Kontak hanya ditampilkan sesuai izin. Pembaruan: {l.updatedAt.slice(0, 10)}</p>{admin && <button className={button} data-ukhuwah-navigation onClick={onEdit}>Edit lokasi dan izin kontak</button>}
  </article>;
}
function Locations({ prefix, admin, editorTab }: { prefix: string; admin: boolean; editorTab: boolean }) {
  const filters = useFilters(); const [refresh, setRefresh] = useState(0);
  const resource = useResource<UkhuwahPageResult<UkhuwahLocation>>(`${prefix}/locations?${filters.query}`, refresh);
  const [selected, setSelected] = useState<UkhuwahLocation | null>(null);
  const [editor, setEditor] = useState<{ location?: UkhuwahLocation } | null>(null);
  const selectedResource = useResource<UkhuwahLocation>(selected ? `${prefix}/locations/${selected.id}` : null, refresh);
  const choose = (location: UkhuwahLocation) => { setSelected(location); };
  return <div className="space-y-5"><FilterBar filters={filters} reports={false} admin={admin} />
    {admin && <button className={primary} data-ukhuwah-navigation onClick={() => setEditor({})}><Plus size={18} className="mr-2" />Tambah lokasi lembaga</button>}
    <ResourceState resource={resource} />
    {resource.data && <><UkhuwahMap locations={resource.data.data} selectedId={selected?.id} onSelect={choose} /><p className="text-sm text-slate-600">Peta memuat lokasi pada halaman daftar ini saja. Daftar tetap tersedia tanpa layanan peta. Cakupan operasional bukan batas administratif resmi.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{resource.data.data.map(l => <button key={l.id} className={`${card} text-left hover:border-emerald-600 ${selected?.id === l.id ? "border-emerald-700 ring-2 ring-emerald-100" : ""}`} onClick={() => choose(l)}><h2 className="font-bold">{l.name}</h2><p className="mt-1 text-sm text-slate-600">{regionLabel(l.cityCode)} · {locationTypeLabels[l.type]}</p><p className="mt-2 text-xs">{l.isVerified ? "Terverifikasi" : "Perlu verifikasi"}{l.latitude === null ? " · Belum ada pin" : ""}</p></button>)}</div>{!resource.data.data.length && <Notice>Tidak ada lokasi yang dapat diakses dengan filter ini.</Notice>}</>}
    <Pager meta={resource.data?.meta} filters={filters} loading={resource.loading} />
    {selected && <><ResourceState resource={selectedResource} />{selectedResource.data && <LocationInfo location={selectedResource.data} admin={admin} onEdit={() => setEditor({ location: selectedResource.data })} />}</>}
    {admin && editorTab && !editor && <p className="text-sm text-slate-600">Pilih lokasi untuk mengedit, atau tambahkan lokasi baru.</p>}
    {admin && editor && <LocationEditor key={editor.location?.id ?? "new"} location={editor.location} onClose={() => setEditor(null)} onSaved={l => { setSelected(l); setRefresh(n => n + 1); }} />}
  </div>;
}
function Reports({ prefix, root, admin, tab }: { prefix: string; root: string; admin: boolean; tab: string }) {
  const filters = useFilters(); const query = new URLSearchParams(filters.query);
  if (tab === "moderasi") query.set("publicationStatus", "PENDING");
  const resource = useResource<UkhuwahPageResult<UkhuwahReport>>(`${prefix}/${tab === "laporan-saya" ? "my-reports" : "reports"}?${query}`);
  return <div className="space-y-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-bold">{tab === "moderasi" ? "Antrian moderasi" : tab === "tindak-lanjut" ? "Tindak lanjut laporan" : tab === "laporan-saya" ? "Laporan saya" : "Papan laporan"}</h2><Link className={primary} to={`${root}/laporan/baru`}>Buat laporan</Link></div><FilterBar filters={filters} reports admin={admin && tab !== "moderasi"} /><ResourceState resource={resource} />
    {resource.data && <div className="space-y-3">{resource.data.data.map(r => <Link key={r.id} to={`${root}/laporan/${r.id}`} className={`${card} block hover:border-emerald-600`}><div className="flex flex-wrap gap-2 text-xs text-slate-600"><span>{publicationLabels[r.publicationStatus]}</span><span>· {workStatusLabels[r.workStatus]}</span><span>· {r.audience === "ADMIN_ONLY" ? "Khusus pengelola" : "Bersama"}</span></div><h3 className="mt-2 text-lg font-bold break-words">{r.title}</h3><p className="mt-1 text-sm text-slate-600">{regionLabel(r.cityCode)} · {categoryLabels[r.category]}</p>{r.followupSummary && <p className="mt-2 whitespace-pre-wrap break-words text-sm line-clamp-3">{r.followupSummary}</p>}{tab === "tindak-lanjut" && r.dueDate && <p className="mt-2 text-sm">Tenggat: {r.dueDate.slice(0, 10)}</p>}</Link>)}{!resource.data.data.length && <Notice>Tidak ada laporan yang dapat diakses dengan filter ini.</Notice>}</div>}<Pager meta={resource.data?.meta} filters={filters} loading={resource.loading} />
  </div>;
}

function Workspace({ admin }: { admin: boolean }) {
  const root = admin ? "/admin/peta-ukhuwah" : "/portal/peta-ukhuwah";
  const prefix = admin ? "/admin/ukhuwah" : "/ukhuwah";
  const location = useLocation(); const subpath = location.pathname.slice(root.length).replace(/^\/+|\/+$/g, "");
  const tabs = [{ path: "", label: "Peta & daftar", icon: MapPin }, { path: "laporan", label: "Laporan", icon: FileText }, { path: "laporan-saya", label: "Laporan saya", icon: FileText }, ...(admin ? [{ path: "lembaga", label: "Lembaga", icon: MapPin }, { path: "moderasi", label: "Moderasi", icon: ShieldCheck }, { path: "tindak-lanjut", label: "Tindak lanjut", icon: ShieldCheck }] : [])];
  const known = ["", "peta", "laporan", "laporan-saya", "laporan/baru", ...(admin ? ["lembaga", "moderasi", "tindak-lanjut"] : [])].includes(subpath) || /^laporan\/[^/]+$/.test(subpath);
  return <main className="space-y-6"><header><p className="text-sm font-semibold text-emerald-800">Bandung Raya · Cakupan operasional awal</p><h1 className="mt-2 text-3xl font-black text-slate-950">Peta Ukhuwah</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Mengenali lembaga, berbagi pengamatan, dan mencatat langkah kolaborasi. Pengamatan bukan fakta terverifikasi; tidak ada laporan bukan berarti tidak ada kebutuhan.</p></header><nav aria-label="Navigasi Peta Ukhuwah" className="flex flex-wrap gap-2">{tabs.map(t => <Link key={t.path} className={`${button} ${subpath === t.path ? "!border-emerald-700 !bg-emerald-50 !text-emerald-900" : ""}`} aria-current={subpath === t.path ? "page" : undefined} to={`${root}${t.path ? `/${t.path}` : ""}`}><t.icon size={16} className="mr-2" />{t.label}</Link>)}</nav><aside className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Privasi: laporan khusus pengelola, kontak tanpa izin, dan identitas penulis yang disembunyikan tidak dibagikan ke anggota. Laporan bersama hanya muncul setelah moderasi. Tidak ada komentar, unggahan, ekspor, atau pesan otomatis pada tahap ini.</aside>
    <div key={subpath}>{!known ? <Notice error>Halaman tidak tersedia atau Anda tidak memiliki akses.</Notice> : subpath === "laporan/baru" ? <ReportEditor prefix={prefix} /> : subpath.startsWith("laporan/") ? <ReportDetail id={subpath.slice(8)} prefix={prefix} root={root} admin={admin} /> : ["laporan", "laporan-saya", "moderasi", "tindak-lanjut"].includes(subpath) ? <Reports prefix={prefix} root={root} admin={admin} tab={subpath} /> : <Locations prefix={prefix} admin={admin} editorTab={subpath === "lembaga"} />}</div>
  </main>;
}
export function UkhuwahPage({ admin = false }: { admin?: boolean }) {
  const identity = useGetIdentity<AuthIdentity>();
  const allowed = canAccessUkhuwah(identity.data?.assignments ?? [], admin);
  const Layout = admin ? AdminLayout : PortalLayout;
  return <Layout>{identity.isLoading ? <p role="status">Memeriksa akses…</p> : !allowed ? <Notice error>Akses Peta Ukhuwah tidak tersedia. Diperlukan peran {admin ? "SUPER_ADMIN / SYSTEM_ADMIN global aktif" : "USTADZ aktif"}.</Notice> : <Workspace admin={admin} />}</Layout>;
}
export default UkhuwahPage;