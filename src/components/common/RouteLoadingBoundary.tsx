import React, { Suspense } from "react";
import { Link, useLocation } from "react-router-dom";

export const RouteLoadingFallback: React.FC = () => (
  <div className="flex min-h-[50vh] items-center justify-center p-8 text-slate-600"
    role="status" aria-live="polite" aria-atomic="true">
    <span>Memuat halaman…</span>
  </div>
);

type RouteErrorBoundaryProps = { children: React.ReactNode; resetKey: string };
type RouteErrorBoundaryState = { hasError: boolean; resetKey: string };

export class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<RouteErrorBoundaryState> {
    return { hasError: true };
  }

  static getDerivedStateFromProps(props: RouteErrorBoundaryProps, state: RouteErrorBoundaryState) {
    // Clear a failed route on navigation without remounting healthy pages.
    return props.resetKey !== state.resetKey ? { hasError: false, resetKey: props.resetKey } : null;
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    // A rejected lazy import is cached by React (and possibly the browser).
    // Reload only on explicit user action; never retry/reload automatically.
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-slate-900">
        <div role="alert">
          <h1 className="text-xl font-bold">Halaman tidak dapat dimuat</h1>
          <p className="mt-2 text-sm text-slate-600">
            Koneksi mungkin terputus atau aplikasi telah diperbarui. Periksa koneksi Anda,
            lalu muat ulang halaman. Data yang belum disimpan mungkin hilang.
          </p>
        </div>
        <button type="button" onClick={() => window.location.reload()}
          className="min-h-[44px] rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
          Muat ulang halaman
        </button>
        <Link to="/programs" className="block text-sm font-bold text-emerald-800 underline">
          Kembali ke daftar program
        </Link>
      </div>
    );
  }
}

export const RouteLoadingBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  return (
    <RouteErrorBoundary resetKey={location.key}>
      <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
};