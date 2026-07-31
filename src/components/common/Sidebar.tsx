import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface SidebarNavItem {
  label: string;
  shortLabel?: string;
  href: string;
  icon: React.ReactNode;
  exact?: boolean;
}

export interface SidebarProps {
  title?: string;
  items: SidebarNavItem[];
  mobile?: boolean;
  onNavigate?: () => void;
}

export const isNavigationItemActive = (pathname: string, item: SidebarNavItem) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

export const Sidebar: React.FC<SidebarProps> = ({ title = "Navigasi", items, mobile = false, onNavigate }) => {
  const location = useLocation();

  return (
    <aside
      className={
        mobile
          ? "h-full w-full bg-white p-4"
          : "sticky top-16 hidden h-[calc(100dvh-4rem)] w-20 flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-3 py-5 md:block xl:w-64 xl:px-4"
      }
    >
      <div className={cn("mb-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400", !mobile && "hidden xl:block")}>
        {title}
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const isActive = isNavigationItemActive(location.pathname, item);
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              title={!mobile ? item.label : undefined}
              className={cn(
                "flex min-h-[48px] items-center rounded-lg px-3 py-2.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                mobile ? "gap-3" : "justify-center xl:justify-start xl:gap-3",
                isActive
                  ? "bg-emerald-100 font-semibold text-emerald-950"
                  : "text-slate-700 hover:bg-slate-50 hover:text-emerald-800"
              )}
            >
              <span className={cn("h-5 w-5 shrink-0", isActive ? "text-emerald-700" : "text-slate-400")}>
                {item.icon}
              </span>
              <span className={cn("whitespace-nowrap", !mobile && "hidden xl:inline")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
