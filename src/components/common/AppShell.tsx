import React, { useState } from "react";
import { Header } from "./Header";
import { Sidebar, SidebarNavItem } from "./Sidebar";
import { MobileNavigation } from "./MobileNavigation";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AppFooter } from "./AppFooter";

export interface AppShellProps {
  portalName: string;
  badgeLabel: string;
  badgeColorClass?: string;
  navItems: SidebarNavItem[];
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  portalName,
  badgeLabel,
  badgeColorClass,
  navItems,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 pb-16 text-slate-900 md:pb-0">
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
          <div className="absolute bottom-0 left-0 top-16 w-[min(20rem,88%)] border-r border-slate-200 bg-white shadow-2xl">
            <Sidebar items={navItems} mobile onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex w-full flex-1">
        <Sidebar items={navItems} />

        <main className="min-h-[calc(100dvh-4rem)] min-w-0 flex-1 bg-slate-50 p-4 sm:p-5 lg:p-6 xl:p-8">
          <div className="min-w-0">
            {children}
          </div>
        </main>
      </div>

      <AppFooter className="flex flex-col items-center justify-center gap-1 border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500 sm:flex-row sm:gap-2" />
      <MobileNavigation items={navItems} />
    </div>
  );
};
