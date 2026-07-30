import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { SidebarNavItem } from "./Sidebar";

export interface MobileNavigationProps {
  items: SidebarNavItem[];
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ items }) => {
  const location = useLocation();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-1 flex items-center justify-around z-40 shadow-lg">
      {items.slice(0, 5).map((item) => {
        const isActive = location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-lg text-xs font-medium min-w-[60px] min-h-[44px]",
              isActive ? "text-emerald-700 font-bold" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <span className="w-5 h-5 mb-0.5">{item.icon}</span>
            <span className="truncate max-w-[70px] text-[10px]">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
};
