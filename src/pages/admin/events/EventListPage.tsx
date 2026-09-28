import React, { useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Link, useSearchParams } from "react-router-dom";
import { Calendar, ClipboardList, Eye, ExternalLink, MapPin, Plus, RefreshCw, Search, Trash2, UserRoundCheck } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge, StatusVariant } from "@/components/common/StatusBadge";
import { EventWhatsAppDialog } from "@/components/admin/events/EventWhatsAppDialog";
import { eventApi } from "@/lib/eventApi";
import { AuthIdentity } from "@/lib/refine/authProvider";
import { DEFAULT_EVENT_POSTER, posterObjectPosition } from "@/lib/eventPoster";

type EventSummary = {
  id: string; code: string; slug: string; name: string; startDate: string; endDate: string;
  timezone: string; venueName: string | null; posterUrl: string | null;
  posterAlt: string | null; posterFocalPoint: string | null; audienceMode: string; status: string;
};
type Catalog = { items: EventSummary[]; total: number; page: number; pageCount: number; statusCounts: Record<string, number> };
const PAGE_SIZE = 12;
const statuses = ["ALL", "DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "CANCELLED", "ARCHIVED"];
const labels: Record<string, string> = { ALL: "Semua status", DRAFT: "Draft", PUBLISHED: "Terbit", REGISTRATION_OPEN: "Pendaftaran dibuka", REGISTRATION_CLOSED: "Pendaftaran ditutup", ONGOING: "Berlangsung", COMPLETED: "Selesai", CANCELLED: "Dibatalkan", ARCHIVED: "Arsip" };
const tone = (status: string): StatusVariant => status === "ONGOING" || status === "COMPLETED" ? "success"
  : status === "REGISTRATION_OPEN" || status === "PUBLISHED" ? "info"
    : status === "CANCELLED" ? "danger" : status === "REGISTRATION_CLOSED" ? "warning" : "neutral";
const dateLabel = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00+07:00`));

export const EventListPage: React.FC = () => {
  const { data: identity } = useGetIdentity<AuthIdentity>();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") || 1) || 1);
  const status = statuses.includes(params.get("status") || "") ? params.get("status")! : "ALL";
  const keyword = params.get("search") || "";
  const [search, setSearch] = useState(keyword);
  const [refresh, setRefresh] = useState(0);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyEvent, setBusyEvent] = useState("");

  const changeStatus = async (item: EventSummary) => {
    const action = item.status === "DRAFT" ? "PUBLISH"
      : item.status === "REGISTRATION_OPEN" ? "CLOSE_REGISTRATION" : "OPEN_REGISTRATION";
    setBusyEvent(item.id); setError("");
    try {
      await eventApi(`/events/${item.id}/transition`, { method: "POST", body: JSON.stringify({ action }) });
      setRefresh((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Status event gagal diperbarui."); }
    finally { setBusyEvent(""); }
  };

  const removeEvent = async (item: EventSummary) => {
    if (!window.confirm(`Arsipkan ${item.name} dari katalog aktif? Riwayat peserta, undangan, dan presensi tetap disimpan. Untuk hapus permanen data uji gunakan pembersihan database yang terpisah.`)) return;
    setBusyEvent(item.id); setError("");
    try {
      await eventApi(`/events/${item.id}`, { method: "DELETE" });
      setRefresh((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Event gagal diarsipkan."); }
    finally { setBusyEvent(""); }
  };

  const updateQuery = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => value && value !== "ALL" && !(key === "page" && value === "1") ? next.set(key, value) : next.delete(key));
    setParams(next);
  };

  useEffect(() => { setSearch(keyword); }, [keyword]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search.trim() !== keyword) updateQuery({ search: search.trim(), page: "1" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, keyword]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), status, search: keyword });
    void eventApi<Catalog>(`/events/catalog?${query}`).then((result) => {
      if (active) setCatalog(result);
    }).catch((cause) => {
      if (active) { setCatalog(null); setError(cause instanceof Error ? cause.message : "Daftar event gagal dimuat."); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, status, keyword, refresh]);

  return <AdminLayout>
    <PageHeader title="Kelola Event Daurah" description="Cari event dan buka tindakan yang dibutuhkan tanpa menelusuri kartu besar." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event Daurah" }]} actions={<Link to="/admin/events/create" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Buat Event</Link>} />
    <section aria-label="Ringkasan status event" className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[["Semua", "ALL"], ["Draft", "DRAFT"], ["Pendaftaran", "REGISTRATION_OPEN"], ["Berlangsung", "ONGOING"]].map(([label, filter]) => <button key={filter} type="button" onClick={() => updateQuery({ status: filter, page: "1" })} aria-pressed={status === filter} className={`rounded-lg border p-3 text-left ${status === filter ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}><strong className="text-xl tabular-nums">{catalog ? filter === "ALL" ? Object.values(catalog.statusCounts).reduce((sum, count) => sum + count, 0) : catalog.statusCounts[filter] || 0 : "—"}</strong><span className="mt-1 block text-xs font-bold text-slate-600">{label}</span></button>)}
    </section>
    <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_13rem_auto]">
      <label className="relative"><span className="sr-only">Cari event</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" /><input type="search" value={search} onChange={(change) => setSearch(change.target.value)} placeholder="Nama, kode atau lokasi event" className="min-h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm" /></label>
      <label><span className="sr-only">Filter status</span><select value={status} onChange={(change) => updateQuery({ status: change.target.value, page: "1" })} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">{statuses.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
      <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Segarkan</button>
    </div>
    {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}
    {loading ? <p role="status" className="rounded-lg bg-white p-8 text-sm">Memuat event…</p> : !catalog?.items.length ? <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600"><Calendar className="mx-auto mb-3 h-8 w-8" />{error ? "Coba muat ulang daftar event." : keyword || status !== "ALL" ? "Tidak ada event yang cocok. Coba ubah filter." : "Belum ada event. Buat event pertama untuk memulai."}</div> : <>
      <p className="mb-3 text-xs font-bold text-slate-600">{catalog.total.toLocaleString("id-ID")} event cocok · halaman {catalog.page} dari {catalog.pageCount}</p>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">{catalog.items.map((item) => <li key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:gap-4 sm:p-4">
        <img src={item.posterUrl || DEFAULT_EVENT_POSTER} onError={(event) => { event.currentTarget.src = DEFAULT_EVENT_POSTER; }} alt={item.posterAlt || `Poster ${item.name}`} loading="lazy" style={{ objectPosition: posterObjectPosition(item.posterFocalPoint) }} className="h-28 w-full shrink-0 rounded-lg bg-slate-100 object-cover sm:h-20 sm:w-28" />
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-mono text-[11px] font-bold text-emerald-800">{item.code}</p><Link to={`/admin/events/${item.id}`} className="mt-1 block text-sm font-black leading-5 text-slate-950 hover:text-emerald-800 hover:underline">{item.name}</Link></div><StatusBadge label={labels[item.status] || item.status} variant={tone(item.status)} /></div><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"><span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{dateLabel(item.startDate)}{item.endDate !== item.startDate ? ` – ${dateLabel(item.endDate)}` : ""}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{item.venueName || "Lokasi menyusul"}</span></div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><Link to={`/admin/events/${item.id}`} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-emerald-800 px-3 text-xs font-bold text-white"><Eye className="h-4 w-4" /> Workspace</Link>{identity?.assignments.some((assignment) => assignment.roleCode === "SUPER_ADMIN" || (assignment.roleCode === "EVENT_ADMIN" && assignment.eventId === item.id)) && ["DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(item.status) && <button type="button" disabled={Boolean(busyEvent)} onClick={() => void changeStatus(item)} className="min-h-10 rounded-lg border border-emerald-400 bg-emerald-50 px-3 text-xs font-bold text-emerald-900 disabled:opacity-50">{busyEvent === item.id ? "Memproses…" : item.status === "DRAFT" ? "Terbitkan" : item.status === "REGISTRATION_OPEN" ? "Tutup pendaftaran" : item.status === "REGISTRATION_CLOSED" ? "Buka kembali" : "Buka pendaftaran"}</button>}<Link to={`/admin/events/${item.id}/registrations?view=invitations`} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold"><ClipboardList className="h-4 w-4" /> Undangan</Link><Link to={`/admin/events/${item.id}/registrations?view=participants`} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold"><UserRoundCheck className="h-4 w-4" /> Peserta</Link><EventWhatsAppDialog event={item} />{!["DRAFT", "CANCELLED", "ARCHIVED"].includes(item.status) && <Link to={`/events/${item.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 px-2 text-xs font-bold text-emerald-800">Publik <ExternalLink className="h-4 w-4" /></Link>}{item.status !== "ARCHIVED" && identity?.assignments.some((assignment) => assignment.roleCode === "SUPER_ADMIN") && <button type="button" disabled={Boolean(busyEvent)} onClick={() => void removeEvent(item)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-800 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Hapus dari daftar</button>}</div>
        </div>
      </li>)}</ul>
      <nav aria-label="Halaman daftar event" className="mt-4 flex items-center justify-between gap-3 text-sm"><button type="button" onClick={() => updateQuery({ page: String(page - 1) })} disabled={page <= 1} className="min-h-11 rounded-lg border border-slate-300 px-3 disabled:opacity-50">Sebelumnya</button><span>Halaman {catalog.page} / {catalog.pageCount}</span><button type="button" onClick={() => updateQuery({ page: String(page + 1) })} disabled={page >= catalog.pageCount} className="min-h-11 rounded-lg border border-slate-300 px-3 disabled:opacity-50">Berikutnya</button></nav>
    </>}
  </AdminLayout>;
};
