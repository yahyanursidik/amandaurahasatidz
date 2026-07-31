import React from "react";
import { Link, useLocation } from "react-router-dom";
import { CalendarClock, KeyRound, ListChecks, ShieldCheck, UserPlus, UsersRound } from "lucide-react";

const items = [
  { label: "Ringkasan", href: "/admin/committee", icon: ListChecks, exact: true },
  { label: "Akun Panitia", href: "/admin/committee?view=members", icon: UsersRound },
  { label: "Penugasan", href: "/admin/committee?view=assignments", icon: ShieldCheck },
  { label: "Matriks Akses", href: "/admin/committee?view=access", icon: KeyRound },
  { label: "Tenggat", href: "/admin/committee?view=deadlines", icon: CalendarClock },
  { label: "Tambah Akun", href: "/admin/committee/create", icon: UserPlus },
];

export const CommitteeWorkspaceNav: React.FC = () => {
  const location = useLocation();
  const current = `${location.pathname}${location.search}`;
  return (
    <nav aria-label="Navigasi pengelolaan panitia" className="mb-6 overflow-x-auto border-y border-slate-200 bg-white">
      <div className="flex min-w-max">
        {items.map(({ label, href, icon: Icon, exact }) => {
          const active = exact ? current === href : current.startsWith(href);
          return <Link key={href} to={href} className={`inline-flex min-h-[48px] items-center gap-2 border-b-2 px-4 text-sm font-bold ${active ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><Icon className="h-4 w-4" />{label}</Link>;
        })}
      </div>
    </nav>
  );
};
