import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export interface SidebarProps {
  title?: string;
  items: SidebarNavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ title = "Navigasi", items }) => {
  const location = useLocation();

  return (
    <aside className="w-64 flex-shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-fit hidden lg:block">
      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-3">
        {title}
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const isActive = location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition min-h-[44px]",
                isActive
                  ? "bg-emerald-50 text-emerald-800 font-semibold border-l-4 border-emerald-600"
                  : "text-slate-700 hover:bg-slate-50 hover:text-emerald-700"
              )}
            >
              <span className={cn("w-4 h-4", isActive ? "text-emerald-600" : "text-slate-400")}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
