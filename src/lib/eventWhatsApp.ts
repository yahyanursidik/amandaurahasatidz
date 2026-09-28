import { normalizeWhatsAppNumber } from "./participantCommunication";

export type EventWhatsAppType = "INVITATION" | "REGULAR";

export type EventWhatsAppContext = {
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  venueName?: string | null;
  status: string;
  audienceMode?: string | null;
};

const dateLabel = (value: string) => {
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long", timeZone: "Asia/Jakarta",
  }).format(date);
};

export function buildEventWhatsAppMessage(type: EventWhatsAppType, event: EventWhatsAppContext, origin: string) {
  const dates = event.startDate === event.endDate ? dateLabel(event.startDate)
    : `${dateLabel(event.startDate)}–${dateLabel(event.endDate)}`;
  const publicUrl = `${origin.replace(/\/$/, "")}/events/${encodeURIComponent(event.slug)}`;
  const regularOpen = event.status === "REGISTRATION_OPEN" && ["PUBLIC_OPEN", "MIXED"].includes(event.audienceMode || "");
  const body = type === "INVITATION"
    ? "Kami mengundang Ustadz/Ustadzah untuk mengikuti program ini. Untuk pendaftaran jalur undangan, mohon gunakan tautan pribadi yang diberikan panitia. Tautan khusus dan kode akses tidak boleh diteruskan kepada pihak lain."
    : regularOpen
      ? `Pendaftaran reguler sedang dibuka. Silakan membaca ketentuan dan mendaftar melalui: ${publicUrl}/register`
      : "Informasi pendaftaran reguler dan ketersediaan kuota dapat diperiksa pada halaman program.";
  return [
    "Assalamu'alaikum warahmatullahi wabarakatuh.", "",
    `Informasi ${type === "INVITATION" ? "undangan" : "pendaftaran reguler"} ${event.name}.`,
    `Waktu: ${dates} (WIB).`,
    `Lokasi: ${event.venueName?.trim() || "menyusul dari panitia"}.`, "",
    body, "", `Informasi resmi program: ${publicUrl}`, "",
    "Jazakumullahu khairan.", "Panitia Daurah Asatidz · Tarbiyah Sunnah",
  ].join("\n");
}

export function buildEventWhatsAppUrl(message: string, phone?: string | null): string | null {
  const raw = phone?.trim() || "";
  const recipient = raw ? normalizeWhatsAppNumber(raw) : null;
  if (raw && !recipient) return null;
  return `https://wa.me/${recipient || ""}?text=${encodeURIComponent(message)}`;
}
