import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, CircleAlert, Plus, Archive, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { label: "Direktori", href: "/admin/institutions", icon: LayoutList, match: "" },
  { label: "Perlu verifikasi", href: "/admin/institutions?verificationStatus=UNVERIFIED", icon: CircleAlert, match: "verificationStatus=UNVERIFIED" },
  { label: "Nonaktif", href: "/admin/institutions?status=INACTIVE", icon: Archive, match: "status=INACTIVE" },
  { label: "Tambah lembaga", href: "/admin/institutions/create", icon: Plus, match: "/create" },
];

export const InstitutionWorkspaceNav: React.FC = () => {
  const location = useLocation();
  const current = `${location.pathname}${location.search}`;
  return (
    <nav className="institution-workspace-nav" aria-label="Menu pengelolaan lembaga">
      <span className="institution-workspace-nav__label"><Building2 aria-hidden="true" /> Ruang lembaga</span>
      <div>
        {items.map((item) => {
          const active = item.match === ""
            ? location.pathname === "/admin/institutions" && !location.search
            : current.includes(item.match);
          const Icon = item.icon;
          return (
            <Link key={item.href} to={item.href} className={cn("institution-workspace-nav__item", active && "is-active")}>
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
