import React from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Calendar, Building2, Users, Clock, CheckCircle } from "lucide-react";

export const AdminDashboardPage: React.FC = () => {
  return (
    <AdminLayout>
      <PageHeader
        title="Dashboard Super Admin"
        description="Ringkasan master data, status event daurah, dan aktivitas sistem."
        actions={
          <StatusBadge label="Sistem Normal" variant="success" icon={<CheckCircle className="w-3.5 h-3.5" />} />
        }
      />

      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center space-x-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-emerald-800 font-medium">Total Event</span>
              <h3 className="text-2xl font-bold text-emerald-950">1</h3>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center space-x-4">
            <div className="w-10 h-10 rounded-lg bg-slate-700 text-white flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-600 font-medium">Master Lembaga</span>
              <h3 className="text-2xl font-bold text-slate-900">24</h3>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center space-x-4">
            <div className="w-10 h-10 rounded-lg bg-slate-700 text-white flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-600 font-medium">Master Asatidz</span>
              <h3 className="text-2xl font-bold text-slate-900">150</h3>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center space-x-4">
            <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-amber-800 font-medium">Menunggu Approvals</span>
              <h3 className="text-2xl font-bold text-amber-950">12</h3>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
