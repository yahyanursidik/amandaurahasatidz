// Eagerly loaded by main.tsx before BrowserRouter. Lazy profile editors can then
// register a handler without racing the router's earlier window event listener.
let activeHandler: ((event: PopStateEvent) => void) | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", (event) => activeHandler?.(event), true);
}

export function registerProfilePopHandler(handler: (event: PopStateEvent) => void) {
  activeHandler = handler;
  return () => { if (activeHandler === handler) activeHandler = null; };
}