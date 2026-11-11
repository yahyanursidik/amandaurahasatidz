import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { InvitationResponseForm } from "../../src/components/invitations/InvitationResponseForm";
import { InstitutionInvitationForm } from "../../src/components/invitations/InstitutionInvitationForm";
import { IndividualInvitationForm } from "../../src/components/invitations/IndividualInvitationForm";
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
  it("form mandiri menunjukkan sisa kuota dan hanya data diri pendaftar", () => {
    const html = renderToStaticMarkup(<InvitationResponseForm data={{ ...data, invitation: { ...data.invitation,
      registrationMode: "INDIVIDUAL_SELF", quota: 1, totalQuota: 5, remainingQuota: 3, allowGroup: false } }}
      invitationType="institution" saving={false} error="" onSubmit={() => {}} />);
    expect(html).toContain("Daftar sebagai asatidz lembaga");
    expect(html).toContain("3 dari 5 kursi");
    expect(html).toContain("Data diri Anda");
    expect(html).toContain("Daftar sekarang");
    expect(html).not.toContain("Berhalangan hadir");
    expect(html).not.toContain("kepala rombongan");
  });
  it("mengunci nama penerima pribadi dan tidak menawarkan rombongan atau lembaga", () => {
    const html = renderToStaticMarkup(<InvitationResponseForm data={{ invitation: data.invitation, recipient: { fullName: "Ustadz Ahmad" } }} invitationType="individual" saving={false} error="" onSubmit={() => {}} />);
    expect(html).toContain("Ahlan wa sahlan"); expect(html).toContain("Undangan pribadi ini untuk Anda");
    expect(html).toContain('value="Ustadz Ahmad"'); expect(html).toContain('readonly=""');
    expect(html).not.toContain("Nama lembaga/komunitas"); expect(html).not.toContain("Saya membawa rombongan");
  });
  it("editor undangan pribadi memilih satu profil dan satu tenggat", () => {
    const html = renderToStaticMarkup(<MemoryRouter><IndividualInvitationForm
      value={{ ustadzId: "u", invitationNumber: "PR-01", responseDeadline: "2027-01-01T12:00" }}
      onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} loadOptions={async () => []}
      selectedRecipient={{ id: "u", fullName: "Ustadz Ahmad", email: "ahmad@example.invalid" }}
      editing recipientLocked timezone="Asia/Makassar" busy={false} disabled={false} canOpenProfile canCreateProfile={false} /></MemoryRouter>);
    expect(html).toContain("Edit undangan pribadi"); expect(html).toContain("ahmad@example.invalid");
    expect(html).toContain("/admin/ustadz/u"); expect(html).toContain("WITA");
    expect(html).not.toContain("Kuota peserta");
  });
  it("editor menggunakan kontak master dan batas waktu lengkap dalam zona event", () => {
    const html = renderToStaticMarkup(<MemoryRouter><InstitutionInvitationForm institutions={[{ id: "i", code: "MU", name: "Ma'had Uji", email: "kontak@example.invalid", contactName: "PIC Lembaga" }]}
      value={{ institutionId: "i", invitationNumber: "UND-1", registrationMode: "DELEGATION", quota: 1, allowGroup: false, responseDeadline: "2027-01-01T12:00" }}
      onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} editing recipientLocked registeredCount={1} timezone="Asia/Makassar" busy={false} disabled={false} /></MemoryRouter>);
    expect(html).toContain("kontak@example.invalid"); expect(html).toContain("PIC Lembaga");
    expect(html).toContain("/admin/institutions/i"); expect(html).toContain('type="datetime-local"'); expect(html).toContain("WITA");
    expect(html).not.toContain('type="number"');
    expect(html).not.toContain('name="registrationMode" value="INDIVIDUAL_SELF" checked="" disabled=""');
  });
  it("edit perwakilan yang sudah punya peserta tetap dapat memilih pendaftaran mandiri", () => {
    const html = renderToStaticMarkup(<MemoryRouter><InstitutionInvitationForm institutions={[{ id: "i", code: "MU", name: "Ma'had Uji" }]}
      value={{ institutionId: "i", invitationNumber: "UND-1", registrationMode: "INDIVIDUAL_SELF", quota: 15, allowGroup: false, responseDeadline: "2027-01-01T12:00" }}
      originalMode="DELEGATION" onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} editing recipientLocked
      registeredCount={1} timezone="Asia/Jakarta" busy={false} disabled={false} /></MemoryRouter>);
    expect(html).toContain("peserta lama tetap tercatat");
    expect(html).toContain("Setelah disimpan, undangan dibuka lagi");
    expect(html).toMatch(/name="registrationMode"[^>]*value="INDIVIDUAL_SELF"/);
    expect(html).not.toMatch(/name="registrationMode"[^>]*disabled=""[^>]*value="INDIVIDUAL_SELF"/);
  });
  it("edit pendaftaran mandiri dengan peserta tidak menawarkan perubahan ke perwakilan", () => {
    const html = renderToStaticMarkup(<MemoryRouter><InstitutionInvitationForm institutions={[{ id: "i", code: "MU", name: "Ma'had Uji" }]}
      value={{ institutionId: "i", invitationNumber: "UND-1", registrationMode: "INDIVIDUAL_SELF", quota: 5, allowGroup: false, responseDeadline: "" }}
      originalMode="INDIVIDUAL_SELF" onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} editing recipientLocked
      registeredCount={2} timezone="Asia/Jakarta" busy={false} disabled={false} /></MemoryRouter>);
    expect(html).toContain("Pola perwakilan belum dapat dipilih");
    expect(html).toMatch(/name="registrationMode"[^>]*disabled=""[^>]*value="DELEGATION"/);
  });
  it("menjelaskan undangan pengganti tanpa mengaktifkan kembali undangan dicabut", () => {
    const html = renderToStaticMarkup(<MemoryRouter><InstitutionInvitationForm institutions={[{ id: "i", code: "MU", name: "Ma'had Uji" }]}
      value={{ institutionId: "i", invitationNumber: "", registrationMode: "DELEGATION", quota: 5, allowGroup: true, responseDeadline: "2027-01-01T12:00" }}
      onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} editing={false} replacementNumber="UND-OLD"
      recipientLocked={false} registeredCount={0} timezone="Asia/Makassar" busy={false} disabled={false} /></MemoryRouter>);
    expect(html).toContain('aria-label="Buat undangan pengganti"');
    expect(html).toContain("Undangan UND-OLD tetap dicabut");
    expect(html).toContain("Nomor undangan baru");
    expect(html).toContain("Buat tautan pengganti");
    expect(html).toContain("Peserta lama tidak dipindahkan otomatis");
    expect(html).not.toContain('value="UND-OLD"');
  });
  it("editor memberi pilihan pola pengisian dan kuota lembaga mandiri", () => {
    const html = renderToStaticMarkup(<MemoryRouter><InstitutionInvitationForm institutions={[{ id: "i", code: "MU", name: "Ma'had Uji" }]}
      value={{ institutionId: "i", invitationNumber: "SELF-1", registrationMode: "INDIVIDUAL_SELF", quota: 5, allowGroup: false, responseDeadline: "" }}
      onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} editing={false} recipientLocked={false}
      registeredCount={2} timezone="Asia/Jakarta" busy={false} disabled={false} /></MemoryRouter>);
    expect(html).toContain("Asatidz mengisi masing-masing");
    expect(html).toContain("Kuota total lembaga");
    expect(html).toContain("sisa 3 kursi");
    expect(html).not.toContain("Boleh membawa rombongan");
  });
  it("pesan WhatsApp/email mengikuti izin rombongan tanpa meminta kode yang tidak dipakai", () => {
    const context = { institutionName: "Ma'had", eventName: "Daurah", invitationNumber: "UND-1", invitationUrl: "https://example.invalid/invitation/token" };
    expect(buildInvitationShareText({ ...context, allowGroup: false })).toContain("tanpa peserta tambahan");
    expect(buildInvitationShareText({ ...context, allowGroup: true, quota: 4 })).toContain("maksimal 4 peserta");
    expect(buildInvitationShareText(context)).not.toContain("kode unik");
  });
  it("pesan undangan mandiri menjelaskan satu tautan berulang dan persetujuan admin", () => {
    const message = buildInvitationShareText({ institutionName: "Ma'had Uji", eventName: "Daurah", invitationNumber: "SELF-1",
      invitationUrl: "https://example.invalid/invitation/institution/token", registrationMode: "INDIVIDUAL_SELF", quota: 5 });
    expect(message).toContain("Setiap asatidz mengisi data dirinya sendiri");
    expect(message).toContain("Tautan dapat dipakai berulang");
    expect(message).toContain("menunggu persetujuan admin");
  });
  it("pesan undangan perorangan tidak memakai teks perwakilan lembaga", () => {
    const message = buildInvitationShareText({ institutionName: "Ustadz Ahmad", recipientType: "INDIVIDUAL",
      eventName: "Daurah Uji", invitationNumber: "PR-01", invitationUrl: "https://example.invalid/invitation/individual/token" });
    expect(message).toContain("mengundang Anda secara pribadi");
    expect(message).toContain("hanya untuk satu asatidz");
    expect(message).not.toContain("perwakilan lembaga");
  });
});
