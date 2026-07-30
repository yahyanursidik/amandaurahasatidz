export function normalizeName(fullName: string): string {
  if (!fullName) return "";
  let clean = fullName.trim().toLowerCase();

  // Remove titles like Ust., Ustadz, Dr., Lc., M.A., Prof., K.H., H.
  clean = clean.replace(/\b(ust|ustadz|dr|lc|m\.a|ma|prof|k\.h|kh|h|haji)\b\.?/gi, "");
  // Remove non-alphanumeric characters except spaces
  clean = clean.replace(/[^a-z0-9\s]/gi, " ");
  // Collapse multiple spaces
  clean = clean.replace(/\s+/g, " ").trim();

  return clean;
}

export function normalizeEmail(email?: string | null): string | null {
  if (!email || email.trim() === "") return null;
  return email.trim().toLowerCase();
}

export function normalizePhone(phone?: string | null): string | null {
  if (!phone || phone.trim() === "") return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.substring(1);
  }
  return digits || null;
}
