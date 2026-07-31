import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Archive,
  CircleAlert,
  ClipboardCheck,
  GitMerge,
  Plus,
  UsersRound,
} from "lucide-react";

const items = [
  { label: "Direktori", href: "/admin/ustadz", icon: UsersRound, exact: true },
  { label: "Perlu dilengkapi", href: "/admin/ustadz?quality=incomplete", icon: ClipboardCheck },
  { label: "Potensi duplikat", href: "/admin/ustadz?duplicate=true", icon: CircleAlert },
  { label: "Nonaktif", href: "/admin/ustadz?profileStatus=INACTIVE", icon: Archive },
  { label: "Tambah profil", href: "/admin/ustadz/create", icon: Plus },
  { label: "Gabungkan", href: "/admin/ustadz/merge", icon: GitMerge },
];

export const UstadzWorkspaceNav: React.FC = () => {
  const location = useLocation();
  const current = `${location.pathname}${location.search}`;

  return (
    <nav className="ustadz-workspace-nav" aria-label="Navigasi pengelolaan asatidz">
      <div className="ustadz-workspace-nav__scroll">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? current === item.href
            : item.href.includes("?")
              ? current === item.href
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
