/** Only same-origin private status links from the registration API may be shared. */
export function registrationStatusHref(value: string | null | undefined, origin: string) {
  if (!value) return null;
  try {
    const url = new URL(value, origin);
    return url.origin === new URL(origin).origin && !url.username && !url.password &&
      url.pathname === "/confirm" && !url.search && /^#(?:pcf|prc)_[\w-]+\.[\w-]+$/.test(url.hash) ? url.toString() : null;
  } catch { return null; }
}

export function registrationReceiptHref(value: string | null | undefined, origin: string) {
  const url = registrationStatusHref(value, origin);
  return url && new URL(url).hash.startsWith("#prc_") ? url : null;
}
