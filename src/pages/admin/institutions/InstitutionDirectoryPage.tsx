/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
 * macrostructure: Catalogue · tone: utilitarian · anchor hue: emerald
 * F3 knobs: columns=4, rules=every-row, numbers=tabular · nav: N3 · footer: Ft4
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { InstitutionWorkspaceNav } from "@/components/admin/institutions/InstitutionWorkspaceNav";
import { Institution, institutionApi } from "@/lib/institutionApi";
import { Building2, CircleAlert, Download, Edit3, Eye, Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";

export const InstitutionDirectoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [items, setItems] = useState<Institution[]>([]);
  const [summary, setSummary] = useState<Array<{ status: string; verificationStatus: string; total: number }>>([]);
  const [meta, setMeta] = useState({ page: 1, pageCount: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reloadKey = searchParams.toString();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (search.trim()) params.set("search", search.trim()); else params.delete("search");
      params.set("pageSize", "25");
      setLoading(true);
      institutionApi.list(params)
        .then((result) => {
          setItems(result.data);
          setSummary(result.meta?.summary || []);
          setMeta({
            page: result.meta?.page || 1,
            pageCount: result.meta?.pageCount || 1,
            total: result.meta?.total || result.data.length,
          });
          setError("");
        })
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Data lembaga gagal dimuat."))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [reloadKey, search]);

  const totals = useMemo(() => {
    const total = summary.reduce((acc, row) => acc + Number(row.total), 0);
    const verified = summary.filter((row) => row.verificationStatus === "VERIFIED").reduce((acc, row) => acc + Number(row.total), 0);
    const pending = summary.filter((row) => row.verificationStatus === "UNVERIFIED").reduce((acc, row) => acc + Number(row.total), 0);
    const inactive = summary.filter((row) => row.status === "INACTIVE").reduce((acc, row) => acc + Number(row.total), 0);
    return { total, verified, pending, inactive };
  }, [summary]);

  const updateFilter = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "ALL") next.delete(name); else next.set(name, value);
    if (name !== "page") next.delete("page");
    setSearchParams(next);
  };

  const exportCsv = () => {
    const rows = [["Kode", "Nama", "Jenis", "Email", "Telepon", "Status", "Verifikasi"], ...items.map((item) => [
      item.code, item.name, item.institutionType || "", item.email || "", item.phone || "", item.status, item.verificationStatus,
    ])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "direktori-lembaga.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <AdminLayout>
      <div className="institution-workspace">
        <InstitutionWorkspaceNav />
        <PageHeader
          title="Direktori lembaga"
          description="Satu sumber data lembaga, kontak resmi, afiliasi asatidz, dan riwayat undangan."
          breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Lembaga" }]}
          actions={<>
            <button className="institution-button institution-button--quiet" type="button" onClick={exportCsv} disabled={!items.length}><Download /> Ekspor CSV</button>
            <Link className="institution-button institution-button--primary" to="/admin/institutions/create"><Plus /> Tambah lembaga</Link>
          </>}
        />

        <section className="institution-metrics" aria-label="Ringkasan data lembaga">
          <div><Building2 /><strong>{totals.total}</strong><span>Total lembaga</span></div>
          <div><ShieldCheck /><strong>{totals.verified}</strong><span>Terverifikasi</span></div>
          <div><CircleAlert /><strong>{totals.pending}</strong><span>Perlu verifikasi</span></div>
          <div><Building2 /><strong>{totals.inactive}</strong><span>Nonaktif</span></div>
        </section>

        <section className="institution-directory" aria-labelledby="directory-title">
          <div className="institution-directory__toolbar">
            <div>
              <h2 id="directory-title">Data lembaga</h2>
              <p>{meta.total} lembaga sesuai filter</p>
            </div>
            <div className="institution-directory__filters">
              <label className="institution-search"><Search /><span className="sr-only">Cari lembaga</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, kode, email…" /></label>
              <select aria-label="Filter status" value={searchParams.get("status") || "ALL"} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="ALL">Semua status</option><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option>
              </select>
              <select aria-label="Filter verifikasi" value={searchParams.get("verificationStatus") || "ALL"} onChange={(event) => updateFilter("verificationStatus", event.target.value)}>
                <option value="ALL">Semua verifikasi</option><option value="VERIFIED">Terverifikasi</option><option value="UNVERIFIED">Belum verifikasi</option>
              </select>
              <button type="button" className="institution-icon-button" aria-label="Muat ulang" onClick={() => setSearchParams(new URLSearchParams(searchParams))}><RefreshCw /></button>
            </div>
          </div>

          {error && <div className="institution-alert" role="alert">{error}</div>}
          {loading ? <div className="institution-loading">Memuat direktori lembaga…</div> : items.length === 0 ? (
            <EmptyState title="Lembaga tidak ditemukan" description="Ubah kata kunci atau filter, atau tambahkan lembaga baru." action={<Link className="institution-button institution-button--primary" to="/admin/institutions/create">Tambah lembaga</Link>} />
          ) : (
            <>
              <div className="institution-table-wrap">
                <table className="institution-table">
                  <thead><tr><th>Lembaga</th><th>Kontak</th><th>Wilayah</th><th>Status</th><th><span className="sr-only">Aksi</span></th></tr></thead>
                  <tbody>{items.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong><span>{item.code} · {item.institutionType || "Jenis belum diisi"}</span></td>
                      <td><strong>{item.email || "Email belum diisi"}</strong><span>{item.whatsapp || item.phone || "Nomor belum diisi"}</span></td>
                      <td><strong>{item.cityCode || "—"}</strong><span>{item.provinceCode ? `Provinsi ${item.provinceCode}` : "Wilayah belum lengkap"}</span></td>
                      <td><div className="institution-table__badges"><StatusBadge label={item.status === "ACTIVE" ? "Aktif" : "Nonaktif"} variant={item.status === "ACTIVE" ? "success" : "neutral"} /><StatusBadge label={item.verificationStatus === "VERIFIED" ? "Terverifikasi" : "Perlu verifikasi"} variant={item.verificationStatus === "VERIFIED" ? "success" : "warning"} /></div></td>
                      <td><div className="institution-table__actions"><Link to={`/admin/institutions/${item.id}`} aria-label={`Lihat ${item.name}`}><Eye /></Link><Link to={`/admin/institutions/${item.id}/edit`} aria-label={`Edit ${item.name}`}><Edit3 /></Link></div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="institution-pagination">
                <button type="button" disabled={meta.page <= 1} onClick={() => updateFilter("page", String(meta.page - 1))}>Sebelumnya</button>
                <span>Halaman {meta.page} dari {meta.pageCount}</span>
                <button type="button" disabled={meta.page >= meta.pageCount} onClick={() => updateFilter("page", String(meta.page + 1))}>Berikutnya</button>
              </div>
            </>
          )}
        </section>
        <footer className="institution-colophon">Direktori lembaga · perubahan tersimpan dalam audit sistem · penghapusan menggunakan kebijakan nonaktif aman.</footer>
      </div>
    </AdminLayout>
  );
};
