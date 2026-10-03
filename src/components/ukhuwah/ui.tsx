import { useEffect, useRef, useState, type ReactNode } from "react";
import { eventApi } from "@/lib/eventApi";
import { registerProfilePopHandler } from "@/lib/portalNavigationGuard";

export const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed";
export const primary = `${button} !border-emerald-800 !bg-emerald-800 !text-white hover:!bg-emerald-900`;
export const field = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-60";
export const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";
export const messageOf = (error: unknown) => error instanceof Error ? error.message : "Permintaan gagal. Silakan coba lagi.";

export function api<T>(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  try { const token = window.localStorage.getItem("yts_auth_token"); if (token) headers.set("Authorization", token); } catch { /* Cookie auth remains available. */ }
  return eventApi<T>(path, { ...options, cache: "no-store", headers: Object.fromEntries(headers.entries()) });
}
export function useResource<T>(path: string | null, refresh = 0) {
  const key = `${path}:${refresh}`;
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>({ key, loading: !!path });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!path) { setState({ key, loading: false }); return; }
    const controller = new AbortController(); let active = true;
    setState({ key, loading: true });
    void api<T>(path, { signal: controller.signal }).then(data => { if (active) setState({ key, data, loading: false }); }, error => { if (active && !controller.signal.aborted) setState({ key, error: messageOf(error), loading: false }); });
    return () => { active = false; controller.abort(); };
  }, [key, path, attempt]);
  return { ...(state.key === key ? state : { key, loading: !!path }), retry: () => setAttempt(n => n + 1) };
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div role={error ? "alert" : "status"} className={`rounded-lg border p-4 text-sm leading-6 ${error ? "border-rose-200 bg-rose-50 text-rose-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>{children}</div>;
}
export function ResourceState({ resource }: { resource: { loading: boolean; error?: string; retry: () => void } }) {
  if (resource.loading) return <p role="status" className="p-4 text-slate-600">Memuat…</p>;
  if (resource.error) return <Notice error><p>{resource.error}</p><button className={`${button} mt-3`} onClick={resource.retry}>Coba muat ulang</button></Notice>;
  return null;
}
export function TextBody({ children }: { children: ReactNode }) { return <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">{children}</div>; }
export function Label({ name, children }: { name: string; children: ReactNode }) { return <label className="block space-y-1 text-sm font-semibold text-slate-700"><span>{name}</span>{children}</label>; }

/** Capture links including layout navigation and protect browser Back/Forward and reload. */
export function useDirtyGuard(dirty: boolean, busy = false) {
  const live = useRef({ dirty, busy }); live.current = { dirty, busy };
  useEffect(() => {
    let index = window.history.state?.idx as number | undefined; let restoring = false;
    const leave = () => !live.current.busy && (!live.current.dirty || window.confirm("Perubahan belum disimpan. Tinggalkan halaman dan buang perubahan?"));
    const unload = (event: BeforeUnloadEvent) => { if (live.current.dirty || live.current.busy) { event.preventDefault(); event.returnValue = ""; } };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element;
      const link = target.closest?.("a[href]") as HTMLAnchorElement | null;
      const logout = target.closest?.("button")?.textContent?.trim() === "Keluar";
      const internalSwitch = !!target.closest?.("[data-ukhuwah-navigation]");
      if (!logout && !internalSwitch && (!link || link.target === "_blank" || link.hasAttribute("download") || link.href === window.location.href)) return;
      if (!leave()) { event.preventDefault(); event.stopPropagation(); }
    };
    const unregister = registerProfilePopHandler(event => {
      if (restoring) { restoring = false; event.stopImmediatePropagation(); return; }
      const next = event.state?.idx as number | undefined;
      if (!leave() && typeof index === "number" && typeof next === "number" && index !== next) { event.stopImmediatePropagation(); restoring = true; window.history.go(index - next); return; }
      index = next;
    });
    const navigation = (event: Event) => { if (!leave()) event.preventDefault(); };
    document.addEventListener("click", click, true); window.addEventListener("beforeunload", unload);
    window.addEventListener("portal-before-navigate", navigation);
    return () => { unregister(); document.removeEventListener("click", click, true); window.removeEventListener("beforeunload", unload); window.removeEventListener("portal-before-navigate", navigation); };
  }, []);
}