export type ParsedParticipantRow = {
  fullName: string;
  email: string;
  whatsapp: string;
  phone: string;
  institutionCode: string;
  institutionName: string;
  isDelegationLead: boolean;
  approvalStatus: string;
  participantCode: string;
  address: string;
  notes: string;
};

const parseCsvRecords = (content: string): string[][] => {
  const records: string[][] = [];
  let cells: string[] = [];
  let current = "";
  let quoted = false;
  const source = content.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (quoted || current.length === 0) {
        quoted = !quoted;
      } else {
        throw new Error(`Format tanda petik CSV tidak valid pada baris ${records.length + 1}.`);
      }
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      cells.push(current.trim());
      if (cells.some(Boolean)) records.push(cells);
      cells = [];
      current = "";
    } else {
      current += char;
    }
  }
  if (quoted) throw new Error("Tanda petik CSV belum ditutup. Periksa file peserta.");
  cells.push(current.trim());
  if (cells.some(Boolean)) records.push(cells);
  return records;
};

const parseBooleanCell = (value: string) => ["true", "ya", "yes", "1", "lead", "pic"].includes(value.trim().toLowerCase());

export const parseParticipantCsv = (content: string): ParsedParticipantRow[] => {
  const records = parseCsvRecords(content);
  if (records.length < 2) return [];
  const headers = records[0].map((header) => header.trim());
  if (!headers.includes("fullName") && !headers.includes("nama")) {
    throw new Error("Kolom fullName wajib ada. Gunakan template peserta yang disediakan.");
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error("Nama kolom CSV tidak boleh berulang.");
  }
  if (records.length - 1 > 500) {
    throw new Error("Maksimal 500 peserta per unggahan. Pecah file menjadi beberapa bagian.");
  }
  return records.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`Jumlah kolom pada baris ${index + 2} tidak sesuai header.`);
    }
    const record = Object.fromEntries(headers.map((header, column) => [header, values[column] || ""]));
    return {
      fullName: record.fullName || record.nama || "",
      email: record.email || "",
      whatsapp: record.whatsapp || record.wa || "",
      phone: record.phone || record.telepon || "",
      institutionCode: record.institutionCode || record.kodeLembaga || "",
      institutionName: record.institutionName || record.namaLembaga || "",
      isDelegationLead: parseBooleanCell(record.isDelegationLead || record.pic || ""),
      approvalStatus: (record.approvalStatus || "PENDING_REVIEW").trim().toUpperCase(),
      participantCode: record.participantCode || record.kodePeserta || "",
      address: record.address || record.alamat || "",
      notes: record.notes || record.catatan || "",
    };
  });
};
