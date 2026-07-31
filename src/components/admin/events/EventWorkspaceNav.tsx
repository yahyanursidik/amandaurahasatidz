/* Hallmark · component: event workspace navigation · genre: modern-minimal · theme: existing emerald-slate
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass
 */
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  FileBarChart,
  Mail,
  Settings,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  eventId: string;
};

const buildItems = (eventId: string) => [
  { label: "Ringkasan", href: `/admin/events/${eventId}`, icon: BarChart3, exact: true },
  { label: "Jadwal & sesi", href: `/admin/events/${eventId}/schedule`, icon: CalendarClock },
  { label: "Undangan", href: `/admin/events/${eventId}/registrations?view=invitations`, icon: ClipboardList },
  { label: "Peserta", href: `/admin/events/${eventId}/registrations?view=participants`, icon: UserRoundCheck },
  { label: "Panitia", href: `/admin/events/${eventId}/team`, icon: Users },
  { label: "Kehadiran", href: `/admin/events/${eventId}/attendance`, icon: ShieldCheck },
  { label: "Komunikasi", href: `/admin/events/${eventId}/communications`, icon: Mail },
  { label: "Laporan", href: `/admin/events/${eventId}/reports`, icon: FileBarChart },
  { label: "Pengaturan", href: `/admin/events/${eventId}/edit`, icon: Settings },
];

export const EventWorkspaceNav: React.FC<Props> = ({ eventId }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const items = buildItems(eventId);
  const current = items.find((item) => {
    const targetPath = item.href.split("?")[0];
    if (item.label === "Undangan") {
      return location.pathname.includes("/registrations") && !location.search.includes("view=participants");
    }
    if (item.label === "Peserta") {
      return location.pathname.includes("/registrations") && location.search.includes("view=participants");
    }
    return item.exact ? location.pathname === targetPath : location.pathname === targetPath;
  });

  return (
    <div className="mb-6 border-y border-slate-200 bg-white">
      <label className="block p-3 lg:hidden">
        <span className="sr-only">Pilih submodul event</span>
        <select
          value={current?.href || items[0].href}
          onChange={(event) => navigate(event.target.value)}
          className="min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-2 outline-transparent focus-visible:outline-emerald-700"
        >
          {items.map((item) => (
            <option key={item.href} value={item.href}>{item.label}</option>
          ))}
        </select>
      </label>
      <nav aria-label="Submenu pengelolaan event" className="hidden flex-wrap lg:flex">
        {items.map((item) => {
          const ItemIcon = item.icon;
          const active = current?.label === item.label;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => navigate(item.href)}
              className={cn(
                "inline-flex min-h-[56px] items-center gap-2 whitespace-nowrap border-b-2 px-4 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700 active:bg-emerald-100",
                active
                  ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                  : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <ItemIcon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
