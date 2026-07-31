import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { isNavigationItemActive, SidebarNavItem } from "./Sidebar";

export interface MobileNavigationProps {
  items: SidebarNavItem[];
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ items }) => {
  const location = useLocation();

  return (
    <nav
      aria-label="Navigasi utama mobile"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white px-2 pb-[max(.25rem,env(safe-area-inset-bottom))] pt-1 shadow-lg md:hidden"
    >
      {(items.some((item) => item.mobilePrimary)
        ? items.filter((item) => item.mobilePrimary)
        : items
      ).slice(0, 5).map((item) => {
        const isActive = isNavigationItemActive(location.pathname, item);
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex min-h-[48px] min-w-[60px] flex-col items-center justify-center whitespace-nowrap rounded-lg p-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700",
              isActive ? "text-emerald-700 font-bold" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <span className="w-5 h-5 mb-0.5">{item.icon}</span>
            <span className="max-w-[70px] truncate whitespace-nowrap text-[10px]">{item.shortLabel || item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
