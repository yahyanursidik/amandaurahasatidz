const zones: Record<string, { label: string; offset: string }> = {
  "Asia/Jakarta": { label: "WIB", offset: "+07:00" },
  "Asia/Makassar": { label: "WITA", offset: "+08:00" },
  "Asia/Jayapura": { label: "WIT", offset: "+09:00" },
};

export const eventTimezoneLabel = (timezone: string) => zones[timezone]?.label || timezone;

export const toEventIso = (localValue: string | null | undefined, timezone: string): string | null => {
  if (!localValue) return null;
  const offset = zones[timezone]?.offset || zones["Asia/Jakarta"].offset;
  return new Date(`${localValue.length === 16 ? `${localValue}:00` : localValue}${offset}`).toISOString();
};

export const fromEventIso = (value: string | null | undefined, timezone: string): string => {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zones[timezone] ? timezone : "Asia/Jakarta",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((item) => item.type === name)?.value || "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

export const formatEventTime = (value: string, timezone: string): string =>
  new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit", minute: "2-digit", timeZone: zones[timezone] ? timezone : "Asia/Jakarta",
  }).format(new Date(value));

export const formatEventDate = (dateOnly: string): string =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${dateOnly}T00:00:00Z`));

export const formatEventDateTime = (value: string, timezone: string): string =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: zones[timezone] ? timezone : "Asia/Jakarta",
  }).format(new Date(value));
