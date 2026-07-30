import React, { useState } from "react";
import { useLogin } from "@refinedev/core";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { Mail, ShieldCheck, KeyRound, ArrowRight } from "lucide-react";

export const LoginPage: React.FC = () => {
  const { mutate: login, isPending } = useLogin();
  const isLoading = isPending ?? false;
  const [email, setEmail] = useState("admin@yts.or.id");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email });
  };

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-md border border-slate-200 p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Masuk Portal Daurah</h2>
          <p className="text-xs text-slate-500 mt-1">
            Gunakan email terdaftar untuk menerima tautan masuk atau OTP
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alamat Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@domain.com"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium rounded-lg text-sm flex items-center justify-center space-x-2 transition shadow-sm disabled:opacity-50"
          >
            <span>{isLoading ? "Memproses..." : "Masuk Sistem"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <span className="text-xs text-slate-400">
            Perlu akses? Hubungi panitia Sekretariat YTS
          </span>
        </div>
      </div>
    </PublicLayout>
  );
};
