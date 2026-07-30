import React from "react";
import { LogOut, Menu } from "lucide-react";
import { useLogout } from "@refinedev/core";

export interface HeaderProps {
  portalName: string;
  badgeLabel: string;
  badgeColorClass?: string;
  onMobileMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  portalName,
  badgeLabel,
  badgeColorClass = "bg-emerald-800 text-emerald-100 border-emerald-700",
  onMobileMenuToggle,
}) => {
  const { mutate: logout } = useLogout();

  return (
    <header className="bg-emerald-950 text-white shadow-md border-b border-emerald-900 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {onMobileMenuToggle && (
            <button
              onClick={onMobileMenuToggle}
              className="lg:hidden p-2 rounded-md hover:bg-emerald-900 text-slate-200"
              aria-label="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-emerald-950 text-lg shadow-sm">
            YTS
          </div>
          <div>
            <h1 className="font-semibold text-lg leading-none">DaurahHub YTS</h1>
            <span className="text-xs text-emerald-300 font-medium">{portalName}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className={`text-xs px-3 py-1 rounded-full font-medium border hidden sm:inline-block ${badgeColorClass}`}>
            {badgeLabel}
          </span>
          <button
            onClick={() => logout()}
            className="flex items-center space-x-1 text-xs text-emerald-200 hover:text-white bg-emerald-900 hover:bg-emerald-800 px-3 py-1.5 rounded-md border border-emerald-800 transition min-h-[44px] sm:min-h-[auto]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
