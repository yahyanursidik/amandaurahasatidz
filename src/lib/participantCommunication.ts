export type CommunicationSenderRole = "admin" | "committee";

export type ParticipantContact = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  participantCode?: string | null;
  institutionName?: string | null;
  approvalStatus?: string | null;
  confirmationStatus?: string | null;
};

export type ParticipantEventContext = {
  name?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  publicUrl?: string | null;
};

export type CommunicationTemplateId =
  | "PROFILE_GREETING"
  | "EVENT_INVITATION"
  | "REGULAR_REGISTRATION"
  | "REGISTRATION_CONFIRMATION"
  | "COMPLETE_DATA"
  | "ATTENDANCE_CONFIRMATION"
  | "EVENT_REMINDER"
  | "SCHEDULE_CHANGE"
  | "CHECKIN_INFO"
  | "APPROVAL_STATUS"
  | "POST_EVENT"
  | "CUSTOM";

export type CommunicationTemplate = {
  id: CommunicationTemplateId;
  label: string;
  description: string;
};

export const PARTICIPANT_COMMUNICATION_TEMPLATES: CommunicationTemplate[] = [
  { id: "PROFILE_GREETING", label: "Sapaan asatidz", description: "Sapaan umum dari direktori, tanpa menganggap penerima sudah terdaftar pada suatu event." },
  { id: "EVENT_INVITATION", label: "Undangan event", description: "Undangan pribadi; tautan khusus lembaga hanya dibagikan melalui menu undangan." },
  { id: "REGULAR_REGISTRATION", label: "Pendaftaran reguler", description: "Informasi pendaftaran melalui halaman resmi program." },
  {
    id: "REGISTRATION_CONFIRMATION",
    label: "Konfirmasi pendaftaran",
    description: "Memastikan data peserta sudah diterima panitia.",
  },
  {
    id: "COMPLETE_DATA",
    label: "Lengkapi data",
    description: "Meminta data kontak atau alamat yang masih kosong.",
  },
  {
    id: "ATTENDANCE_CONFIRMATION",
    label: "Konfirmasi kehadiran",
    description: "Meminta jawaban hadir atau berhalangan.",
  },
  {
    id: "EVENT_REMINDER",
    label: "Pengingat event",
    description: "Mengingatkan jadwal dan lokasi pelaksanaan.",
  },
  {
    id: "SCHEDULE_CHANGE",
    label: "Perubahan jadwal/lokasi",
    description: "Mengarahkan peserta memeriksa informasi terbaru.",
  },
  {
    id: "CHECKIN_INFO",
    label: "Informasi check-in",
    description: "Menyampaikan kode peserta dan arahan registrasi ulang.",
  },
  {
    id: "APPROVAL_STATUS",
    label: "Status persetujuan",
    description: "Mengabarkan hasil peninjauan pendaftaran.",
  },
  {
    id: "POST_EVENT",
    label: "Tindak lanjut pasca-event",
    description: "Ucapan terima kasih dan informasi lanjutan.",
  },
  {
    id: "CUSTOM",
    label: "Pesan khusus",
    description: "Draf sopan untuk kebutuhan operasional lain.",
  },
];

const statusLabels: Record<string, string> = {
  APPROVED: "disetujui",
  PENDING_REVIEW: "masih dalam peninjauan",
  WAITLISTED: "masuk daftar tunggu",
  DECLINED: "belum dapat disetujui",
  CONFIRMED: "terkonfirmasi",
  INVITED: "menunggu konfirmasi",
  CANCELLED: "dibatalkan",
};

const cleanLine = (value?: string | null) => String(value || "").trim();

const formatDate = (value?: string | null) => {
  const clean = cleanLine(value);
  if (!clean) return "";
  const parsed = new Date(clean.length === 10 ? `${clean}T00:00:00` : clean);
  if (Number.isNaN(parsed.getTime())) return clean;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
};

const eventSummary = (event?: ParticipantEventContext) => {
  const name = cleanLine(event?.name) || "event daurah";
  const start = formatDate(event?.startDate);
  const end = formatDate(event?.endDate);
  const date = start && end && start !== end ? `${start}–${end}` : start || end;
  const venue = [cleanLine(event?.venueName), cleanLine(event?.venueAddress)].filter(Boolean).join(", ");
  return { name, date, venue };
};

export function normalizeWhatsAppNumber(value?: string | null): string | null {
  const raw = cleanLine(value);
  if (!raw) return null;

  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;

  if (!/^[1-9]\d{8,14}$/.test(digits)) return null;
  return digits;
}

export function getParticipantWhatsAppNumber(participant: ParticipantContact) {
  return normalizeWhatsAppNumber(participant.whatsapp || participant.phone);
}

export function getMissingParticipantContactFields(participant: ParticipantContact) {
  const missing: string[] = [];
  if (!getParticipantWhatsAppNumber(participant)) missing.push("nomor WhatsApp");
  if (!cleanLine(participant.email)) missing.push("alamat email");
  if (!cleanLine(participant.address)) missing.push("alamat domisili");
  return missing;
}

export function buildParticipantMessage(
  templateId: CommunicationTemplateId,
  context: {
    participant: ParticipantContact;
    senderRole: CommunicationSenderRole;
    senderName?: string;
    event?: ParticipantEventContext;
  },
) {
  const { participant, senderRole, senderName, event } = context;
  const roleLabel = senderRole === "committee" ? "Panitia Aman Daurah Asatidz" : "Admin Aman Daurah Asatidz";
  const identity = cleanLine(senderName)
    ? `${cleanLine(senderName)} dari ${roleLabel}`
    : roleLabel;
  const participantName = cleanLine(participant.name) || "Ustadz";
  const greeting = `Assalamu’alaikum warahmatullahi wabarakatuh, ${participantName}${/[.!?]$/.test(participantName) ? "" : "."}`;
  const introduction = `Perkenalkan, saya ${identity}.`;
  const eventInfo = eventSummary(event);
  const missing = getMissingParticipantContactFields(participant);
  const approval = statusLabels[cleanLine(participant.approvalStatus)] || cleanLine(participant.approvalStatus).toLowerCase();

  const bodies: Record<CommunicationTemplateId, string> = {
    PROFILE_GREETING:
      "Semoga antum senantiasa dalam keadaan sehat. Kami dari Tarbiyah Sunnah ingin menjaga silaturahmi dan berbagi informasi program daurah mendatang. Silakan kabari bila data kontak antum perlu diperbarui.",
    EVENT_INVITATION:
      `Kami mengundang antum mengikuti ${eventInfo.name}${eventInfo.date ? ` pada ${eventInfo.date}` : ""}${eventInfo.venue ? ` di ${eventInfo.venue}` : ""}. ` +
      `Informasi resmi: ${cleanLine(event?.publicUrl) || "hubungi panitia"}. ` +
      `Jika antum menerima undangan lembaga, gunakan tautan khusus yang disampaikan secara pribadi oleh panitia.`,
    REGULAR_REGISTRATION:
      `Kami menginformasikan pendaftaran reguler ${eventInfo.name}${eventInfo.date ? ` pada ${eventInfo.date}` : ""}. ` +
      `Lihat syarat dan status pendaftaran di ${cleanLine(event?.publicUrl) || "halaman program resmi"}. ` +
      `Bila jalur reguler belum dibuka, tunggu pengumuman panitia.`,
    REGISTRATION_CONFIRMATION:
      `Data pendaftaran antum untuk ${eventInfo.name} telah kami terima` +
      `${participant.institutionName ? ` melalui ${participant.institutionName}` : ""}. ` +
      `Mohon konfirmasi apabila nama, lembaga, atau data kontak yang tercatat perlu diperbaiki.`,
    COMPLETE_DATA:
      missing.length > 0
        ? `Untuk melengkapi data peserta ${eventInfo.name}, kami masih memerlukan ${missing.join(", ")}. ` +
          `Mohon kirimkan data tersebut melalui balasan pesan ini.`
        : `Data utama antum untuk ${eventInfo.name} sudah lengkap. Mohon kabari kami apabila ada perubahan nomor WhatsApp, email, atau alamat domisili.`,
    ATTENDANCE_CONFIRMATION:
      `Mohon konfirmasi apakah antum dapat menghadiri ${eventInfo.name}` +
      `${eventInfo.date ? ` pada ${eventInfo.date}` : ""}. Balas “HADIR” atau “BERHALANGAN” agar data panitia dapat kami perbarui.`,
    EVENT_REMINDER:
      `Kami mengingatkan pelaksanaan ${eventInfo.name}` +
      `${eventInfo.date ? ` pada ${eventInfo.date}` : ""}` +
      `${eventInfo.venue ? ` di ${eventInfo.venue}` : ""}. Mohon menyiapkan kode peserta dan hadir sesuai waktu registrasi ulang.`,
    SCHEDULE_CHANGE:
      `Terdapat pembaruan informasi jadwal atau lokasi ${eventInfo.name}. ` +
      `Mohon memeriksa pengumuman terbaru pada portal peserta atau menghubungi panitia apabila membutuhkan penjelasan.`,
    CHECKIN_INFO:
      `Untuk proses check-in ${eventInfo.name}, tunjukkan kode peserta ` +
      `${cleanLine(participant.participantCode) || "[kode peserta]"} kepada petugas. Check-in tetap dilakukan per individu, termasuk bagi delegasi lembaga.`,
    APPROVAL_STATUS:
      approval
        ? `Status pendaftaran antum untuk ${eventInfo.name} saat ini ${approval}. Mohon hubungi kami apabila ada data pendukung yang perlu ditambahkan.`
        : `Status pendaftaran antum untuk ${eventInfo.name} telah diperbarui. Mohon membuka portal peserta untuk melihat rinciannya.`,
    POST_EVENT:
      `Jazakumullahu khairan atas partisipasi antum dalam ${eventInfo.name}. ` +
      `Informasi materi, sertifikat, atau tindak lanjut akan disampaikan melalui kanal resmi panitia.`,
    CUSTOM:
      `Kami menghubungi antum terkait ${eventInfo.name}. Silakan sunting bagian ini sesuai kebutuhan komunikasi operasional sebelum pesan dikirim.`,
  };

  return [
    greeting,
    "",
    introduction,
    "",
    bodies[templateId],
    "",
    "Jazakumullahu khairan.",
    "Wassalamu’alaikum warahmatullahi wabarakatuh.",
  ].join("\n");
}

export function buildWhatsAppUrl(number: string, message: string) {
  const normalized = normalizeWhatsAppNumber(number);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildParticipantEmailUrl(
  email: string,
  subject: string,
  message: string,
) {
  const normalizedEmail = cleanLine(email);
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return null;
  return `mailto:${normalizedEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
