import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useGetIdentity } from "@refinedev/core";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { InstitutionWorkspaceNav } from "@/components/admin/institutions/InstitutionWorkspaceNav";
import { Institution, InstitutionRepresentative, institutionApi, institutionTypeLabel } from "@/lib/institutionApi";
import { institutionRegionLabel } from "@/lib/institutionRegion";
import { invitationStatusLabel } from "@/lib/institutionInvitation";
import { participantApprovalLabel, participantSourceLabel } from "@/lib/participantCatalog";
import { participantStaffPermissions } from "@/lib/participantManagement";
import { ROLE_PERMISSIONS, type RoleCode } from "@/config/permissions";
import type { AuthIdentity } from "@/lib/refine/authProvider";
import { Archive, Building2, CalendarDays, Check, Contact, Edit3, Mail, Phone, Plus, ShieldCheck, Trash2, UserRoundCheck, UsersRound, X } from "lucide-react";

type Tab = "overview" | "contacts" | "affiliations" | "invitations";
const tabItems: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "Ringkasan", icon: Building2 },
  { id: "contacts", label: "Kontak & PIC", icon: Contact },
  { id: "affiliations", label: "Asatidz terafiliasi", icon: UsersRound },
  { id: "invitations", label: "Undangan & peserta", icon: CalendarDays },
];
const emptyRepresentative = { name: "", email: "", phone: "", position: "", isPrimary: false };
const whatsappUrl = (value?: string | null) => {
  const digits = (value || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits.startsWith("0") ? `62${digits.slice(1)}` : digits}` : null;
};

export const InstitutionDetailPage: React.FC = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity<AuthIdentity>();
  const canBrowseEvents = Boolean(identity?.assignments.some((assignment) => ROLE_PERMISSIONS[assignment.roleCode as RoleCode]?.includes("events.read")));
  const eventPermissions = (eventId: string) => participantStaffPermissions(identity?.assignments, eventId);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: Tab = tabItems.some((tab) => tab.id === requestedTab) ? requestedTab as Tab : "overview";
  const [item, setItem] = useState<Institution | null>(null);
  const [error, setError] = useState("");
  const [showRepresentativeForm, setShowRepresentativeForm] = useState(false);
  const [editingRepresentativeId, setEditingRepresentativeId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [representative, setRepresentative] = useState(emptyRepresentative);
  const load = () => institutionApi.get(id).then((result) => { setItem(result); setError(""); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Detail lembaga gagal dimuat."));
  const startRepresentativeForm = (rep?: InstitutionRepresentative) => {
    setEditingRepresentativeId(rep?.id || null);
    setRepresentative(rep ? { name: rep.name, email: rep.email, phone: rep.phone || "", position: rep.position || "", isPrimary: rep.isPrimary } : emptyRepresentative);
    setShowRepresentativeForm(true);
    setError("");
  };
  const runRepresentativeAction = async (action: () => Promise<unknown>, fallback: string) => {
    setPending(true); setError("");
    try { await action(); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : fallback); }
    finally { setPending(false); }
  };
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
  const region = institutionRegionLabel(item.cityCode, item.provinceCode);

  return (
    <AdminLayout>
      <div className="institution-workspace">
        <InstitutionWorkspaceNav />
        <PageHeader
          title={item.name}
          description={`${item.code} · ${institutionTypeLabel(item.institutionType)}`}
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
              <div><dt>Email resmi</dt><dd>{item.email ? <a href={`mailto:${item.email}`}>{item.email}</a> : "Belum diisi"}</dd></div><div><dt>Telepon</dt><dd>{item.phone ? <a href={`tel:${item.phone}`}>{item.phone}</a> : "Belum diisi"}</dd></div><div><dt>WhatsApp</dt><dd>{whatsappUrl(item.whatsapp) ? <a href={whatsappUrl(item.whatsapp)!} target="_blank" rel="noreferrer">{item.whatsapp}</a> : "Belum diisi"}</dd></div><div><dt>Website</dt><dd>{item.website ? <a href={item.website} target="_blank" rel="noreferrer">{item.website}</a> : "Belum diisi"}</dd></div>
            </dl></section>
            <section className="institution-detail-section"><h2>Wilayah</h2><dl className="institution-definition-list">
              <div><dt>Provinsi</dt><dd>{region.province}</dd></div><div><dt>Kabupaten/kota</dt><dd>{region.city}</dd></div><div><dt>Kecamatan</dt><dd>{item.district || "Belum diisi"}</dd></div><div><dt>Alamat</dt><dd>{item.address || "Belum diisi"}</dd></div>
            </dl></section>
            <section className="institution-detail-section institution-detail-section--wide"><h2>Kontrol kualitas data</h2><div className="institution-quality-list">
              <span className={item.email ? "is-complete" : ""}>{item.email ? <Check /> : <X />} Email resmi</span>
              <span className={item.whatsapp || item.phone ? "is-complete" : ""}>{item.whatsapp || item.phone ? <Check /> : <X />} Nomor kontak</span>
              <span className={item.address && item.cityCode ? "is-complete" : ""}>{item.address && item.cityCode ? <Check /> : <X />} Alamat dan wilayah</span>
              <button type="button" className={(item.representatives?.length || 0) > 0 ? "is-complete" : ""} onClick={() => setSearchParams({ tab: "contacts" })}>{(item.representatives?.length || 0) > 0 ? <Check /> : <X />} PIC lembaga</button>
            </div></section>
          </div>
        )}

        {activeTab === "contacts" && (
          <section className="institution-detail-section">
            <div className="institution-section-heading"><div><h2>Kontak dan PIC lembaga</h2><p>Kontak utama untuk koordinasi undangan.</p></div><button type="button" className="institution-button institution-button--primary" onClick={() => startRepresentativeForm()}><Plus /> Tambah PIC</button></div>
            {showRepresentativeForm && <form className="institution-inline-form" onSubmit={async (event) => {
              event.preventDefault(); setPending(true); setError("");
              try {
                if (editingRepresentativeId) await institutionApi.updateRepresentative(id, editingRepresentativeId, representative);
                else await institutionApi.addRepresentative(id, representative);
                setRepresentative(emptyRepresentative); setEditingRepresentativeId(null); setShowRepresentativeForm(false); await load();
              } catch (cause) { setError(cause instanceof Error ? cause.message : "PIC gagal disimpan."); } finally { setPending(false); }
            }}>
              <h3 className="institution-inline-form__title">{editingRepresentativeId ? "Edit PIC" : "Tambah PIC"}</h3>
              <label>Nama<input required value={representative.name} onChange={(event) => setRepresentative({ ...representative, name: event.target.value })} /></label>
              <label>Email<input required type="email" value={representative.email} onChange={(event) => setRepresentative({ ...representative, email: event.target.value })} /></label>
              <label>Telepon<input value={representative.phone} onChange={(event) => setRepresentative({ ...representative, phone: event.target.value })} /></label>
              <label>Jabatan<input value={representative.position} onChange={(event) => setRepresentative({ ...representative, position: event.target.value })} /></label>
              <label className="institution-check"><input type="checkbox" checked={representative.isPrimary} onChange={(event) => setRepresentative({ ...representative, isPrimary: event.target.checked })} /> Jadikan kontak utama</label>
              <div><button type="button" className="institution-button institution-button--quiet" disabled={pending} onClick={() => { setShowRepresentativeForm(false); setEditingRepresentativeId(null); }}>Batal</button><button className="institution-button institution-button--primary" disabled={pending}>{pending ? "Menyimpan…" : "Simpan PIC"}</button></div>
            </form>}
            {!item.representatives?.length ? <EmptyState title="Belum ada PIC" description="Tambahkan kontak lembaga agar undangan mudah ditindaklanjuti." /> : <div className="institution-contact-list">{item.representatives.map((rep) => <article key={rep.id}><div><strong>{rep.name}</strong>{rep.isPrimary && <StatusBadge label="Utama" variant="success" />}</div><span>{rep.position || "Jabatan belum diisi"}</span><p><Mail /><a href={`mailto:${rep.email}`}>{rep.email}</a></p>{rep.phone && <p><Phone /><a href={whatsappUrl(rep.phone) || `tel:${rep.phone}`} target="_blank" rel="noreferrer">{rep.phone}</a></p>}<div className="institution-contact-list__actions"><button type="button" disabled={pending} onClick={() => startRepresentativeForm(rep)}><Edit3 /> Edit</button>{!rep.isPrimary && <button type="button" disabled={pending} onClick={() => void runRepresentativeAction(() => institutionApi.updateRepresentative(id, rep.id, { isPrimary: true }), "Kontak utama gagal diubah.")}>Jadikan utama</button>}<button type="button" disabled={pending} aria-label={`Hapus ${rep.name}`} onClick={() => { if (window.confirm(`Hapus PIC ${rep.name}?`)) void runRepresentativeAction(() => institutionApi.deleteRepresentative(id, rep.id), "PIC gagal dihapus."); }}><Trash2 /> Hapus</button></div></article>)}</div>}
          </section>
        )}

        {activeTab === "affiliations" && <section className="institution-detail-section"><div className="institution-section-heading"><div><h2>Asatidz terafiliasi</h2><p>Profil asatidz yang memiliki hubungan aktif dengan lembaga.</p></div><Link className="institution-button institution-button--quiet" to="/admin/ustadz">Kelola asatidz</Link></div>{!item.affiliations?.length ? <EmptyState title="Belum ada afiliasi" description="Afiliasi ditambahkan melalui profil asatidz." /> : <div className="institution-affiliation-list">{item.affiliations.map((aff) => <Link key={aff.id} to={`/admin/ustadz/${aff.ustadzId}`}><UserRoundCheck /><div><strong>{aff.ustadzName}</strong><span>{aff.position || "Posisi belum diisi"} · {aff.status}</span></div>{aff.verifiedAt && <ShieldCheck />}</Link>)}</div>}</section>}

        {activeTab === "invitations" && <div className="institution-detail-grid">
          <section className="institution-detail-section institution-detail-section--wide"><div className="institution-section-heading institution-section-heading--inset"><div><h2>Riwayat undangan</h2><p>Setiap nomor undangan dan respons akhir ditampilkan sekali.</p></div>{canBrowseEvents && <Link className="institution-button institution-button--quiet" to="/admin/events">Semua event</Link>}</div>{!item.invitationHistory?.length ? <EmptyState title="Belum pernah diundang" description="Buka event, lalu pilih lembaga ini saat membuat undangan." /> : <div className="institution-history-list">{item.invitationHistory.map((invite) => {
            const content = <><div><strong>{invite.eventName}</strong><span>{invite.invitationNumber} · {new Date(invite.eventStartDate).toLocaleDateString("id-ID")}</span></div><StatusBadge label={invitationStatusLabel[invite.responseStatus || invite.status] || invite.responseStatus || invite.status} variant={invite.responseStatus === "ACCEPTED" || invite.status === "ACCEPTED" ? "success" : "info"} /><span>Kuota {invite.quota || "—"}</span></>;
            const permissions = eventPermissions(invite.eventId);
            return permissions.includes("invitations.read") ? <Link key={invite.id} to={`/admin/events/${invite.eventId}/registrations?view=invitations&institutionId=${id}&invitationId=${invite.id}`}>{content}</Link>
              : permissions.includes("events.read") ? <Link key={invite.id} to={`/admin/events/${invite.eventId}`}>{content}</Link>
                : <div key={invite.id}>{content}</div>;
          })}</div>}</section>
          <section className="institution-detail-section institution-detail-section--wide"><h2>Peserta terkait lembaga</h2><p className="institution-delegation__intro">Termasuk pendaftar reguler yang mencantumkan lembaga ini; jalur tiap asatidz ditampilkan di bawah namanya.</p>{participantByEvent.length === 0 ? <EmptyState title="Belum ada peserta terkait" description="Asatidz yang terdaftar dengan lembaga ini akan muncul per event." /> : participantByEvent.map((group) => <div className="institution-delegation" key={group.eventId}><div><strong>{group.eventName}</strong>{eventPermissions(group.eventId).includes("participants.read") ? <Link to={`/admin/events/${group.eventId}/registrations?view=participants&institutionId=${id}`}>Lihat {group.participants.length} peserta</Link> : <span>{group.participants.length} peserta</span>}</div><ul>{group.participants.map((participant) => <li key={participant.id}><Link to={`/admin/ustadz/${participant.ustadzId}`}><span>{participant.ustadzName}{participant.isDelegationLead ? " · Ketua rombongan" : ""}</span><small>{participantSourceLabel(participant.registrationSource)}</small></Link><StatusBadge label={participantApprovalLabel(participant.approvalStatus)} variant={participant.approvalStatus === "APPROVED" ? "success" : "warning"} /></li>)}</ul></div>)}</section>
        </div>}

        <section className="institution-danger-zone"><div><Archive /><div><h2>Nonaktifkan lembaga</h2><p>Riwayat undangan dan peserta tetap tersimpan serta dapat diaudit.</p></div></div><button type="button" disabled={item.status === "INACTIVE" || pending} onClick={async () => { if (!window.confirm(`Nonaktifkan ${item.name}? Riwayat undangan dan peserta tetap tersimpan.`)) return; setPending(true); try { await institutionApi.deactivate(id); navigate("/admin/institutions?status=INACTIVE"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Lembaga gagal dinonaktifkan."); } finally { setPending(false); } }}>{item.status === "INACTIVE" ? "Sudah nonaktif" : "Nonaktifkan"}</button></section>
        <footer className="institution-colophon">Profil lembaga · relasi undangan dan peserta ditampilkan dari database · seluruh perubahan tercatat dalam audit.</footer>
      </div>
    </AdminLayout>
  );
};
