import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { InvitationResponseForm } from "../../src/components/invitations/InvitationResponseForm";
import { InstitutionInvitationForm } from "../../src/components/invitations/InstitutionInvitationForm";
import { buildInvitationShareText } from "../../src/lib/invitationShare";

describe("formulir undangan lembaga", () => {
  const data = { invitation: { invitationNumber: "UND-1", quota: 3, status: "SENT" }, institution: { name: "Ma'had Uji", code: "MU" } };
  it("menampilkan lembaga sebagai identitas, bukan input ulang", () => {
    const html = renderToStaticMarkup(<InvitationResponseForm data={data} invitationType="institution" saving={false} error="" onSubmit={() => {}} />);
    expect(html).toContain("Identitas lembaga sudah terhubung");
    expect(html).not.toContain("Nama lembaga/komunitas");
    expect(html).toContain("Saya membawa rombongan");
    expect(html).not.toContain("Tambah peserta</button>");
    expect(html).not.toContain("Peserta tambahan 1");
  });
  it("menghilangkan seluruh kontrol rombongan ketika tidak diizinkan", () => {
    const html = renderToStaticMarkup(<InvitationResponseForm data={{ ...data, invitation: { ...data.invitation, quota: 1, allowGroup: false } }} invitationType="institution" saving={false} error="" onSubmit={() => {}} />);
    expect(html).not.toContain("Saya membawa rombongan"); expect(html).not.toContain("Tambah peserta");
    expect(html).toContain("Peserta utama");
  });
  it("menampilkan kuota dua dari undangan dan tidak menawarkan anggota saat belum dicentang", () => {
    const html = renderToStaticMarkup(<InvitationResponseForm data={{ ...data, invitation: { ...data.invitation, quota: 2, allowGroup: true } }} invitationType="institution" saving={false} error="" onSubmit={() => {}} />);
    expect(html).toContain("Maksimal 2 orang termasuk peserta utama");
    expect(html).not.toContain("Maksimal 5");
    expect(html).not.toContain("Tambah peserta</button>");
    expect(html).not.toContain("Peserta tambahan 1");
  });
  it("tidak menawarkan rombongan jika dimatikan meskipun payload lama menyebut kuota lima", () => {
    const html = renderToStaticMarkup(<InvitationResponseForm data={{ ...data, invitation: { ...data.invitation, quota: 5, allowGroup: false } }} invitationType="institution" saving={false} error="" onSubmit={() => {}} />);
    expect(html).not.toContain("Saya membawa rombongan");
    expect(html).not.toContain("Tambah peserta");
    expect(html).not.toContain("Peserta tambahan 1");
    expect(html).toContain("Peserta utama");
  });
  it("mempertahankan input lembaga opsional hanya untuk undangan individu tanpa lembaga", () => {
    const html = renderToStaticMarkup(<InvitationResponseForm data={{ invitation: data.invitation }} invitationType="individual" saving={false} error="" onSubmit={() => {}} />);
    expect(html).toContain("Nama lembaga/komunitas"); expect(html).not.toContain("Saya membawa rombongan");
  });
  it("editor menggunakan kontak master dan batas waktu lengkap dalam zona event", () => {
    const html = renderToStaticMarkup(<MemoryRouter><InstitutionInvitationForm institutions={[{ id: "i", code: "MU", name: "Ma'had Uji", email: "kontak@example.invalid", contactName: "PIC Lembaga" }]}
      value={{ institutionId: "i", invitationNumber: "UND-1", quota: 1, allowGroup: false, responseDeadline: "2027-01-01T12:00" }}
      onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} editing recipientLocked registeredCount={1} timezone="Asia/Makassar" busy={false} disabled={false} /></MemoryRouter>);
    expect(html).toContain("kontak@example.invalid"); expect(html).toContain("PIC Lembaga");
    expect(html).toContain("/admin/institutions/i"); expect(html).toContain('type="datetime-local"'); expect(html).toContain("WITA");
    expect(html).not.toContain('type="number"');
  });
  it("menjelaskan undangan pengganti tanpa mengaktifkan kembali undangan dicabut", () => {
    const html = renderToStaticMarkup(<MemoryRouter><InstitutionInvitationForm institutions={[{ id: "i", code: "MU", name: "Ma'had Uji" }]}
      value={{ institutionId: "i", invitationNumber: "", quota: 5, allowGroup: true, responseDeadline: "2027-01-01T12:00" }}
      onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} editing={false} replacementNumber="UND-OLD"
      recipientLocked={false} registeredCount={0} timezone="Asia/Makassar" busy={false} disabled={false} /></MemoryRouter>);
    expect(html).toContain('aria-label="Buat undangan pengganti"');
    expect(html).toContain("Undangan UND-OLD tetap dicabut");
    expect(html).toContain("Nomor undangan baru");
    expect(html).toContain("Buat tautan pengganti");
    expect(html).toContain("Peserta lama tidak dipindahkan otomatis");
    expect(html).not.toContain('value="UND-OLD"');
  });
  it("pesan WhatsApp/email mengikuti izin rombongan tanpa meminta kode yang tidak dipakai", () => {
    const context = { institutionName: "Ma'had", eventName: "Daurah", invitationNumber: "UND-1", invitationUrl: "https://example.invalid/invitation/token" };
    expect(buildInvitationShareText({ ...context, allowGroup: false })).toContain("tanpa peserta tambahan");
    expect(buildInvitationShareText({ ...context, allowGroup: true, quota: 4 })).toContain("maksimal 4 peserta");
    expect(buildInvitationShareText(context)).not.toContain("kode unik");
  });
});
