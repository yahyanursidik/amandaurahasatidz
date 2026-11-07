import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Archive,
  CircleAlert,
  ClipboardCheck,
  UserCheck,
  UsersRound,
} from "lucide-react";

const items = [
  { label: "Direktori", href: "/admin/ustadz", icon: UsersRound, exact: true },
  { label: "Perlu dilengkapi", href: "/admin/ustadz?quality=incomplete", icon: ClipboardCheck },
  { label: "Potensi duplikat", href: "/admin/ustadz?duplicate=true", icon: CircleAlert },
  { label: "Pernah hadir", href: "/admin/ustadz?participation=attended", icon: UserCheck },
  { label: "Nonaktif", href: "/admin/ustadz?profileStatus=INACTIVE", icon: Archive },
  { label: "Arsip", href: "/admin/ustadz?profileStatus=ARCHIVED", icon: Archive },
];

export const UstadzWorkspaceNav: React.FC = () => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);

  return (
    <nav className="ustadz-workspace-nav" aria-label="Navigasi pengelolaan asatidz">
      <div className="ustadz-workspace-nav__scroll">
        {items.map((item) => {
          const Icon = item.icon;
          const itemQuery = item.href.includes("?") ? new URLSearchParams(item.href.split("?")[1]) : null;
          const active = item.exact
            ? location.pathname === item.href && !query.has("quality") && !query.has("duplicate") && !query.has("participation") && !query.has("profileStatus")
            : itemQuery
              ? location.pathname === "/admin/ustadz" && [...itemQuery].every(([key, value]) => query.get(key) === value) &&
                !["quality", "duplicate", "participation", "profileStatus"].some((key) => !itemQuery.has(key) && query.has(key))
              : location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className="ustadz-workspace-nav__item"
              data-active={active}
              aria-current={active ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
