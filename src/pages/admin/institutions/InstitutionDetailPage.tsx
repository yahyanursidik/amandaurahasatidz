import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { InstitutionWorkspaceNav } from "@/components/admin/institutions/InstitutionWorkspaceNav";
import { Institution, institutionApi } from "@/lib/institutionApi";
import { Archive, Building2, CalendarDays, Check, Contact, Edit3, Mail, MapPin, Phone, Plus, ShieldCheck, Trash2, UserRoundCheck, UsersRound, X } from "lucide-react";

type Tab = "overview" | "contacts" | "affiliations" | "invitations";
const tabItems: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "Ringkasan", icon: Building2 },
  { id: "contacts", label: "Kontak & PIC", icon: Contact },
  { id: "affiliations", label: "Asatidz terafiliasi", icon: UsersRound },
  { id: "invitations", label: "Undangan & delegasi", icon: CalendarDays },
];

export const InstitutionDetailPage: React.FC = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") || "overview") as Tab;
  const [item, setItem] = useState<Institution | null>(null);
  const [error, setError] = useState("");
  const [showRepresentativeForm, setShowRepresentativeForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [representative, setRepresentative] = useState({ name: "", email: "", phone: "", position: "", isPrimary: false });
  const load = () => institutionApi.get(id).then(setItem).catch((cause) => setError(cause instanceof Error ? cause.message : "Detail lembaga gagal dimuat."));
  useEffect(() => { void load(); }, [id]);

  const participantByEvent = useMemo(() => {
    const groups = new Map<string, { eventName: string; eventId: string; eventStartDate: string; participants: NonNullable<Institution["participants"]> }>();
    for (const participant of item?.participants || []) {
      const group = groups.get(participant.eventId) || { eventName: participant.eventName, eventId: participant.eventId, eventStartDate: participant.eventStartDate, participants: [] };
      group.participants.push(participant);
      groups.set(participant.eventId, group);
    }
    return [...groups.values()];
  }, [item]);

  if (!item) return <AdminLayout><div className="institution-workspace"><InstitutionWorkspaceNav /><div className="institution-loading">{error || "Memuat detail lembaga…"}</div></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="institution-workspace">
        <InstitutionWorkspaceNav />
        <PageHeader
          title={item.name}
          description={`${item.code} · ${item.institutionType || "Jenis lembaga belum diisi"}`}
          breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Lembaga", href: "/admin/institutions" }, { label: item.code }]}
          actions={<Link className="institution-button institution-button--primary" to={`/admin/institutions/${id}/edit`}><Edit3 /> Edit profil</Link>}
        />

        <section className="institution-profile-band">
          <div className="institution-profile-band__identity"><span><Building2 /></span><div><div><StatusBadge label={item.status === "ACTIVE" ? "Aktif" : "Nonaktif"} variant={item.status === "ACTIVE" ? "success" : "neutral"} /><StatusBadge label={item.verificationStatus === "VERIFIED" ? "Terverifikasi" : "Perlu verifikasi"} variant={item.verificationStatus === "VERIFIED" ? "success" : "warning"} /></div><strong>{item.legalName || item.name}</strong><small>Diperbarui {new Date(item.updatedAt).toLocaleDateString("id-ID")}</small></div></div>
          <dl>
            <div><dt>PIC</dt><dd>{item.relationSummary?.representativeCount || 0}</dd></div>
            <div><dt>Afiliasi</dt><dd>{item.relationSummary?.affiliationCount || 0}</dd></div>
            <div><dt>Undangan</dt><dd>{item.relationSummary?.invitationCount || 0}</dd></div>
            <div><dt>Peserta</dt><dd>{item.relationSummary?.participantCount || 0}</dd></div>
          </dl>
        </section>

        <nav className="institution-detail-tabs" aria-label="Submenu detail lembaga">
          {tabItems.map(({ id: tabId, label, icon: Icon }) => <button key={tabId} className={activeTab === tabId ? "is-active" : ""} onClick={() => setSearchParams({ tab: tabId })}><Icon />{label}</button>)}
        </nav>

        {error && <div className="institution-alert" role="alert">{error}</div>}

        {activeTab === "overview" && (
          <div className="institution-detail-grid">
            <section className="institution-detail-section"><h2>Profil dan kontak</h2><dl className="institution-definition-list">
              <div><dt>Email resmi</dt><dd>{item.email || "Belum diisi"}</dd></div><div><dt>Telepon</dt><dd>{item.phone || "Belum diisi"}</dd></div><div><dt>WhatsApp</dt><dd>{item.whatsapp || "Belum diisi"}</dd></div><div><dt>Website</dt><dd>{item.website ? <a href={item.website} target="_blank" rel="noreferrer">{item.website}</a> : "Belum diisi"}</dd></div>
            </dl></section>
            <section className="institution-detail-section"><h2>Wilayah</h2><dl className="institution-definition-list">
              <div><dt>Kode provinsi</dt><dd>{item.provinceCode || "—"}</dd></div><div><dt>Kode kota</dt><dd>{item.cityCode || "—"}</dd></div><div><dt>Kecamatan</dt><dd>{item.district || "Belum diisi"}</dd></div><div><dt>Alamat</dt><dd>{item.address || "Belum diisi"}</dd></div>
            </dl></section>
            <section className="institution-detail-section institution-detail-section--wide"><h2>Kontrol kualitas data</h2><div className="institution-quality-list">
              <span className={item.email ? "is-complete" : ""}>{item.email ? <Check /> : <X />} Email resmi</span>
              <span className={item.whatsapp || item.phone ? "is-complete" : ""}>{item.whatsapp || item.phone ? <Check /> : <X />} Nomor kontak</span>
              <span className={item.address && item.cityCode ? "is-complete" : ""}>{item.address && item.cityCode ? <Check /> : <X />} Alamat dan wilayah</span>
              <span className={(item.representatives?.length || 0) > 0 ? "is-complete" : ""}>{(item.representatives?.length || 0) > 0 ? <Check /> : <X />} PIC lembaga</span>
            </div></section>
          </div>
        )}

        {activeTab === "contacts" && (
          <section className="institution-detail-section">
            <div className="institution-section-heading"><div><h2>Kontak dan PIC lembaga</h2><p>PIC menerima komunikasi administratif; tandai satu kontak utama.</p></div><button className="institution-button institution-button--primary" onClick={() => setShowRepresentativeForm(true)}><Plus /> Tambah PIC</button></div>
            {showRepresentativeForm && <form className="institution-inline-form" onSubmit={async (event) => {
              event.preventDefault(); setPending(true); setError("");
              try { await institutionApi.addRepresentative(id, representative); setRepresentative({ name: "", email: "", phone: "", position: "", isPrimary: false }); setShowRepresentativeForm(false); await load(); }
              catch (cause) { setError(cause instanceof Error ? cause.message : "PIC gagal ditambahkan."); } finally { setPending(false); }
            }}>
              <label>Nama<input required value={representative.name} onChange={(event) => setRepresentative({ ...representative, name: event.target.value })} /></label>
              <label>Email<input required type="email" value={representative.email} onChange={(event) => setRepresentative({ ...representative, email: event.target.value })} /></label>
              <label>Telepon<input value={representative.phone} onChange={(event) => setRepresentative({ ...representative, phone: event.target.value })} /></label>
              <label>Jabatan<input value={representative.position} onChange={(event) => setRepresentative({ ...representative, position: event.target.value })} /></label>
              <label className="institution-check"><input type="checkbox" checked={representative.isPrimary} onChange={(event) => setRepresentative({ ...representative, isPrimary: event.target.checked })} /> Jadikan kontak utama</label>
              <div><button type="button" className="institution-button institution-button--quiet" onClick={() => setShowRepresentativeForm(false)}>Batal</button><button className="institution-button institution-button--primary" disabled={pending}>{pending ? "Menyimpan…" : "Simpan PIC"}</button></div>
            </form>}
            {!item.representatives?.length ? <EmptyState title="Belum ada PIC" description="Tambahkan minimal satu kontak lembaga untuk korespondensi undangan." /> : <div className="institution-contact-list">{item.representatives.map((rep) => <article key={rep.id}><div><strong>{rep.name}</strong><span>{rep.position || "Jabatan belum diisi"}</span></div>{rep.isPrimary && <StatusBadge label="Kontak utama" variant="success" />}<p><Mail />{rep.email}</p><p><Phone />{rep.phone || "Nomor belum diisi"}</p><div><button disabled={rep.isPrimary} onClick={async () => { await institutionApi.updateRepresentative(id, rep.id, { isPrimary: true }); await load(); }}>Jadikan utama</button><button aria-label={`Hapus ${rep.name}`} onClick={async () => { await institutionApi.deleteRepresentative(id, rep.id); await load(); }}><Trash2 /></button></div></article>)}</div>}
          </section>
        )}

        {activeTab === "affiliations" && <section className="institution-detail-section"><div className="institution-section-heading"><div><h2>Asatidz terafiliasi</h2><p>Profil asatidz yang memiliki hubungan aktif dengan lembaga.</p></div><Link className="institution-button institution-button--quiet" to="/admin/ustadz">Kelola asatidz</Link></div>{!item.affiliations?.length ? <EmptyState title="Belum ada afiliasi" description="Afiliasi ditambahkan melalui profil asatidz." /> : <div className="institution-affiliation-list">{item.affiliations.map((aff) => <Link key={aff.id} to={`/admin/ustadz/${aff.ustadzId}`}><UserRoundCheck /><div><strong>{aff.ustadzName}</strong><span>{aff.position || "Posisi belum diisi"} · {aff.status}</span></div>{aff.verifiedAt && <ShieldCheck />}</Link>)}</div>}</section>}

        {activeTab === "invitations" && <div className="institution-detail-grid">
          <section className="institution-detail-section institution-detail-section--wide"><h2>Riwayat undangan</h2>{!item.invitationHistory?.length ? <EmptyState title="Belum pernah diundang" description="Undangan lembaga dibuat dari ruang kerja event." /> : <div className="institution-history-list">{item.invitationHistory.map((invite) => <Link key={invite.id} to={`/admin/events/${invite.eventId}?tab=invitations`}><div><strong>{invite.eventName}</strong><span>{invite.eventCode} · {new Date(invite.eventStartDate).toLocaleDateString("id-ID")}</span></div><StatusBadge label={invite.responseStatus || invite.status} variant={invite.responseStatus === "ACCEPTED" || invite.status === "RESPONDED" ? "success" : "info"} /><span>Kuota {invite.quota || "—"}</span></Link>)}</div>}</section>
          <section className="institution-detail-section institution-detail-section--wide"><h2>Delegasi per event</h2>{participantByEvent.length === 0 ? <EmptyState title="Belum ada delegasi" description="Asatidz yang didaftarkan lembaga akan muncul per event." /> : participantByEvent.map((group) => <div className="institution-delegation" key={group.eventId}><div><strong>{group.eventName}</strong><span>{group.participants.length} asatidz</span></div><ul>{group.participants.map((participant) => <li key={participant.id}><span>{participant.ustadzName}{participant.isDelegationLead ? " · Ketua delegasi" : ""}</span><StatusBadge label={participant.approvalStatus} variant={participant.approvalStatus === "APPROVED" ? "success" : "warning"} /></li>)}</ul></div>)}</section>
        </div>}

        <section className="institution-danger-zone"><div><Archive /><div><h2>Nonaktifkan lembaga</h2><p>Riwayat undangan dan peserta tetap tersimpan serta dapat diaudit.</p></div></div><button disabled={item.status === "INACTIVE" || pending} onClick={async () => { setPending(true); try { await institutionApi.deactivate(id); navigate("/admin/institutions?status=INACTIVE"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Lembaga gagal dinonaktifkan."); } finally { setPending(false); } }}>{item.status === "INACTIVE" ? "Sudah nonaktif" : "Nonaktifkan"}</button></section>
        <footer className="institution-colophon">Profil lembaga · relasi undangan dan peserta ditampilkan dari database · seluruh perubahan tercatat dalam audit.</footer>
      </div>
    </AdminLayout>
  );
};
