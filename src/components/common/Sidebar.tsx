import React, { useEffect, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface SidebarNavItem {
  label: string;
  shortLabel?: string;
  href: string;
  icon?: React.ReactNode;
  exact?: boolean;
  mobilePrimary?: boolean;
  description?: string;
  keywords?: string[];
  children?: SidebarNavItem[];
}

export interface SidebarCommandItem {
  label: string;
  href: string;
  parentLabel?: string;
  description?: string;
  keywords: string[];
  icon?: React.ReactNode;
}

export interface SidebarProps {
  title?: string;
  items: SidebarNavItem[];
  mobile?: boolean;
  onNavigate?: () => void;
  onSearchOpen?: () => void;
}

export const isNavigationItemActive = (pathname: string, item: SidebarNavItem): boolean => {
  const ownRouteActive = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return ownRouteActive || Boolean(item.children?.some((child) => isNavigationItemActive(pathname, child)));
};

export const flattenSidebarNavItems = (items: SidebarNavItem[]): SidebarCommandItem[] => {
  const seen = new Set<string>();
  const flattened: SidebarCommandItem[] = [];

  items.forEach((item) => {
    const candidates = [
      { ...item, parentLabel: undefined },
      ...(item.children || []).map((child) => ({ ...child, parentLabel: item.label })),
    ];

    candidates.forEach((candidate) => {
      if (seen.has(candidate.href)) return;
      seen.add(candidate.href);
      flattened.push({
        label: candidate.label,
        href: candidate.href,
        parentLabel: candidate.parentLabel,
        description: candidate.description,
        keywords: candidate.keywords || [],
        icon: candidate.icon,
      });
    });
  });

  return flattened;
};

export const Sidebar: React.FC<SidebarProps> = ({
  title = "Navigasi",
  items,
  mobile = false,
  onNavigate,
  onSearchOpen,
}) => {
  const location = useLocation();
  const [expandedHref, setExpandedHref] = useState<string | null>(() =>
    items.find((item) => item.children?.length && isNavigationItemActive(location.pathname, item))?.href || null,
  );

  useEffect(() => {
    const activeGroup = items.find((item) => item.children?.length && isNavigationItemActive(location.pathname, item));
    if (activeGroup) setExpandedHref(activeGroup.href);
  }, [items, location.pathname]);

  return (
    <aside
      className={cn(
        "app-sidebar",
        mobile
          ? "h-full w-full p-4"
          : "sticky top-16 hidden h-[calc(100dvh-4rem)] w-20 flex-shrink-0 overflow-y-auto px-3 py-5 md:block xl:w-72 xl:px-4",
      )}
    >
      <div className={cn("app-sidebar__title mb-3 px-3", !mobile && "hidden xl:block")}>{title}</div>

      {onSearchOpen && (
        <button
          type="button"
          onClick={onSearchOpen}
          className={cn(
            "app-sidebar__search mb-4 min-h-[44px] w-full items-center gap-2",
            mobile ? "flex" : "hidden xl:flex",
          )}
          aria-label="Cari menu dan fitur"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left">Cari menu</span>
          <kbd>Ctrl K</kbd>
        </button>
      )}

      <nav aria-label={title} className="space-y-1">
        {items.map((item) => {
          const isActive = isNavigationItemActive(location.pathname, item);
          const hasChildren = Boolean(item.children?.length);
          const isExpanded = expandedHref === item.href;

          return (
            <div key={item.href} className="app-sidebar__group">
              <div className={cn("app-sidebar__row", isActive && "is-active")}>
                <Link
                  to={item.href}
                  onClick={onNavigate}
                  title={!mobile ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "app-sidebar__link flex min-h-[48px] min-w-0 flex-1 items-center px-3 py-2.5",
                    mobile ? "gap-3" : "justify-center xl:justify-start xl:gap-3",
                  )}
                >
                  {item.icon && (
                    <span className="app-sidebar__icon h-5 w-5 shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span className={cn("truncate whitespace-nowrap", !mobile && "hidden xl:inline")}>{item.label}</span>
                </Link>

                {hasChildren && (
                  <button
                    type="button"
                    className={cn("app-sidebar__toggle h-11 w-11 shrink-0", !mobile && "hidden xl:grid")}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Tutup" : "Buka"} submenu ${item.label}`}
                    onClick={() => setExpandedHref((current) => (current === item.href ? null : item.href))}
                  >
                    <ChevronDown className={cn("h-4 w-4", isExpanded && "rotate-180")} aria-hidden="true" />
                  </button>
                )}
              </div>

              {hasChildren && isExpanded && (
                <ul className={cn("app-sidebar__submenu", !mobile && "hidden xl:block")}>
                  {item.children?.map((child) => {
                    const childActive = isNavigationItemActive(location.pathname, child);
                    return (
                      <li key={child.href}>
                        <Link
                          to={child.href}
                          onClick={onNavigate}
                          aria-current={childActive ? "page" : undefined}
                          className={cn("app-sidebar__sublink", childActive && "is-active")}
                        >
                          <span className="app-sidebar__submark" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate whitespace-nowrap">{child.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};
