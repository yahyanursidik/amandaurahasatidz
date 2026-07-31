import React from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCircle2, ClipboardCheck, Plus, ScanLine, Users } from "lucide-react";
import { CommitteeLayout } from "@/components/layouts/CommitteeLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";

export const CommitteeSupportPage: React.FC<{ mode: "attendance" | "announcements" }> = ({ mode }) => {
  const attendance = mode === "attendance";

  return (
    <CommitteeLayout>
      <PageHeader
        title={attendance ? "Daftar kehadiran" : "Pengumuman event"}
        description={
          attendance
            ? "Pantau peserta hadir, scan ganda, dan peserta yang masih perlu ditindaklanjuti."
            : "Susun dan publikasikan informasi operasional untuk peserta daurah."
        }
        breadcrumbs={[
          { label: "Panitia", href: "/committee" },
          { label: attendance ? "Kehadiran" : "Pengumuman" },
        ]}
        actions={
          attendance ? (
            <Link
              to="/committee/check-in"
              className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-teal-800 px-4 text-xs font-bold text-white hover:bg-teal-900"
            >
              <ScanLine className="h-4 w-4" />
              Buka scanner
            </Link>
          ) : (
            <button className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-lg bg-teal-800 px-4 text-xs font-bold text-white hover:bg-teal-900">
              <Plus className="h-4 w-4" />
              Buat pengumuman
            </button>
          )
        }
      />

      {attendance ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Peserta terdaftar", value: "—", icon: Users },
              { label: "Sudah hadir", value: "—", icon: CheckCircle2 },
              { label: "Perlu verifikasi", value: "—", icon: ClipboardCheck },
            ].map((item) => (
              <div key={item.label} className="border-t-2 border-teal-700 bg-slate-50 p-4">
                <item.icon className="h-4 w-4 text-teal-800" />
                <p className="mt-3 text-2xl font-black text-slate-950">{item.value}</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <ClipboardCheck className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-3 text-sm font-bold text-slate-900">Pilih event aktif untuk memuat rekap</h2>
            <p className="mt-1 text-xs text-slate-500">Rekap akan dikelompokkan per sesi dan per lembaga.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-teal-800" />
              <div>
                <h2 className="text-sm font-black text-slate-900">Belum ada pengumuman aktif</h2>
                <p className="mt-1 text-[11px] text-slate-500">Pengumuman yang dipublikasikan akan muncul di Portal Asatidz.</p>
              </div>
            </div>
            <StatusBadge label="0 terbit" variant="neutral" />
          </div>
          <div className="p-8 text-center text-xs text-slate-500">
            Pilih event, lalu buat pengumuman pertama untuk peserta.
          </div>
        </div>
      )}
    </CommitteeLayout>
  );
};
