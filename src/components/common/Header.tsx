import React from "react";
import { LogOut, Menu, X } from "lucide-react";
import { useGetIdentity, useLogout } from "@refinedev/core";

export interface HeaderProps {
  portalName: string;
  badgeLabel: string;
  badgeColorClass?: string;
  onMobileMenuToggle?: () => void;
  mobileMenuOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  portalName,
  badgeLabel,
  badgeColorClass = "bg-emerald-800 text-emerald-100 border-emerald-700",
  onMobileMenuToggle,
  mobileMenuOpen = false,
}) => {
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity<{ name?: string; email?: string }>();

  return (
    <header className="bg-emerald-950 text-white shadow-md border-b border-emerald-900 sticky top-0 z-30">
      <div className="flex h-16 w-full items-center justify-between px-4 sm:px-5 lg:px-6">
        <div className="flex items-center space-x-3">
          {onMobileMenuToggle && (
            <button
              onClick={onMobileMenuToggle}
              className="grid min-h-[44px] min-w-[44px] place-items-center rounded-md text-slate-200 hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 md:hidden"
              aria-label={mobileMenuOpen ? "Tutup menu" : "Buka menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
          <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-emerald-950 text-lg shadow-sm">
            YTS
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-none sm:text-lg">Aman Daurah Asatidz</h1>
            <span className="text-xs text-emerald-300 font-medium">{portalName}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden text-right md:block">
            <p className="max-w-40 truncate text-xs font-bold text-white">{identity?.name || badgeLabel}</p>
            <p className="max-w-40 truncate text-[10px] text-emerald-300">{identity?.email || portalName}</p>
          </div>
          <button
            onClick={() => logout()}
            className="flex min-h-[44px] items-center space-x-1 whitespace-nowrap rounded-md border border-emerald-800 bg-emerald-900 px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
