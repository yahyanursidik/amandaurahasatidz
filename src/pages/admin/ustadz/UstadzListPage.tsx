import React, { useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Download,
  Edit3,
  Eye,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  RotateCcw,
  CalendarCheck2,
  UserCheck,
  UsersRound,
  MessageCircle,
} from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { UstadzWorkspaceNav } from "@/components/admin/ustadz/UstadzWorkspaceNav";
import { UstadzProfile, UstadzSummary, ustadzApi } from "@/lib/ustadzApi";
import { AuthIdentity } from "@/lib/refine/authProvider";
import { canManageUstadz, canMergeUstadz } from "@/lib/ustadzPermissions";
import { ustadzPreviewProfiles } from "@/lib/ustadzPreview";
import { updateUstadzDirectoryQuery } from "@/lib/ustadzDirectoryQuery";
import { ParticipantCommunicationPanel } from "@/components/communications/ParticipantCommunicationPanel";
import { canAccessYtsNotes } from "@/lib/ustadzNotes";
import { useYtsNoteSummaries, YtsNoteDirectoryBadge, YtsNoteLegend } from "@/components/admin/ustadz/YtsNotesPanel";

const PAGE_SIZE = 25;

const statusLabel = (status: UstadzProfile["profileStatus"]) =>
  status === "ACTIVE" ? "Aktif" : status === "INACTIVE" ? "Nonaktif" : "Digabungkan";

const escapeCsv = (value: string | number | null | undefined) => {
  const cell = String(value ?? "");
  return `"${(/^[\s\u0000-\u001f]*[=+@-]/.test(cell) ? `'${cell}` : cell).replace(/"/g, '""')}"`;
};

export const UstadzListPage: React.FC = () => {
  const { data: identity } = useGetIdentity<AuthIdentity>();
  const canManage = canManageUstadz(identity?.assignments);
  const canMerge = canMergeUstadz(identity?.assignments);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [profiles, setProfiles] = useState<UstadzProfile[]>([]);
  const [summary, setSummary] = useState<UstadzSummary>({
    total: 0,
    active: 0,
    inactive: 0,
    merged: 0,
    incomplete: 0,
    duplicateCandidates: 0,
  });
  const [pageCount, setPageCount] = useState(1);
  const [resultTotal, setResultTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [reload, setReload] = useState(0);

  const toggleArchive = async (profile: UstadzProfile) => {
    const archived = Boolean(profile.deletedAt);
    if (!archived && !window.confirm(`Hapus ${profile.fullName} dari direktori aktif? Profil akan diarsipkan; riwayat keikutsertaan dan kehadiran tetap ada dan bisa dipulihkan.`)) return;
    setBusyId(profile.id); setError(""); setNotice("");
    try {
      const result = archived ? await ustadzApi.restore(profile.id) : await ustadzApi.archive(profile.id);
      setNotice(result.message);
      if (profiles.length === 1 && page > 1) updateFilter("page", String(page - 1));
      else setReload((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Status profil gagal diubah."); }
    finally { setBusyId(""); }
  };

  const requestedPage = Number(searchParams.get("page") || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const profileStatus = searchParams.get("profileStatus") || "ALL";
  const incompleteOnly = searchParams.get("quality") === "incomplete";
  const duplicateOnly = searchParams.get("duplicate") === "true";
  const attendedOnly = searchParams.get("participation") === "attended";
  const institutionId = searchParams.get("institutionId") || "";
  const committedSearch = searchParams.get("search") || "";

  useEffect(() => {
    // Changing page must not be interpreted as a new search.
    if (search.trim() === committedSearch) return;
    const timer = window.setTimeout(() => {
      setSearchParams((previous) => {
        if (search.trim() === (previous.get("search") || "")) return previous;
        return updateUstadzDirectoryQuery(previous, "search", search.trim());
      }, { replace: true });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, committedSearch, setSearchParams]);

  useEffect(() => { setSearch(committedSearch); }, [committedSearch]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    const query = committedSearch;
    if (query) params.set("search", query);
    if (profileStatus !== "ALL") params.set("profileStatus", profileStatus);
    if (incompleteOnly) params.set("quality", "incomplete");
    if (duplicateOnly) params.set("duplicate", "true");
    if (attendedOnly) params.set("participation", "attended");
    if (institutionId) params.set("institutionId", institutionId);

    setLoading(true);
    setError("");
    void Promise.resolve().then(() => active ? ustadzApi.list(params, { signal: controller.signal }) : null)
      .then((response) => {
        if (!active || !response) return;
        if (response.meta?.pageCount && page > response.meta.pageCount) {
          setSearchParams((previous) => updateUstadzDirectoryQuery(previous, "page", String(response.meta!.pageCount)), { replace: true });
          return;
        }
        setProfiles(response.data);
        setSummary(
          response.meta?.summary || {
            total: response.meta?.total ?? response.data.length,
            active: response.data.filter((item) => item.profileStatus === "ACTIVE").length,
            inactive: response.data.filter((item) => item.profileStatus === "INACTIVE").length,
            merged: response.data.filter((item) => item.profileStatus === "MERGED").length,
            incomplete: response.data.filter((item) => (item.completenessPercent || 0) < 70).length,
            duplicateCandidates: response.data.filter((item) => item.hasDuplicateAlert).length,
          },
        );
        setPageCount(response.meta?.pageCount || 1);
        setResultTotal(response.meta?.total ?? response.data.length);
        setPreview(false);
      })
      .catch((loadError) => {
        if (!active) return;
        if (import.meta.env.DEV) {
          const queryLower = (searchParams.get("search") || "").toLowerCase();
          const fallback = ustadzPreviewProfiles.filter(
            (item) =>
              (!queryLower ||
                item.fullName.toLowerCase().includes(queryLower) ||
                (item.email || "").toLowerCase().includes(queryLower) ||
                (item.phone || "").includes(queryLower)) &&
              (profileStatus === "ALL" || item.profileStatus === profileStatus) &&
              (!incompleteOnly || (item.completenessPercent || 0) < 70) &&
              (!duplicateOnly || item.hasDuplicateAlert) &&
              (!attendedOnly || (item.participationStats?.attended || 0) > 0) &&
              (!institutionId || item.primaryInstitution?.institutionId === institutionId),
          );
          setProfiles(fallback);
          setResultTotal(fallback.length);
          setSummary({
            total: ustadzPreviewProfiles.length,
            active: ustadzPreviewProfiles.filter((item) => item.profileStatus === "ACTIVE").length,
            inactive: ustadzPreviewProfiles.filter((item) => item.profileStatus === "INACTIVE").length,
            merged: ustadzPreviewProfiles.filter((item) => (item.profileStatus === "MERGED")).length,
            incomplete: ustadzPreviewProfiles.filter((item) => (item.completenessPercent || 0) < 70).length,
            duplicateCandidates: ustadzPreviewProfiles.filter((item) => item.hasDuplicateAlert).length,
            attended: ustadzPreviewProfiles.filter((item) => (item.participationStats?.attended || 0) > 0).length,
          });
        } else {
          setProfiles([]);
          setResultTotal(0);
          setSummary({ total: 0, active: 0, inactive: 0, merged: 0, incomplete: 0, duplicateCandidates: 0 });
        }
        setPageCount(1);
        setPreview(import.meta.env.DEV);
        setError(loadError instanceof Error ? loadError.message : "Koneksi database belum tersedia.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, profileStatus, incompleteOnly, duplicateOnly, attendedOnly, institutionId, committedSearch, reload]);

  const visibleProfiles = profiles;

  const canReadNotes = canAccessYtsNotes(identity?.assignments ?? []);
  const noteSummaries = useYtsNoteSummaries(visibleProfiles.map(profile => profile.id), canReadNotes && !loading && !preview);

  const metrics = [
    { label: "Total profil", value: summary.total, hint: "Di luar arsip", icon: UsersRound },
    { label: "Profil aktif", value: summary.active, hint: "Siap dipakai lintas modul", icon: UserCheck },
    {
      label: "Perlu dilengkapi",
      value: summary.incomplete,
      hint: "Kelengkapan di bawah 70%",
      icon: AlertTriangle,
    },
    { label: "Pernah hadir", value: summary.attended || 0, hint: "Minimal satu presensi", icon: CalendarCheck2 },
  ];

  const updateFilter = (key: string, value: string) => {
    setSearchParams((current) => updateUstadzDirectoryQuery(current, key, value));
  };

  const exportCsv = () => {
    const rows = [
      ["Nama", "Status", "Email", "Telepon", "WhatsApp", "Afiliasi utama", "Jumlah afiliasi", "Kelengkapan"],
      ...profiles.map((profile) => [
        profile.fullName,
        statusLabel(profile.profileStatus),
        profile.email || "",
        profile.phone || "",
        profile.whatsapp || "",
        profile.primaryInstitution?.institutionName || "",
        profile.affiliationCount || 0,
        `${profile.completenessPercent || 0}%`,
      ]),
    ];
    const content = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `asatidz-halaman-${page}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="ustadz-workspace">
        <PageHeader
          title="Direktori asatidz"
          description="Satu sumber profil untuk undangan lembaga, peserta individu, afiliasi, dan riwayat kehadiran."
          breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Asatidz" }]}
          actions={
            <div className="ustadz-page-actions">
              <button type="button" className="ustadz-button ustadz-button--secondary" onClick={exportCsv} disabled={loading || profiles.length === 0}>
                <Download aria-hidden="true" />
                <span>Ekspor halaman ini</span>
              </button>
              {canManage && <Link to="/admin/ustadz/whatsapp" className="ustadz-button ustadz-button--secondary">
                <MessageCircle aria-hidden="true" />
                <span>Hubungi bertahap</span>
              </Link>}
                {canManage && <Link to="/admin/ustadz/create" className="ustadz-button ustadz-button--primary">
                  <Plus aria-hidden="true" />
                  <span>Tambah profil</span>
                </Link>}
            </div>
          }
        />
        <UstadzWorkspaceNav />
        {canReadNotes && !preview && <details className="mb-4 rounded-lg border border-slate-200 bg-white p-3 text-sm"><summary className="min-h-11 cursor-pointer content-center font-semibold text-slate-700">Arti penanda koordinasi internal</summary><div className="pt-3"><YtsNoteLegend /></div></details>}
        {noteSummaries.error && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{noteSummaries.error} <button className="underline" onClick={noteSummaries.retry}>Coba muat penanda YTS</button></div>}

        {preview && (
          <div className="ustadz-preview-notice" role="status">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>Mode pratinjau aktif</strong>
              <span>{error} Data contoh ditampilkan agar seluruh navigasi tetap dapat dicoba.</span>
            </div>
          </div>
        )}
        {notice && <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}
        {!preview && error && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</div>}

        <section className="ustadz-metrics" aria-label="Ringkasan direktori asatidz">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article key={metric.label}>
                <Icon aria-hidden="true" />
                <div>
                  <span>{metric.label}</span>
                  <strong>{loading ? "—" : metric.value.toLocaleString("id-ID")}</strong>
                  <small>{metric.hint}</small>
                </div>
              </article>
            );
          })}
        </section>

        <section className="ustadz-ledger" aria-labelledby="ustadz-ledger-heading">
          <div className="ustadz-ledger__heading">
            <div>
              <p>Data asatidz</p>
              <h2 id="ustadz-ledger-heading">
                {incompleteOnly
                  ? "Profil yang perlu dilengkapi"
                  : duplicateOnly
                    ? "Profil dengan potensi duplikat"
                    : attendedOnly
                      ? "Asatidz yang pernah hadir"
                    : profileStatus === "INACTIVE"
                      ? "Profil nonaktif"
                      : profileStatus === "ARCHIVED"
                        ? "Profil diarsipkan"
                      : "Seluruh profil"}
              </h2>
            </div>
            <span>{resultTotal.toLocaleString("id-ID")} profil sesuai filter</span>
          </div>

          <div className="ustadz-ledger__toolbar">
            <label className="ustadz-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Cari profil</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, email, atau nomor telepon"
              />
            </label>
            <label className="ustadz-filter">
              <span>Status profil</span>
              <select value={profileStatus} onChange={(event) => updateFilter("profileStatus", event.target.value)}>
                <option value="ALL">Semua status</option>
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
                        <option value="MERGED">Digabungkan</option>
                        <option value="ARCHIVED">Arsip (dihapus dari daftar aktif)</option>
              </select>
            </label>
          </div>
          {(institutionId || incompleteOnly || duplicateOnly || attendedOnly) && <div className="ustadz-active-filters" aria-label="Filter aktif">
            {institutionId && <span>Lembaga tertentu <button type="button" onClick={() => updateFilter("institutionId", "")}>Hapus filter</button></span>}
            {incompleteOnly && <span>Perlu dilengkapi <button type="button" onClick={() => updateFilter("quality", "")}>Hapus filter</button></span>}
            {duplicateOnly && <span>Potensi duplikat <button type="button" onClick={() => updateFilter("duplicate", "")}>Hapus filter</button></span>}
            {attendedOnly && <span>Pernah hadir <button type="button" onClick={() => updateFilter("participation", "")}>Hapus filter</button></span>}
          </div>}

          {loading ? (
            <div className="ustadz-loading" role="status">Memuat direktori asatidz…</div>
          ) : visibleProfiles.length === 0 ? (
            <EmptyState
              title="Belum ada profil pada tampilan ini"
              description={canManage ? "Ubah filter atau tambahkan profil asatidz baru." : "Ubah pencarian atau filter untuk melihat profil lain."}
            />
          ) : (
            <>
              <div className="ustadz-table-wrap">
                <table className="ustadz-table">
                  <thead>
                    <tr>
                      <th>Asatidz</th>
                      <th>Afiliasi</th>
                      <th>Kontak</th>
                      <th>Kualitas data</th>
                      <th>Status</th>
                      <th><span className="sr-only">Aksi</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProfiles.map((profile) => (
                      <tr key={profile.id}>
                        <td>
                          <div className="ustadz-person">
                            <strong><Link to={`/admin/ustadz/${profile.id}`}>{profile.fullName}</Link></strong>
                            <span>ID {profile.id.slice(0, 8)}</span>
                            {canReadNotes && !preview && <YtsNoteDirectoryBadge id={profile.id} summary={noteSummaries.byId[profile.id]} loading={noteSummaries.loading} error={noteSummaries.error} />}
                            {profile.hasDuplicateAlert && (
                              <Link to={canMerge ? `/admin/ustadz/merge?source=${profile.id}` : `/admin/ustadz/${profile.id}?tab=quality`}>
                                <AlertTriangle aria-hidden="true" /> Tinjau duplikat
                              </Link>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="ustadz-affiliation">
                            <Building2 aria-hidden="true" />
                            <div>
                              <strong>{profile.primaryInstitution?.institutionName || "Belum ada afiliasi utama"}</strong>
                              <span>
                                {profile.affiliationCount || 0} afiliasi
                                {profile.primaryInstitution?.position ? ` · ${profile.primaryInstitution.position}` : ""}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="ustadz-contact">
                            <span><Mail aria-hidden="true" /> {profile.email || "Email belum tersedia"}</span>
                            <span><Phone aria-hidden="true" /> {profile.phone || profile.whatsapp || "Telepon belum tersedia"}</span>
                          </div>
                        </td>
                        <td>
                          <div className="ustadz-quality">
                            <div><span>Kelengkapan</span><strong>{profile.completenessPercent || 0}%</strong></div>
                            <progress max={100} value={profile.completenessPercent || 0}>
                              {profile.completenessPercent || 0}%
                            </progress>
                          </div>
                        </td>
                        <td>
                          <span className="ustadz-status" data-status={profile.deletedAt ? "ARCHIVED" : profile.profileStatus}>
                            {profile.deletedAt ? "Diarsipkan" : statusLabel(profile.profileStatus)}
                          </span>
                        </td>
                        <td>
                          <div className="ustadz-row-actions">
                            <ParticipantCommunicationPanel compact disabled={preview} senderRole="admin" initialTemplate="PROFILE_GREETING" participant={{ id: profile.id, name: profile.fullName, email: profile.email, phone: profile.phone, whatsapp: profile.whatsapp, address: profile.address, institutionName: profile.primaryInstitution?.institutionName }} />
                            <Link to={`/admin/ustadz/${profile.id}`} aria-label={`Lihat ${profile.fullName}`}>
                              <Eye aria-hidden="true" />
                            </Link>
                            {canManage && !profile.deletedAt && <Link to={`/admin/ustadz/${profile.id}/edit`} aria-label={`Edit ${profile.fullName}`}>
                              <Edit3 aria-hidden="true" />
                            </Link>}
                            {canManage && <button type="button" onClick={() => void toggleArchive(profile)} disabled={preview || Boolean(busyId)} aria-label={`${profile.deletedAt ? "Pulihkan" : "Arsipkan"} profil ${profile.fullName}`} title={profile.deletedAt ? "Pulihkan ke direktori" : "Hapus dari direktori aktif (riwayat tersimpan)"} className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 text-rose-700 disabled:opacity-50">{profile.deletedAt ? <RotateCcw aria-hidden="true" /> : <Trash2 aria-hidden="true" />}</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ustadz-mobile-list">
                {visibleProfiles.map((profile) => (
                  <article key={profile.id} className="ustadz-card">
                    <div className="ustadz-card__head">
                      <div>
                        <strong><Link to={`/admin/ustadz/${profile.id}`}>{profile.fullName}</Link></strong>
                        <span>{profile.primaryInstitution?.institutionName || "Belum ada afiliasi utama"}</span>
                        {canReadNotes && !preview && <YtsNoteDirectoryBadge id={profile.id} summary={noteSummaries.byId[profile.id]} loading={noteSummaries.loading} error={noteSummaries.error} />}
                      </div>
                      <span className="ustadz-status" data-status={profile.deletedAt ? "ARCHIVED" : profile.profileStatus}>
                        {profile.deletedAt ? "Diarsipkan" : statusLabel(profile.profileStatus)}
                      </span>
                    </div>
                    <div className="ustadz-quality">
                      <div><span>Kelengkapan profil</span><strong>{profile.completenessPercent || 0}%</strong></div>
                      <progress max={100} value={profile.completenessPercent || 0} />
                    </div>
                    <div className="ustadz-card__meta">
                      <span><Mail aria-hidden="true" /> {profile.email || "Belum ada email"}</span>
                      <span><Phone aria-hidden="true" /> {profile.phone || profile.whatsapp || "Belum ada telepon"}</span>
                    </div>
                    {profile.hasDuplicateAlert && (
                      <Link className="ustadz-card__warning" to={canMerge ? `/admin/ustadz/merge?source=${profile.id}` : `/admin/ustadz/${profile.id}?tab=quality`}>
                        <AlertTriangle aria-hidden="true" /> Ada profil serupa—tinjau sebelum digunakan
                      </Link>
                    )}
                    <div className="ustadz-card__actions">
                      <ParticipantCommunicationPanel disabled={preview} senderRole="admin" initialTemplate="PROFILE_GREETING" participant={{ id: profile.id, name: profile.fullName, email: profile.email, phone: profile.phone, whatsapp: profile.whatsapp, address: profile.address, institutionName: profile.primaryInstitution?.institutionName }} />
                      <Link to={`/admin/ustadz/${profile.id}`}>Lihat detail</Link>
                      {canManage && !profile.deletedAt && <Link to={`/admin/ustadz/${profile.id}/edit`}>Edit profil</Link>}
                      {canManage && <button type="button" onClick={() => void toggleArchive(profile)} disabled={preview || Boolean(busyId)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-rose-200 px-3 text-sm font-bold text-rose-700 disabled:opacity-50">{profile.deletedAt ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}{profile.deletedAt ? "Pulihkan" : "Hapus dari daftar"}</button>}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {pageCount > 1 && (
            <nav className="ustadz-pagination" aria-label="Paginasi direktori">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => updateFilter("page", String(page - 1))}
              >
                <ArrowLeft aria-hidden="true" /> Sebelumnya
              </button>
              <span>Halaman {page} dari {pageCount} · {resultTotal.toLocaleString("id-ID")} profil sesuai filter</span>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => updateFilter("page", String(page + 1))}
              >
                Berikutnya <ArrowRight aria-hidden="true" />
              </button>
            </nav>
          )}
        </section>
      </div>
    </AdminLayout>
  );
};
