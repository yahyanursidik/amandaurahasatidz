import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavigationItemActive, SidebarNavItem } from "./Sidebar";

export interface MobileNavigationProps {
  items: SidebarNavItem[];
  onMenuOpen?: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ items, onMenuOpen }) => {
  const location = useLocation();
  const primary = items.some((item) => item.mobilePrimary) ? items.filter((item) => item.mobilePrimary) : items;
  const hasMore = items.length > 5;
  const adminPreferred = primary.filter((item) => ["/admin/ustadz", "/admin/broadcast"].includes(item.href));
  const visible = onMenuOpen && hasMore
    ? (adminPreferred.length ? [primary[0], primary[1], ...adminPreferred] : primary).slice(0, 4)
    : primary.slice(0, 5);
  const hiddenActive = items.filter((item) => !visible.includes(item)).some((item) => isNavigationItemActive(location.pathname, item));

  return (
    <nav
      aria-label="Navigasi utama mobile"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white px-2 pb-[max(.25rem,env(safe-area-inset-bottom))] pt-1 shadow-lg md:hidden"
    >
      {visible.map((item) => {
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
      {onMenuOpen && hasMore && <button type="button" onClick={onMenuOpen} aria-label="Buka semua menu" className={cn("flex min-h-[48px] min-w-[56px] flex-col items-center justify-center rounded-lg p-2 text-xs font-medium", hiddenActive ? "font-bold text-emerald-700" : "text-slate-500")}><Menu className="mb-0.5 h-5 w-5" aria-hidden="true" /><span className="text-[10px]">Menu</span></button>}
    </nav>
  );
};
