import React, { useState } from "react";
import { Header } from "./Header";
import { Sidebar, SidebarNavItem } from "./Sidebar";
import { MobileNavigation } from "./MobileNavigation";

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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-16 lg:pb-0">
      <Header
        portalName={portalName}
        badgeLabel={badgeLabel}
        badgeColorClass={badgeColorClass}
        onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        <Sidebar items={navItems} />

        <main className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 min-h-[550px]">
          {children}
        </main>
      </div>

      <MobileNavigation items={navItems} />
    </div>
  );
};
