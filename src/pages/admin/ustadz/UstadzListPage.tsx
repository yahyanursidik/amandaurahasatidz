import React, { useEffect, useMemo, useState } from "react";
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
  UserCheck,
  UsersRound,
} from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { UstadzWorkspaceNav } from "@/components/admin/ustadz/UstadzWorkspaceNav";
import { UstadzProfile, UstadzSummary, ustadzApi } from "@/lib/ustadzApi";
import { ustadzPreviewProfiles } from "@/lib/ustadzPreview";

const PAGE_SIZE = 25;

const statusLabel = (status: UstadzProfile["profileStatus"]) =>
  status === "ACTIVE" ? "Aktif" : status === "INACTIVE" ? "Nonaktif" : "Digabungkan";

const escapeCsv = (value: string | number | null | undefined) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

export const UstadzListPage: React.FC = () => {
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
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");

  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const profileStatus = searchParams.get("profileStatus") || "ALL";
  const incompleteOnly = searchParams.get("quality") === "incomplete";
  const duplicateOnly = searchParams.get("duplicate") === "true";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (search.trim()) next.set("search", search.trim());
      else next.delete("search");
      next.delete("page");
      if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, searchParams, setSearchParams]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    const query = searchParams.get("search");
    if (query) params.set("search", query);
    if (profileStatus !== "ALL") params.set("profileStatus", profileStatus);

    setLoading(true);
    setError("");
    ustadzApi
      .list(params)
      .then((response) => {
        if (!active) return;
        setProfiles(response.data);
        setSummary(
          response.meta?.summary || {
            total: response.meta?.total || response.data.length,
            active: response.data.filter((item) => item.profileStatus === "ACTIVE").length,
            inactive: response.data.filter((item) => item.profileStatus === "INACTIVE").length,
            merged: response.data.filter((item) => item.profileStatus === "MERGED").length,
            incomplete: response.data.filter((item) => (item.completenessPercent || 0) < 70).length,
            duplicateCandidates: response.data.filter((item) => item.hasDuplicateAlert).length,
          },
        );
        setPageCount(response.meta?.pageCount || 1);
        setPreview(false);
      })
      .catch((loadError) => {
        if (!active) return;
        const queryLower = (searchParams.get("search") || "").toLowerCase();
        let fallback = ustadzPreviewProfiles.filter(
          (item) =>
            (!queryLower ||
              item.fullName.toLowerCase().includes(queryLower) ||
              (item.email || "").toLowerCase().includes(queryLower) ||
              (item.phone || "").includes(queryLower)) &&
            (profileStatus === "ALL" || item.profileStatus === profileStatus),
        );
        setProfiles(fallback);
        setSummary({
          total: ustadzPreviewProfiles.length,
          active: ustadzPreviewProfiles.filter((item) => item.profileStatus === "ACTIVE").length,
          inactive: ustadzPreviewProfiles.filter((item) => item.profileStatus === "INACTIVE").length,
          merged: ustadzPreviewProfiles.filter((item) => item.profileStatus === "MERGED").length,
          incomplete: ustadzPreviewProfiles.filter((item) => (item.completenessPercent || 0) < 70).length,
          duplicateCandidates: ustadzPreviewProfiles.filter((item) => item.hasDuplicateAlert).length,
        });
        setPageCount(1);
        setPreview(true);
        setError(loadError instanceof Error ? loadError.message : "Koneksi database belum tersedia.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, profileStatus, searchParams]);

  const visibleProfiles = useMemo(
    () =>
      profiles.filter(
        (profile) =>
          (!incompleteOnly || (profile.completenessPercent || 0) < 70) &&
          (!duplicateOnly || profile.hasDuplicateAlert),
      ),
    [duplicateOnly, incompleteOnly, profiles],
  );

  const metrics = [
    { label: "Total profil", value: summary.total, hint: "Seluruh status", icon: UsersRound },
    { label: "Profil aktif", value: summary.active, hint: "Siap dipakai lintas modul", icon: UserCheck },
    {
      label: "Perlu dilengkapi",
      value: summary.incomplete,
      hint: "Kelengkapan di bawah 70%",
      icon: AlertTriangle,
    },
    {
      label: "Potensi duplikat",
      value: summary.duplicateCandidates,
      hint: "Perlu ditinjau admin",
      icon: Search,
    },
  ];

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "ALL") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    setSearchParams(next);
  };

  const exportCsv = () => {
    const rows = [
      ["Nama", "Status", "Email", "Telepon", "WhatsApp", "Afiliasi utama", "Jumlah afiliasi", "Kelengkapan"],
      ...visibleProfiles.map((profile) => [
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
    anchor.download = `direktori-asatidz-${new Date().toISOString().slice(0, 10)}.csv`;
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
              <button type="button" className="ustadz-button ustadz-button--secondary" onClick={exportCsv}>
                <Download aria-hidden="true" />
                <span>Ekspor CSV</span>
              </button>
              <Link to="/admin/ustadz/create" className="ustadz-button ustadz-button--primary">
                <Plus aria-hidden="true" />
                <span>Tambah profil</span>
              </Link>
            </div>
          }
        />
        <UstadzWorkspaceNav />

        {preview && (
          <div className="ustadz-preview-notice" role="status">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>Mode pratinjau aktif</strong>
              <span>{error} Data contoh ditampilkan agar seluruh navigasi tetap dapat dicoba.</span>
            </div>
          </div>
        )}

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
              <p>Registry operasional</p>
              <h2 id="ustadz-ledger-heading">
                {incompleteOnly
                  ? "Profil yang perlu dilengkapi"
                  : duplicateOnly
                    ? "Profil dengan potensi duplikat"
                    : profileStatus === "INACTIVE"
                      ? "Profil nonaktif"
                      : "Seluruh profil"}
              </h2>
            </div>
            <span>{visibleProfiles.length} data pada tampilan ini</span>
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
              </select>
            </label>
          </div>

          {loading ? (
            <div className="ustadz-loading" role="status">Memuat direktori asatidz…</div>
          ) : visibleProfiles.length === 0 ? (
            <EmptyState
              title="Belum ada profil pada tampilan ini"
              description="Ubah filter atau tambahkan profil asatidz baru."
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
                            <strong>{profile.fullName}</strong>
                            <span>ID {profile.id.slice(0, 8)}</span>
                            {profile.hasDuplicateAlert && (
                              <Link to={`/admin/ustadz/merge?source=${profile.id}`}>
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
                          <span className="ustadz-status" data-status={profile.profileStatus}>
                            {statusLabel(profile.profileStatus)}
                          </span>
                        </td>
                        <td>
                          <div className="ustadz-row-actions">
                            <Link to={`/admin/ustadz/${profile.id}`} aria-label={`Lihat ${profile.fullName}`}>
                              <Eye aria-hidden="true" />
                            </Link>
                            <Link to={`/admin/ustadz/${profile.id}/edit`} aria-label={`Edit ${profile.fullName}`}>
                              <Edit3 aria-hidden="true" />
                            </Link>
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
                        <strong>{profile.fullName}</strong>
                        <span>{profile.primaryInstitution?.institutionName || "Belum ada afiliasi utama"}</span>
                      </div>
                      <span className="ustadz-status" data-status={profile.profileStatus}>
                        {statusLabel(profile.profileStatus)}
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
                      <Link className="ustadz-card__warning" to={`/admin/ustadz/merge?source=${profile.id}`}>
                        <AlertTriangle aria-hidden="true" /> Ada profil serupa—tinjau sebelum digunakan
                      </Link>
                    )}
                    <div className="ustadz-card__actions">
                      <Link to={`/admin/ustadz/${profile.id}`}>Lihat detail</Link>
                      <Link to={`/admin/ustadz/${profile.id}/edit`}>Edit profil</Link>
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
              <span>Halaman {page} dari {pageCount}</span>
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
