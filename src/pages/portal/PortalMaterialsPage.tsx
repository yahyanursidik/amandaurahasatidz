import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Check, Search } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { MaterialKindFilter, MaterialKindIcon, MaterialPreview, materialField, materialPrimary, materialSecondary,
  type MaterialKindFilterValue } from "@/components/common/MaterialPreview";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { eventApi } from "@/lib/eventApi";
import { materialKindLabel, matchesMaterialSearch, type PortalMaterial, type PortalMaterialGroup } from "@/lib/eventMaterial";
import { formatEventDate } from "@/lib/eventDateTime";

type CompletionFilter = "ALL" | "TODO" | "DONE";

export function PortalMaterialsPage() {
  const [params, setParams] = useSearchParams();
  const eventFilter = params.get("event") ?? "";
  const sessionFilter = params.get("session") ?? "";
  const [groups, setGroups] = useState<PortalMaterialGroup[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<MaterialKindFilterValue>("ALL");
  const [progressFilter, setProgressFilter] = useState<CompletionFilter>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void eventApi<PortalMaterialGroup[]>("/portal/materials", { cache: "no-store", signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setGroups(data);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Daftar materi gagal dimuat.");
    });
    return () => controller.abort();
  }, [revision]);

  const changeEvent = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set("event", id);
    else next.delete("event");
    next.delete("session");
    setParams(next);
    setOpenId(null);
  };

  const changeCompletion = async (item: PortalMaterial) => {
    setSavingId(item.id);
    setProgressError(null);
    try {
      const saved = await eventApi<{ id: string; completedAt: string | null }>(`/portal/materials/${item.id}/completion`, {
        method: "PUT", body: JSON.stringify({ completed: !item.completedAt }),
      });
      setGroups((current) => current && current.map((group) => ({ ...group, materials: group.materials.map((entry) =>
        entry.id === saved.id ? { ...entry, completedAt: saved.completedAt } : entry) })));
    } catch (cause) {
      setProgressError({ id: item.id, message: cause instanceof Error ? cause.message : "Status belajar gagal disimpan." });
    } finally {
      setSavingId(null);
    }
  };

  const allMaterials = groups?.flatMap((group) => group.materials) ?? [];
  const sessionName = allMaterials.find((item) => item.session?.id === sessionFilter)?.session?.title;
  const visibleGroups = groups?.flatMap((group) => {
    if (eventFilter && group.id !== eventFilter) return [];
    const materials = group.materials.filter((item) =>
      (!sessionFilter || item.session?.id === sessionFilter) &&
      (kind === "ALL" || item.kind === kind) &&
      (progressFilter === "ALL" || Boolean(item.completedAt) === (progressFilter === "DONE")) &&
      matchesMaterialSearch(item, query, group.name));
    const completed = group.materials.filter((item) => item.completedAt).length;
    return materials.length ? [{ ...group, materials, completed, total: group.materials.length }] : [];
  }) ?? [];
  const filtering = !!eventFilter || !!sessionFilter || !!query.trim() || kind !== "ALL" || progressFilter !== "ALL";

  return (
    <PortalLayout>
      <PageHeader title="Materi & Rekaman" />
      {error && <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
        <p role="alert">{error}</p>
        <button type="button" className={`${materialSecondary} mt-3`} onClick={() => setRevision((n) => n + 1)}>Muat ulang</button>
      </div>}
      {!error && groups === null && <p role="status" className="text-sm text-slate-700">Memuat materi…</p>}
      {groups && <div className="max-w-5xl space-y-5">
        {groups.length > 0 && <section className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_10rem]">
          <label className="min-w-0 text-sm font-semibold text-slate-800">
            Cari materi
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-600" aria-hidden="true" />
              <input type="search" className={`${materialField} pl-9`} placeholder="Judul, sesi, atau event" value={query}
                onChange={(event) => setQuery(event.target.value)} />
            </span>
          </label>
          <label className="min-w-0 text-sm font-semibold text-slate-800">
            Event
            <select className={`${materialField} mt-1`} value={eventFilter} onChange={(event) => changeEvent(event.target.value)}>
              <option value="">Semua event</option>
              {eventFilter && !groups.some((group) => group.id === eventFilter) && <option value={eventFilter}>Event terpilih</option>}
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Status belajar
            <select className={`${materialField} mt-1`} value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as CompletionFilter)}>
              <option value="ALL">Semua status</option>
              <option value="TODO">Belum selesai</option>
              <option value="DONE">Selesai</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2 xl:col-span-3">
            <MaterialKindFilter value={kind} onChange={setKind} />
            {sessionFilter && <button type="button" className={materialSecondary}
              onClick={() => changeEvent(eventFilter)}>{sessionName ? "Hapus filter sesi" : "Lihat semua sesi"}</button>}
          </div>
          {sessionName && <p className="text-sm font-semibold text-slate-700 [overflow-wrap:anywhere] md:col-span-2">Sesi {sessionName}</p>}
        </section>}

        {visibleGroups.length === 0 && <section className="rounded-xl border border-slate-200 bg-white p-5 text-slate-800">
          <BookOpen className="mb-2 h-6 w-6 text-emerald-800" aria-hidden="true" />
          <h2 className="font-bold">{filtering ? "Materi belum ditemukan" : "Belum ada materi yang dibagikan"}</h2>
          {filtering && <button type="button" className={`${materialSecondary} mt-3`} onClick={() => {
            changeEvent(""); setKind("ALL"); setQuery(""); setProgressFilter("ALL");
          }}>Lihat semua materi</button>}
        </section>}

        {visibleGroups.map((group) => <section key={group.id} aria-labelledby={`materials-event-${group.id}`}
          className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-emerald-100 bg-emerald-50 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id={`materials-event-${group.id}`} className="text-lg font-bold text-emerald-950 [overflow-wrap:anywhere]">{group.name}</h2>
              <p className="mt-1 text-sm text-emerald-900">
                {formatEventDate(group.startDate)}{group.startDate !== group.endDate ? ` – ${formatEventDate(group.endDate)}` : ""}
              </p>
            </div>
            <div className="text-sm text-emerald-950">
              <p>{group.completed} / {group.total} selesai</p>
              <progress className="block h-2 w-24 accent-emerald-800" aria-label={`Kemajuan ${group.name}`} value={group.completed} max={group.total} />
            </div>
          </header>
          <ul className="divide-y divide-slate-200">
            {group.materials.map((item) => {
              const open = openId === item.id;
              const panelId = `materi-${item.id}`;
              const completed = !!item.completedAt;
              return <li key={item.id} className="px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 basis-48 items-start gap-3">
                    <MaterialKindIcon kind={item.kind} />
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-950 [overflow-wrap:anywhere]">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-700 [overflow-wrap:anywhere]">
                        {materialKindLabel[item.kind]}{item.session ? ` · ${item.session.title}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.sources.length > 0 && <button type="button" className={materialPrimary} aria-expanded={open} aria-controls={panelId}
                      aria-label={`${open ? "Tutup" : item.kind === "PDF" ? "Baca" : "Tonton"} ${item.title}`}
                      onClick={() => setOpenId(open ? null : item.id)}>
                      {open ? "Tutup" : item.kind === "PDF" ? "Baca PDF" : "Tonton"}
                    </button>}
                    <button type="button" className={materialSecondary} aria-pressed={completed}
                      aria-label={`${completed ? "Batalkan selesai" : "Tandai selesai"} ${item.title}`}
                      disabled={!!savingId} onClick={() => void changeCompletion(item)}>
                      {completed && <Check className="h-4 w-4" aria-hidden="true" />}
                      {savingId === item.id ? "Menyimpan…" : completed ? "Selesai" : "Tandai selesai"}
                    </button>
                  </div>
                </div>
                {!item.sources.length && <p className="mt-2 text-sm text-slate-700">Tautan materi belum tersedia.</p>}
                {progressError?.id === item.id && <p role="alert" className="mt-2 text-sm font-semibold text-rose-800">{progressError.message}</p>}
                <div id={panelId} className={open ? "mt-4 rounded-xl bg-slate-50 p-3 sm:p-4" : undefined}>
                  {open && <MaterialPreview kind={item.kind} sources={item.sources} title={item.title} pdfPreviewPath={`/portal/materials/${item.id}/pdf-preview`} />}
                </div>
              </li>;
            })}
          </ul>
        </section>)}
      </div>}
    </PortalLayout>
  );
}
