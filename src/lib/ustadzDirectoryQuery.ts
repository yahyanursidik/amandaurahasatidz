export function updateUstadzDirectoryQuery(current: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(current);
  if (!value || value === "ALL" || key === "page" && value === "1") next.delete(key);
  else next.set(key, value);
  if (key !== "page") next.delete("page");
  return next;
}
