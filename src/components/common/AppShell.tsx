import React, { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "./Header";
import { flattenSidebarNavItems, Sidebar, SidebarNavItem } from "./Sidebar";
import { MobileNavigation } from "./MobileNavigation";
import { AppFooter } from "./AppFooter";

export interface AppShellProps {
  portalName: string;
  badgeLabel: string;
  badgeColorClass?: string;
  navItems: SidebarNavItem[];
  enableCommandMenu?: boolean;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  portalName,
  badgeLabel,
  badgeColorClass,
  navItems,
  enableCommandMenu = false,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [activeResult, setActiveResult] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const printReportMode = location.pathname.includes("/attendance/") && location.pathname.endsWith("/report");

  const commandItems = useMemo(() => flattenSidebarNavItems(navItems), [navItems]);
  const filteredCommandItems = useMemo(() => {
    const normalizedQuery = commandQuery.trim().toLocaleLowerCase("id-ID");
    if (!normalizedQuery) return commandItems;
    return commandItems.filter((item) =>
      [item.label, item.parentLabel, item.description, ...item.keywords]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(normalizedQuery),
    );
  }, [commandItems, commandQuery]);

  const openCommandMenu = () => {
    if (!enableCommandMenu) return;
    setCommandQuery("");
    setActiveResult(0);
    setCommandOpen(true);
    dialogRef.current?.showModal();
    window.requestAnimationFrame(() => commandInputRef.current?.focus());
  };

  const closeCommandMenu = () => {
    dialogRef.current?.close();
    setCommandOpen(false);
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (shellRef.current) shellRef.current.inert = commandOpen;
  }, [commandOpen]);

  useEffect(() => {
    if (!enableCommandMenu) return;
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        if (dialogRef.current?.open) closeCommandMenu();
        else openCommandMenu();
      }
    };
    const onExternalOpen = () => openCommandMenu();
    window.addEventListener("keydown", onShortcut);
    window.addEventListener("open-admin-command-menu", onExternalOpen);
    return () => {
      window.removeEventListener("keydown", onShortcut);
      window.removeEventListener("open-admin-command-menu", onExternalOpen);
    };
  }, [enableCommandMenu]);

  useEffect(() => {
    if (activeResult >= filteredCommandItems.length) setActiveResult(0);
  }, [activeResult, filteredCommandItems.length]);

  const openCommandItem = (index: number) => {
    const item = filteredCommandItems[index];
    if (!item) return;
    closeCommandMenu();
    navigate(item.href);
  };

  return (
    <>
      <div
        ref={shellRef}
        className={`flex min-h-screen flex-col bg-slate-50 pb-16 text-slate-900 md:pb-0 ${printReportMode ? "print-report-shell" : ""}`}
      >
        <Header
          portalName={portalName}
          badgeLabel={badgeLabel}
          badgeColorClass={badgeColorClass}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          mobileMenuOpen={mobileMenuOpen}
        />

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-20 md:hidden" aria-modal="true" role="dialog" aria-label="Menu navigasi">
            <button
              type="button"
              aria-label="Tutup menu"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-slate-950/50"
            />
            <div className="absolute bottom-0 left-0 top-16 w-[min(22rem,92%)] border-r border-slate-200 bg-white shadow-2xl">
              <Sidebar
                items={navItems}
                mobile
                onNavigate={() => setMobileMenuOpen(false)}
                onSearchOpen={enableCommandMenu ? openCommandMenu : undefined}
              />
            </div>
          </div>
        )}

        <div className="flex w-full flex-1">
          <Sidebar items={navItems} onSearchOpen={enableCommandMenu ? openCommandMenu : undefined} />

          <main className="min-h-[calc(100dvh-4rem)] min-w-0 flex-1 bg-slate-50 p-4 sm:p-5 lg:p-6 xl:p-8">
            <div className="min-w-0">{children}</div>
          </main>
        </div>

        <AppFooter className="flex flex-col items-center justify-center gap-1 border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500 sm:flex-row sm:gap-2" />
        <MobileNavigation items={navItems} />
      </div>

      {enableCommandMenu && (
        <dialog
          ref={dialogRef}
          className="admin-command"
          aria-labelledby="admin-command-title"
          onClose={() => setCommandOpen(false)}
          onClick={(event) => {
            if (event.target === dialogRef.current) closeCommandMenu();
          }}
        >
          <div className="admin-command__panel">
            <div className="admin-command__field">
              <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
              <label id="admin-command-title" className="sr-only" htmlFor="admin-command-input">
                Cari menu dan fitur admin
              </label>
              <input
                id="admin-command-input"
                ref={commandInputRef}
                value={commandQuery}
                onChange={(event) => {
                  setCommandQuery(event.target.value);
                  setActiveResult(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveResult((current) => Math.min(current + 1, filteredCommandItems.length - 1));
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveResult((current) => Math.max(current - 1, 0));
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    openCommandItem(activeResult);
                  }
                }}
                placeholder="Cari event, absensi, lembaga, asatidz…"
                autoComplete="off"
              />
              <button type="button" onClick={closeCommandMenu} aria-label="Tutup pencarian">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="admin-command__results" role="listbox" aria-label="Hasil pencarian menu">
              {filteredCommandItems.length > 0 ? (
                filteredCommandItems.map((item, index) => (
                  <button
                    type="button"
                    key={item.href}
                    role="option"
                    aria-selected={activeResult === index}
                    className={activeResult === index ? "is-active" : undefined}
                    onMouseEnter={() => setActiveResult(index)}
                    onClick={() => openCommandItem(index)}
                  >
                    <span className="admin-command__icon" aria-hidden="true">{item.icon}</span>
                    <span className="min-w-0 flex-1 text-left">
                      <strong>{item.label}</strong>
                      <small>{item.parentLabel || item.description || "Portal Super Admin"}</small>
                    </span>
                    {activeResult === index && <CornerDownLeft className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  </button>
                ))
              ) : (
                <div className="admin-command__empty">
                  <strong>Menu tidak ditemukan</strong>
                  <span>Coba kata “absensi”, “undangan”, “lembaga”, atau “panitia”.</span>
                </div>
              )}
            </div>

            <div className="admin-command__footer" aria-hidden="true">
              <span><kbd>↑</kbd><kbd>↓</kbd> pilih</span>
              <span><kbd>Enter</kbd> buka</span>
              <span><kbd>Esc</kbd> tutup</span>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
};

declare global {
  interface WindowEventMap {
    "open-admin-command-menu": Event;
  }
}
