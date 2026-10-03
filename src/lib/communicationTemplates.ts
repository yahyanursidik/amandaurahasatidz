/** Shared by the editor and API. Messages are plain text, never executable HTML. */
export const COMMUNICATION_VARIABLES = [
  { key: "eventName", label: "Nama daurah" },
  { key: "eventDates", label: "Tanggal daurah" },
  { key: "eventVenue", label: "Lokasi daurah" },
  { key: "portalLink", label: "Tautan portal peserta" },
  { key: "ustadzName", label: "Nama peserta" },
  { key: "participantCode", label: "Kode peserta" },
  { key: "institutionName", label: "Nama lembaga" },
] as const;

export type CommunicationTemplate = {
  id: string;
  name: string;
  category: string;
  description?: string;
  title: string;
  emailSubject: string;
  body: string;
  audienceType: string;
  sendEmailNotification: boolean;
};

const greeting = "Assalamu'alaikum warahmatullahi wabarakatuh,\n\nYth. {{ustadzName}},\n\n";
const closing = "\n\nInformasi dan status pribadi dapat dilihat di {{portalLink}}.\n\nJazakumullah khairan,\nPanitia {{eventName}}";

function template(id: string, name: string, category: string, description: string, title: string, message: string, audienceType = "ALL_PARTICIPANTS"): CommunicationTemplate {
  return { id: `builtin-${id}`, name, category, description, title, emailSubject: `${title} — {{eventName}}`, body: greeting + message + closing, audienceType, sendEmailNotification: true };
}

export const BUILTIN_COMMUNICATION_TEMPLATES: CommunicationTemplate[] = [
  template("invitation", "Undangan peserta", "Pendaftaran", "Mengajak peserta mengikuti daurah dan meninjau informasi kegiatan.", "Undangan mengikuti daurah", "Kami mengundang Ustadz untuk mengikuti {{eventName}} pada {{eventDates}}.\nLokasi: {{eventVenue}}.\n\nMohon periksa informasi dan status kepesertaan melalui portal. Undangan ini tidak menggantikan persetujuan kepesertaan oleh panitia."),
  template("confirmation", "Pengingat konfirmasi", "Pendaftaran", "Untuk peserta yang masih berstatus diundang dan belum mengonfirmasi.", "Mohon konfirmasi keikutsertaan", "Mohon meninjau dan mengonfirmasi keikutsertaan pada {{eventName}} melalui portal.\nTanggal: {{eventDates}}.\nLokasi: {{eventVenue}}.\n\nBatas konfirmasi: [ISI: batas tanggal dan waktu konfirmasi].\nJika berhalangan, mohon informasikan kepada panitia agar kuota dapat dikelola dengan baik.", "UNCONFIRMED_ONLY"),
  template("approved", "Informasi peserta disetujui", "Pendaftaran", "Informasi operasional untuk peserta yang telah disetujui; tidak mengubah status peserta.", "Informasi untuk peserta disetujui", "Pesan ini ditujukan kepada peserta yang telah disetujui untuk {{eventName}}.\nKode peserta Ustadz: {{participantCode}}.\nTanggal: {{eventDates}}.\nLokasi: {{eventVenue}}.\n\nSilakan periksa kartu peserta dan QR pribadi pada portal. Jangan membagikan QR kepada orang lain.", "APPROVED_ONLY"),
  template("reminder", "Pengingat menjelang daurah", "Persiapan", "Pengingat tanggal, lokasi, dan kartu peserta.", "Pengingat pelaksanaan daurah", "Insya Allah {{eventName}} dilaksanakan pada {{eventDates}} di {{eventVenue}}.\n\nMohon mempersiapkan perjalanan dan menyimpan kartu peserta/QR pribadi dari portal.\nWaktu registrasi kedatangan: [ISI: waktu registrasi dan zona waktu].\nKode peserta: {{participantCode}}.", "APPROVED_ONLY"),
  template("preparation", "Perlengkapan dan tata tertib", "Persiapan", "Daftar kebutuhan, pakaian, dan adab mengikuti daurah.", "Persiapan dan tata tertib peserta", "Untuk kelancaran {{eventName}}, mohon memperhatikan:\n\nPerlengkapan: [ISI: daftar perlengkapan yang perlu dibawa].\nKetentuan pakaian: [ISI: ketentuan pakaian].\nTata tertib: [ISI: tata tertib kegiatan].\n\nMohon hadir tepat waktu dan menjaga adab majelis serta kenyamanan peserta lainnya.", "APPROVED_ONLY"),
  template("arrival", "Registrasi kedatangan dan QR", "Pelaksanaan", "Panduan kedatangan, meja registrasi, dan QR pribadi.", "Panduan registrasi kedatangan", "Lokasi {{eventName}}: {{eventVenue}}.\nMeja registrasi: [ISI: lokasi meja registrasi].\nWaktu registrasi: [ISI: waktu dan zona waktu].\n\nSiapkan kartu peserta/QR pribadi melalui portal. Kode peserta: {{participantCode}}.\nKehadiran dicatat per individu sesuai hari atau sesi yang diwajibkan.", "APPROVED_ONLY"),
  template("schedule-change", "Perubahan jadwal atau sesi", "Perubahan", "Pemberitahuan perubahan agenda dengan jadwal pengganti yang jelas.", "Perubahan jadwal daurah", "Terdapat perubahan agenda {{eventName}}:\n\nAgenda/sesi: [ISI: nama agenda atau sesi].\nJadwal sebelumnya: [ISI: jadwal lama].\nJadwal terbaru: [ISI: jadwal baru beserta zona waktu].\nKeterangan: [ISI: alasan atau informasi tambahan].\n\nMohon menggunakan jadwal terbaru dan memeriksa pembaruan pada portal."),
  template("venue-change", "Perubahan lokasi atau ruangan", "Perubahan", "Memberikan lokasi pengganti dan panduan menuju tempat baru.", "Perubahan lokasi kegiatan", "Lokasi/ruangan untuk {{eventName}} diperbarui:\n\nAgenda terkait: [ISI: agenda terkait].\nLokasi terbaru: [ISI: nama lokasi/ruangan dan alamat].\nPetunjuk menuju lokasi: [ISI: petunjuk atau tautan peta].\nMulai berlaku: [ISI: tanggal dan waktu perubahan].\n\nMohon mengikuti arahan panitia di lokasi."),
  template("transport", "Transportasi dan akomodasi", "Persiapan", "Informasi perjalanan, penjemputan, penginapan, dan narahubung.", "Informasi transportasi dan akomodasi", "Berikut informasi perjalanan untuk {{eventName}}:\n\nTransportasi/penjemputan: [ISI: informasi transportasi].\nAkomodasi: [ISI: informasi penginapan dan ketentuannya].\nNarahubung: [ISI: nama dan kontak panitia].\n\nMohon menghubungi panitia jika memerlukan penjelasan sebelum keberangkatan.", "APPROVED_ONLY"),
  template("urgent", "Pemberitahuan penting atau darurat", "Pelaksanaan", "Arahan operasional penting; email bukan pengganti kanal darurat langsung.", "Pemberitahuan penting untuk peserta", "Mohon perhatian Ustadz terhadap informasi penting berikut:\n\nSituasi: [ISI: informasi yang telah dikonfirmasi panitia].\nTindakan yang perlu dilakukan: [ISI: arahan konkret].\nLokasi/waktu terkait: [ISI: lokasi dan waktu].\nKontak panitia: [ISI: kontak yang dapat dihubungi].\n\nUntuk kondisi mendesak, ikuti arahan langsung panitia dan jangan hanya mengandalkan email."),
  template("materials", "Materi dan rekaman", "Tindak lanjut", "Membagikan materi resmi beserta batasan akses dan izin penggunaan.", "Materi dan rekaman daurah", "Materi {{eventName}} dapat diakses melalui:\n\n[ISI: tautan materi atau rekaman resmi].\n\nPetunjuk akses: [ISI: petunjuk akses].\nKetentuan penggunaan: [ISI: izin penggunaan dan pembagian materi].\n\nSemoga bermanfaat untuk murajaah dan pengembangan dakwah.", "ATTENDED_SPECIFIC_DAY"),
  template("evaluation", "Evaluasi dan masukan", "Tindak lanjut", "Mengundang peserta memberi masukan tanpa menjanjikan anonimitas.", "Mohon masukan untuk daurah", "Kami mengharapkan masukan Ustadz untuk meningkatkan penyelenggaraan {{eventName}}.\n\nFormulir evaluasi: [ISI: tautan formulir evaluasi].\nBatas pengisian: [ISI: batas tanggal dan waktu].\nKetentuan privasi: [ISI: penjelasan penggunaan data sesuai formulir].\n\nMasukan Ustadz sangat berarti bagi perbaikan kegiatan berikutnya.", "ATTENDED_SPECIFIC_DAY"),
  template("certificate", "Informasi sertifikat", "Tindak lanjut", "Petunjuk sertifikat tanpa menganggap semua peserta sudah memenuhi syarat.", "Informasi sertifikat daurah", "Informasi sertifikat {{eventName}}:\n\nSyarat penerbitan: [ISI: syarat kehadiran dan administrasi].\nCara memperoleh sertifikat: [ISI: tautan atau petunjuk pengambilan].\nPerbaikan data: [ISI: kontak dan batas pengajuan koreksi].\n\nMohon memeriksa nama dan data pribadi sebelum mengajukan penerbitan sertifikat."),
  template("thanks", "Ucapan terima kasih", "Tindak lanjut", "Apresiasi untuk peserta yang tercatat pernah hadir.", "Jazakumullah khairan atas kehadiran Ustadz", "Jazakumullah khairan atas kehadiran dan partisipasi Ustadz pada {{eventName}}.\n\nSemoga ilmu yang dipelajari dan silaturahmi yang terjalin membawa keberkahan bagi dakwah dan pendidikan.\n\nKami terbuka terhadap saran dan pengalaman Ustadz untuk penyelenggaraan kegiatan berikutnya.", "ATTENDED_SPECIFIC_DAY"),
  template("institution", "Koordinasi peserta lembaga", "Pendaftaran", "Pesan untuk peserta dari lembaga tertentu; pilih lembaga tujuan sebelum menyimpan.", "Informasi peserta lembaga", "Pesan ini ditujukan kepada peserta dari {{institutionName}} pada {{eventName}}.\n\n[ISI: informasi atau permintaan koordinasi untuk lembaga].\n\nKode pribadi Ustadz: {{participantCode}}. Mohon menjaga kerahasiaan kartu dan QR masing-masing peserta.", "SPECIFIC_INSTITUTION"),
];

/** Single pass avoids recursively expanding recipient-supplied values or special replacement strings. */
export function renderCommunicationText(text: string, variables: Record<string, string>): string {
  return text.replace(/{{\s*([^{}]+?)\s*}}/g, (placeholder, key: string) => {
    const name = key.trim();
    return Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : placeholder;
  });
}

export function findCommunicationVariables(...texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(/{{\s*([^{}]+?)\s*}}/g)) found.add(match[1].trim());
  }
  return [...found];
}

/** Includes editorial fields so a built-in cannot accidentally send unfinished instructions. */
export function getUnresolvedCommunicationVariables(texts: string[], variables: Record<string, string>): string[] {
  const allowed = new Set<string>(COMMUNICATION_VARIABLES.map(({ key }) => key));
  const unresolved = new Set(findCommunicationVariables(...texts).filter((key) => !allowed.has(key) || !Object.prototype.hasOwnProperty.call(variables, key) || !variables[key].trim()));
  for (const text of texts) {
    for (const match of text.matchAll(/\[ISI:[^\]]*(?:\]|$)/gi)) unresolved.add(match[0]);
    // A mistyped or unfinished placeholder must not silently disappear in a published message.
    const remainder = text.replace(/{{\s*([^{}]+?)\s*}}/g, "");
    if (remainder.includes("{{") || remainder.includes("}}")) unresolved.add("Placeholder tidak lengkap");
  }
  return [...unresolved];
}