export function updateUstadzDirectoryQuery(current: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(current);
  if (!value || value === "ALL" || key === "page" && value === "1") next.delete(key);
  else next.set(key, value);
  if (key === "profileStatus" && value === "ARCHIVED") { next.delete("quality"); next.delete("duplicate"); next.delete("participation"); }
  if (["quality", "duplicate", "participation"].includes(key) && value && next.get("profileStatus") === "ARCHIVED") next.delete("profileStatus");
  if (key !== "page") next.delete("page");
  return next;
}
